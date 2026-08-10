import { NextResponse, type NextRequest } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import {
  generatePassword,
  recoveryRedirectUrl,
  validateNewPassword,
} from '@/lib/auth/passwords';

export const dynamic = 'force-dynamic';

/**
 * POST /api/saas-admin/users/[id]/actions
 *
 * Privileged operations on one user. Body: `{ action, ...args }`.
 *
 *   revoke_sessions        — sign them out of every device
 *   set_status             — 'active' | 'blocked'
 *   set_system_role        — 'user' | 'super_admin'
 *   set_single_workspace   — restrict to one workspace, or lift it
 *   send_password_reset    — recovery email (mailbox as second factor)
 *   set_password           — set/generate a credential directly, returned once
 *   delete_user            — remove the account entirely (guards below)
 *
 * One route with an `action` discriminator rather than four routes,
 * because they share the guard, the self-harm checks and the audit shape;
 * splitting them would mean four chances to forget one of the three.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;
  const { id: targetUserId } = await params;

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  const { data: target } = await admin
    .from('profiles')
    .select('user_id, email, full_name, status, system_role')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Locking yourself out of the console is unrecoverable without database
  // access, so the two actions that could do it refuse to target self.
  const isSelf = targetUserId === actor.id;

  switch (action) {
    case 'revoke_sessions': {
      const { data, error } = await admin.rpc('revoke_user_sessions', {
        p_user_id: targetUserId,
        p_reason: `signed out by ${actor.email}`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await audit({
        action: 'user.sessions_revoked',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, sessions: data ?? 0 },
      });
      return NextResponse.json({ ok: true, revoked: data ?? 0 });
    }

    case 'set_status': {
      const status = body.status === 'blocked' ? 'blocked' : 'active';
      if (isSelf && status === 'blocked') {
        return NextResponse.json({ error: 'You cannot block your own account.' }, { status: 400 });
      }

      const { error } = await admin
        .from('profiles')
        .update({ status })
        .eq('user_id', targetUserId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Blocking must also end the current session. Without this the user
      // keeps working until their token expires, which is up to an hour
      // of access after being blocked.
      if (status === 'blocked') {
        await admin.rpc('revoke_user_sessions', {
          p_user_id: targetUserId,
          p_reason: 'account blocked',
        });
      }

      await audit({
        action: 'user.status_changed',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, before: target.status, after: status },
      });
      return NextResponse.json({ ok: true, status });
    }

    case 'set_system_role': {
      const role = body.system_role === 'super_admin' ? 'super_admin' : 'user';
      if (isSelf && role !== 'super_admin') {
        return NextResponse.json(
          { error: 'You cannot remove your own super-admin role.' },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from('profiles')
        .update({ system_role: role })
        .eq('user_id', targetUserId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await audit({
        action: 'user.system_role_changed',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, before: target.system_role, after: role },
      });
      return NextResponse.json({ ok: true, system_role: role });
    }

    case 'set_single_workspace': {
      const restricted = body.single_workspace_only === true;

      // The flag only blocks FUTURE joins (migration 102's trigger runs on
      // INSERT). Existing extra memberships are left alone deliberately:
      // silently ripping a user out of workspaces they are mid-work in is
      // a support fire, and which membership survives is a human call.
      // The response says so, so the admin is not surprised.
      const { error } = await admin
        .from('profiles')
        .update({ single_workspace_only: restricted })
        .eq('user_id', targetUserId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { count } = await admin
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      await audit({
        action: 'user.single_workspace_changed',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, restricted, current_memberships: count ?? 0 },
      });

      return NextResponse.json({
        ok: true,
        single_workspace_only: restricted,
        note:
          restricted && (count ?? 0) > 1
            ? `This user is currently in ${count} workspaces. Existing memberships are kept; only new joins are blocked. Remove them from workspaces manually if needed.`
            : undefined,
      });
    }

    case 'delete_user': {
      if (isSelf) {
        return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
      }
      if (target.system_role === 'super_admin') {
        // Demote first, delete second — two deliberate acts. One request
        // that can erase another platform admin is one compromised
        // session away from erasing all of them.
        return NextResponse.json(
          { error: 'Remove the super-admin role before deleting this account.' },
          { status: 400 },
        );
      }
      if (body.confirm_email !== target.email) {
        return NextResponse.json(
          { error: 'Type the user’s email exactly to confirm deletion.' },
          { status: 400 },
        );
      }

      // Refuse while they solely own a workspace: deleting the last owner
      // strands the tenant with nobody who can manage or pay for it.
      // Purge the workspace first, or transfer ownership.
      const { data: owned } = await admin
        .from('workspace_members')
        .select('workspace_id, workspaces(name)')
        .eq('user_id', targetUserId)
        .eq('role', 'owner');
      for (const o of (owned ?? []) as { workspace_id: string; workspaces: { name: string } | { name: string }[] | null }[]) {
        const { count: ownerCount } = await admin
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', o.workspace_id)
          .eq('role', 'owner');
        if ((ownerCount ?? 0) <= 1) {
          const wsName = Array.isArray(o.workspaces) ? o.workspaces[0]?.name : o.workspaces?.name;
          return NextResponse.json(
            {
              error: `This user is the only owner of workspace "${wsName ?? o.workspace_id}". Delete that tenant first, or transfer ownership.`,
            },
            { status: 409 },
          );
        }
      }

      // Order matters: sessions die first so they cannot act mid-delete,
      // then rows that reference them, then the auth account itself.
      await admin.rpc('revoke_user_sessions', {
        p_user_id: targetUserId,
        p_reason: 'account deleted',
      });
      await admin.from('workspace_members').delete().eq('user_id', targetUserId);
      await admin.from('profiles').delete().eq('user_id', targetUserId);

      const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId);
      if (authErr) {
        return NextResponse.json(
          { error: `Profile removed but the auth account failed to delete: ${authErr.message}` },
          { status: 500 },
        );
      }

      await audit({
        action: 'user.deleted',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, name: target.full_name },
      });
      return NextResponse.json({ ok: true });
    }

    case 'send_password_reset': {
      if (!target.email) {
        return NextResponse.json({ error: 'This user has no email on file.' }, { status: 400 });
      }

      // resetPasswordForEmail, not generateLink: generateLink only MINTS
      // a link and returns it — for months this action reported success
      // while no email ever left the building. resetPasswordForEmail
      // sends through Supabase's mailer, and the explicit redirectTo
      // keeps the link off the project's Site URL fallback (the
      // localhost bug).
      const { error } = await admin.auth.resetPasswordForEmail(target.email, {
        redirectTo: recoveryRedirectUrl(request),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await audit({
        action: 'user.password_reset_sent',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email },
      });
      return NextResponse.json({ ok: true });
    }

    case 'set_password': {
      // The platform operator can set a credential directly — the
      // recovery-email path stays available above, but "the user is on
      // the phone and locked out" needs a same-minute fix. Guard rails:
      // never on another super-admin (console peers reset their own),
      // sessions are revoked, and the audit row records it happened
      // (never the credential itself).
      if (target.system_role === 'super_admin' && !isSelf) {
        return NextResponse.json(
          { error: "Another super-admin's password can only be changed by themselves." },
          { status: 403 },
        );
      }

      let password: string;
      if (typeof body.password === 'string' && body.password.length > 0) {
        const check = validateNewPassword(body.password);
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
        password = check.password;
      } else {
        password = generatePassword();
      }

      const { error } = await admin.auth.admin.updateUserById(targetUserId, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (!isSelf) {
        await admin.rpc('revoke_user_sessions', {
          p_user_id: targetUserId,
          p_reason: 'password set by platform admin',
        });
      }

      await audit({
        action: 'user.password_set',
        targetType: 'user',
        targetId: targetUserId,
        details: { email: target.email, generated: !(typeof body.password === 'string' && body.password.length > 0) },
      });
      // Returned once for the operator to hand over; never stored.
      return NextResponse.json({ ok: true, password });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
