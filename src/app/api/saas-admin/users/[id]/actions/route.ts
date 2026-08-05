import { NextResponse, type NextRequest } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/saas-admin/users/[id]/actions
 *
 * Privileged operations on one user. Body: `{ action, ...args }`.
 *
 *   revoke_sessions   — sign them out of every device
 *   set_status        — 'active' | 'blocked'
 *   set_system_role   — 'user' | 'super_admin'
 *   send_password_reset
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

    case 'send_password_reset': {
      if (!target.email) {
        return NextResponse.json({ error: 'This user has no email on file.' }, { status: 400 });
      }

      // A reset LINK, never a password we choose. An admin who can set
      // passwords can impersonate any user, and the audit trail would show
      // a legitimate login. This way the user's mailbox is the second
      // factor and the admin never learns the credential.
      const { error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: target.email,
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

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
