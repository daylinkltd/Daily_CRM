import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyOwner(workspaceId: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (member?.role !== 'owner') {
    return { error: 'Forbidden: owner role required', status: 403 };
  }
  return { error: null, status: 200 };
}

/**
 * POST /api/workspace/roles
 * Owner creates a custom ABAC role for their workspace.
 *
 * Body: { workspace_id, name, description?, permissions: Record<string, boolean> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, name, description, permissions } = body as {
      workspace_id?: string;
      name?: string;
      description?: string;
      permissions?: Record<string, boolean>;
    };

    if (!workspace_id || !name?.trim()) {
      return NextResponse.json(
        { error: 'workspace_id and name are required' },
        { status: 400 }
      );
    }

    const auth = await verifyOwner(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('workspace_roles')
      .insert({
        workspace_id,
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissions ?? {},
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `A role named "${name.trim()}" already exists in this workspace` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: data });
  } catch (err: any) {
    console.error('[workspace/roles POST]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workspace/roles
 * Owner updates a role's name, description, or permissions.
 *
 * Body: { workspace_id, role_id, name?, description?, permissions? }
 *
 * System roles (`is_system = true`) used to be rejected outright, which
 * made the built-in Viewer un-narrowable — an admin who wanted a
 * "CRM-only viewer" had to invent a parallel custom role. They are now
 * editable, but ONLY their `permissions` map: the name and description
 * are dropped from the update so Owner / Admin / Viewer can never be
 * renamed out from under the code that looks them up by name (migration
 * 074's seeding, `DEFAULT_ROLE_NAMES`, the members-tab enum mapping).
 * DELETE still refuses system roles entirely, and the owner gate is
 * unchanged.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, role_id, name, description, permissions } = body as {
      workspace_id?: string;
      role_id?: string;
      name?: string;
      description?: string;
      permissions?: Record<string, boolean>;
    };

    if (!workspace_id || !role_id) {
      return NextResponse.json(
        { error: 'workspace_id and role_id are required' },
        { status: 400 }
      );
    }

    const auth = await verifyOwner(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const adminClient = createAdminClient();

    // Is this a built-in role? Decides which fields may be written.
    const { data: existing, error: lookupError } = await adminClient
      .from('workspace_roles')
      .select('id, is_system')
      .eq('id', role_id)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (permissions) updates.permissions = permissions;
    if (!existing.is_system) {
      if (name?.trim()) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
    } else if (name !== undefined || description !== undefined) {
      // Be explicit rather than silently ignoring a rename attempt.
      return NextResponse.json(
        {
          error:
            'Built-in roles cannot be renamed or re-described — only their permissions can be changed.',
        },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('workspace_roles')
      .update(updates)
      .eq('id', role_id)
      .eq('workspace_id', workspace_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: data });
  } catch (err: any) {
    console.error('[workspace/roles PATCH]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/roles
 * Owner deletes a custom role. Rejects if system role or if members use it.
 *
 * Body: { workspace_id, role_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, role_id } = body as {
      workspace_id?: string;
      role_id?: string;
    };

    if (!workspace_id || !role_id) {
      return NextResponse.json(
        { error: 'workspace_id and role_id are required' },
        { status: 400 }
      );
    }

    const auth = await verifyOwner(workspace_id);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const adminClient = createAdminClient();

    // Built-ins are permanent. The `.eq('is_system', false)` filter below
    // would already no-op, but a silent 200 reads as a successful delete
    // in the UI — say so instead.
    const { data: existing } = await adminClient
      .from('workspace_roles')
      .select('is_system')
      .eq('id', role_id)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (existing?.is_system) {
      return NextResponse.json(
        { error: 'Built-in roles cannot be deleted.' },
        { status: 400 }
      );
    }

    // Check: no members assigned this role
    const { count } = await adminClient
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .eq('role_id', role_id);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role while members are assigned to it. Re-assign them first.' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('workspace_roles')
      .delete()
      .eq('id', role_id)
      .eq('workspace_id', workspace_id)
      .eq('is_system', false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[workspace/roles DELETE]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
