import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { defaultSystemRoleName, type WorkspaceDbRole } from '@/lib/auth/roles';

/** Helper: verify caller is workspace owner or admin */
async function verifyWorkspaceAdmin(workspaceId: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null, error: 'Unauthorized', status: 401 };

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (member?.role !== 'owner' && member?.role !== 'admin') {
    return { user: null, role: null, error: 'Forbidden: owner or admin role required', status: 403 };
  }
  return { user, supabase, role: member.role, error: null, status: 200 };
}

/**
 * POST /api/workspace/users
 * Owner creates a new team member (or adds an existing user) to a workspace.
 *
 * Body: {
 *   workspace_id, full_name, email, password?,
 *   role_id, role_name (display only),
 *   workspace_role: 'admin' | 'member' | 'viewer'  (enum fallback)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, full_name, email, password, role_id, workspace_role } = body as {
      workspace_id?: string;
      full_name?: string;
      email?: string;
      password?: string;
      role_id?: string;
      workspace_role?: 'admin' | 'member' | 'viewer';
    };

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const auth = await verifyWorkspaceAdmin(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const callerRole = auth.role;

    if (!email?.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // --- Check max_members limit ---
    const { data: wsData } = await adminClient
      .from('workspaces')
      .select('plan_limits')
      .eq('id', workspace_id)
      .single();

    const maxMembers = wsData?.plan_limits?.max_members as number | null;
    if (maxMembers) {
      const { count } = await adminClient
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id);
        
      if (count !== null && count >= maxMembers) {
        return NextResponse.json(
          { error: `Member limit reached for this workspace. (Max: ${maxMembers})` },
          { status: 403 }
        );
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    let targetUserId: string;

    // --- Check if user already exists ---
    // listUsers defaults to 50 per page; past 50 users an existing
    // account wouldn't be found and we'd wrongly try createUser.
    // Paginate until the email is found or the pages run out.
    let existingUser: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 20 && !existingUser; page++) {
      const { data: pageData, error: listErr } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listErr || !pageData?.users?.length) break;
      existingUser = pageData.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (pageData.users.length < 1000) break;
    }

    if (existingUser) {
      // User exists — just add them to the workspace
      targetUserId = existingUser.id;

      // Check if already a member
      const { supabase } = auth as any;
      const { data: alreadyMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (alreadyMember) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace' },
          { status: 409 }
        );
      }
    } else {
      // New user — create auth account
      if (callerRole === 'admin') {
        return NextResponse.json(
          { error: 'Only the workspace owner can create new user accounts.' },
          { status: 403 }
        );
      }

      if (!password || password.length < 8) {
        return NextResponse.json(
          { error: 'Password (min 8 chars) is required for new users' },
          { status: 400 }
        );
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: (full_name || '').trim() },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      targetUserId = newUser.user.id;
    }

    // --- Insert workspace_members row ---
    // Only 'admin', 'member', and 'viewer' are assignable. The DB
    // enum also accepts 'owner' — without this whitelist an admin
    // could mint new owners (privilege escalation).
    if (workspace_role && !['admin', 'member', 'viewer'].includes(workspace_role)) {
      return NextResponse.json(
        { error: 'workspace_role must be "admin", "member", or "viewer"' },
        { status: 400 }
      );
    }
    const dbRole = (workspace_role || 'member') as WorkspaceDbRole;
    const memberInsert: Record<string, unknown> = {
      workspace_id,
      user_id: targetUserId,
      role: dbRole,
    };

    if (role_id) {
      memberInsert.role_id = role_id;
    } else {
      // A NULL role_id locks the member out of every catalogued table —
      // the CRUD policies are RESTRICTIVE and fail closed — so fall back
      // to the workspace's built-in role rather than leaving it unset.
      const { data: fallbackRole } = await adminClient
        .from('workspace_roles')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('is_system', true)
        .eq('name', defaultSystemRoleName(dbRole))
        .maybeSingle();

      if (!fallbackRole) {
        // Seeded per workspace at creation (migrations 015/021). Absent
        // means the workspace was provisioned incompletely; say so rather
        // than create a member who silently cannot read anything.
        return NextResponse.json(
          {
            error: `This workspace has no built-in "${defaultSystemRoleName(dbRole)}" role, so no permissions could be assigned. Create a role under Settings → Roles and pass its role_id.`,
          },
          { status: 409 }
        );
      }
      memberInsert.role_id = fallbackRole.id;
    }

    const { error: insertError } = await adminClient
      .from('workspace_members')
      .insert(memberInsert);

    if (insertError) {
      console.error('[workspace/users POST] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      is_new_user: !existingUser,
    });
  } catch (err: any) {
    console.error('[workspace/users POST] unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workspace/users
 * Owner updates a team member's role or workspace_role.
 *
 * Body: { workspace_id, member_id, role_id?, workspace_role? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, member_id, role_id, workspace_role } = body as {
      workspace_id?: string;
      member_id?: string;
      role_id?: string | null;
      workspace_role?: 'admin' | 'member' | 'viewer';
    };

    if (!workspace_id || !member_id) {
      return NextResponse.json(
        { error: 'workspace_id and member_id are required' },
        { status: 400 }
      );
    }

    const auth = await verifyWorkspaceAdmin(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const updates: Record<string, unknown> = {};
    if (role_id) updates.role_id = role_id;
    // Whitelist — the DB enum also accepts 'owner', so an unchecked
    // value would let an admin promote themselves to owner.
    if (workspace_role) {
      if (!['admin', 'member', 'viewer'].includes(workspace_role)) {
        return NextResponse.json(
          { error: 'workspace_role must be "admin", "member", or "viewer"' },
          { status: 400 }
        );
      }
      updates.role = workspace_role;
    }

    const adminClient = createAdminClient();

    // An explicit null means "reset to the workspace default", not "strip
    // all permissions": a NULL role_id fails closed against every
    // RESTRICTIVE CRUD policy and leaves the member unable to read
    // anything, which is never what clearing a role is meant to do.
    if (role_id === null) {
      const targetDbRole = (workspace_role
        ?? (await adminClient
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspace_id)
          .eq('id', member_id)
          .maybeSingle()).data?.role
        ?? 'member') as WorkspaceDbRole;

      const { data: fallbackRole } = await adminClient
        .from('workspace_roles')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('is_system', true)
        .eq('name', defaultSystemRoleName(targetDbRole))
        .maybeSingle();

      if (!fallbackRole) {
        return NextResponse.json(
          {
            error: `This workspace has no built-in "${defaultSystemRoleName(targetDbRole)}" role to fall back to. Assign a role_id explicitly.`,
          },
          { status: 409 }
        );
      }
      updates.role_id = fallbackRole.id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await adminClient
      .from('workspace_members')
      .update(updates)
      .eq('id', member_id)
      .eq('workspace_id', workspace_id)
      .neq('role', 'owner'); // never demote owner

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[workspace/users PATCH] unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/users
 * Owner removes a team member from a workspace.
 *
 * Body: { workspace_id, member_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, member_id } = body as {
      workspace_id?: string;
      member_id?: string;
    };

    if (!workspace_id || !member_id) {
      return NextResponse.json(
        { error: 'workspace_id and member_id are required' },
        { status: 400 }
      );
    }

    const auth = await verifyWorkspaceAdmin(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('workspace_members')
      .delete()
      .eq('id', member_id)
      .eq('workspace_id', workspace_id)
      .neq('role', 'owner'); // can't remove the owner

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[workspace/users DELETE] unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
