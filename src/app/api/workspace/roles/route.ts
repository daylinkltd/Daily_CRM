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
 * Owner updates a custom role's name, description, or permissions.
 *
 * Body: { workspace_id, role_id, name?, description?, permissions? }
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

    const updates: Record<string, unknown> = {};
    if (name?.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (permissions) updates.permissions = permissions;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('workspace_roles')
      .update(updates)
      .eq('id', role_id)
      .eq('workspace_id', workspace_id)
      .eq('is_system', false) // never touch system roles via API
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

    // Check: no members assigned this role
    const { count } = await adminClient
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
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
