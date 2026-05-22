import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/saas-admin/users/[id]
 * SaaS Admin blocks or unblocks any user (including owners).
 * When an owner is blocked, the is_owner_blocked RLS function cascades
 * and denies all workspace data access to all tenant members.
 *
 * Body: { action: 'block' | 'unblock' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;

    // Authenticate caller
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.system_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin required' }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action as 'block' | 'unblock';
    if (!action || !['block', 'unblock'].includes(action)) {
      return NextResponse.json({ error: 'action must be "block" or "unblock"' }, { status: 400 });
    }

    // Prevent self-block
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot block your own account' }, { status: 400 });
    }

    const newStatus = action === 'block' ? 'blocked' : 'active';
    const adminClient = createAdminClient();

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ status: newStatus })
      .eq('user_id', targetUserId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('[saas-admin/users PATCH]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/saas-admin/users/[id]
 * SaaS Admin permanently deletes a user (removes auth.users entry).
 * Cascades: workspace_members, profiles all deleted via FK.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.system_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin required' }, { status: 403 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[saas-admin/users DELETE]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
