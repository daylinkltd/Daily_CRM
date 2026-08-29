// ============================================================
// GET   /api/workspace/access?workspace_id=<uuid>
// PATCH /api/workspace/access
//
// One place for the tenant owner to see and set who has access to which
// workspace, and at what role.
//
// Settings → Members only ever managed the workspace you happened to be
// looking at, so granting someone access to a second workspace meant
// switching into it and inviting them again — and there was no screen
// anywhere that answered "what can this person see across the whole
// company?". This route answers exactly that, and lets it be changed.
//
// The rules it enforces, which no row policy can express:
//
//   • Only the tenant OWNER may use it. Roles differ per workspace by
//     design, so an admin of workspace A has no standing to grant
//     themselves access to workspace B.
//   • The owner's own membership is never editable here. Removing it
//     would orphan the tenant, and the seat helpers key on it.
//   • Seats are pooled per tenant (migration 118), so granting an
//     EXISTING colleague access to another workspace costs nothing —
//     only a brand-new person consumes a seat.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVITY, logActivity } from '@/lib/saas-admin/activity';
import { systemRoleNameCandidates, type WorkspaceDbRole } from '@/lib/auth/roles';

const ASSIGNABLE: WorkspaceDbRole[] = ['admin', 'member', 'viewer'];

/** The workspaces this user owns, i.e. the tenant. */
async function tenantWorkspaceIds(
  admin: ReturnType<typeof createAdminClient>,
  ownerUserId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', ownerUserId)
    .eq('role', 'owner');
  return (data ?? []).map((r) => r.workspace_id as string);
}

/**
 * Confirm the caller owns the workspace they named, and return the
 * tenant that hangs off them.
 */
async function requireTenantOwner(request: NextRequest, workspaceId: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'owner') {
    return {
      error: NextResponse.json(
        { error: 'Only the workspace owner can manage access across workspaces.' },
        { status: 403 },
      ),
    };
  }

  return { user, admin, ids: await tenantWorkspaceIds(admin, user.id) };
}

export async function GET(request: NextRequest) {
  const workspaceId = new URL(request.url).searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  const guard = await requireTenantOwner(request, workspaceId);
  if ('error' in guard) return guard.error;
  const { admin, ids, user } = guard;

  const [{ data: workspaces }, { data: members }] = await Promise.all([
    admin.from('workspaces').select('id, name, created_at').in('id', ids).order('created_at'),
    admin.from('workspace_members').select('id, workspace_id, user_id, role, role_id').in('workspace_id', ids),
  ]);

  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, full_name, email, avatar_url')
    .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

  // Custom roles are per workspace, so the picker for each cell has to
  // be the roles of THAT workspace, not a merged list.
  const { data: roles } = await admin
    .from('workspace_roles')
    .select('id, workspace_id, name, is_system')
    .in('workspace_id', ids);

  const profileBy = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const people = userIds.map((uid) => {
    const p = profileBy.get(uid);
    const local = p?.email?.split('@')[0];
    return {
      user_id: uid,
      full_name:
        p?.full_name?.trim() ||
        (local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Workspace Member'),
      email: p?.email ?? null,
      avatar_url: p?.avatar_url ?? null,
      isSelf: uid === user.id,
      access: (members ?? [])
        .filter((m) => m.user_id === uid)
        .map((m) => ({
          member_id: m.id,
          workspace_id: m.workspace_id,
          role: m.role,
          role_id: m.role_id,
        })),
    };
  });

  // Seats are people across the whole tenant, which is exactly the
  // number this screen is editing.
  return NextResponse.json({
    workspaces: workspaces ?? [],
    roles: roles ?? [],
    people: people.sort((a, b) => a.full_name.localeCompare(b.full_name)),
    seatsUsed: userIds.length,
  });
}

/**
 * PATCH { workspace_id (any owned, for the guard), target_workspace_id,
 *         user_id, role | null }
 *
 * `role: null` removes the person from that workspace. Anything else
 * grants or re-roles them there.
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { workspace_id, target_workspace_id, user_id, role, role_id } = body as {
    workspace_id?: string;
    target_workspace_id?: string;
    user_id?: string;
    role?: WorkspaceDbRole | null;
    role_id?: string | null;
  };

  if (!workspace_id || !target_workspace_id || !user_id) {
    return NextResponse.json(
      { error: 'workspace_id, target_workspace_id and user_id are required' },
      { status: 400 },
    );
  }
  if (role !== null && role !== undefined && !ASSIGNABLE.includes(role)) {
    return NextResponse.json(
      { error: "role must be 'admin', 'member', 'viewer', or null to revoke" },
      { status: 400 },
    );
  }

  const guard = await requireTenantOwner(request, workspace_id);
  if ('error' in guard) return guard.error;
  const { admin, ids, user } = guard;

  if (!ids.includes(target_workspace_id)) {
    return NextResponse.json(
      { error: 'That workspace is not part of your account.' },
      { status: 403 },
    );
  }
  if (user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot change your own access — you own this account.' },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', target_workspace_id)
    .eq('user_id', user_id)
    .maybeSingle();

  if (existing?.role === 'owner') {
    return NextResponse.json(
      { error: "A workspace owner's access cannot be changed here." },
      { status: 400 },
    );
  }

  // ---- revoke ----
  if (role === null) {
    if (!existing) return NextResponse.json({ ok: true, changed: false });
    const { error } = await admin.from('workspace_members').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      event: ACTIVITY.MEMBER_REMOVED,
      workspaceId: target_workspace_id,
      userId: user.id,
      userEmail: user.email,
      details: { target_user_id: user_id, via: 'access-matrix' },
      request,
    });
    return NextResponse.json({ ok: true, changed: true, role: null });
  }

  const nextRole = (role ?? 'member') as WorkspaceDbRole;

  // A NULL role_id denies everything under the RESTRICTIVE CRUD
  // policies, so resolve the workspace's own built-in role when the
  // caller did not name one.
  let resolvedRoleId = role_id ?? null;
  if (!resolvedRoleId) {
    const { data: fallback } = await admin
      .from('workspace_roles')
      .select('id')
      .eq('workspace_id', target_workspace_id)
      .eq('is_system', true)
      .in('name', systemRoleNameCandidates(nextRole))
      .limit(1)
      .maybeSingle();
    resolvedRoleId = fallback?.id ?? null;
  }

  if (existing) {
    const { error } = await admin
      .from('workspace_members')
      .update({ role: nextRole, role_id: resolvedRoleId })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, changed: true, role: nextRole });
  }

  const { error } = await admin.from('workspace_members').insert({
    workspace_id: target_workspace_id,
    user_id,
    role: nextRole,
    role_id: resolvedRoleId,
  });
  if (error) {
    // The seat trigger speaks in prefixes so callers can react; pass the
    // human half through rather than a raw constraint message.
    const message = error.message.startsWith('seat_limit:')
      ? error.message.replace('seat_limit:', 'Seat limit reached —').trim()
      : error.message;
    return NextResponse.json({ error: message }, { status: 403 });
  }

  await logActivity({
    event: ACTIVITY.MEMBER_JOINED,
    workspaceId: target_workspace_id,
    userId: user.id,
    userEmail: user.email,
    details: { target_user_id: user_id, role: nextRole, via: 'access-matrix' },
    request,
  });
  return NextResponse.json({ ok: true, changed: true, role: nextRole });
}
