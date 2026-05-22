import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/saas-admin/tenants
 * Permanently deletes ALL non-super_admin users + their workspaces.
 * Requires: authenticated super_admin session.
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Verify caller is super_admin
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();

    // 2. Get all non-super_admin profiles
    const { data: tenantProfiles, error: fetchError } = await admin
      .from('profiles')
      .select('user_id, email')
      .neq('system_role', 'super_admin');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!tenantProfiles || tenantProfiles.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No tenants to delete.' });
    }

    let deleted = 0;
    const errors: string[] = [];

    // 3. Delete each tenant auth account (cascades profile + workspace_members via FK)
    for (const p of tenantProfiles) {
      const { error: delError } = await admin.auth.admin.deleteUser(p.user_id);
      if (delError) {
        errors.push(`${p.email}: ${delError.message}`);
      } else {
        deleted++;
      }
    }

    // 4. Clean up any orphaned workspaces not owned by super_admin
    //    (just in case FK cascades didn't catch everything)
    const { error: wsError } = await admin
      .from('workspaces')
      .delete()
      .not(
        'id',
        'in',
        `(SELECT workspace_id FROM workspace_members wm
           JOIN profiles p ON p.user_id = wm.user_id
           WHERE p.system_role = 'super_admin')`
      );

    // wsError is non-fatal — log it but proceed
    if (wsError) {
      console.warn('[delete-tenants] Workspace cleanup warn:', wsError.message);
    }

    return NextResponse.json({
      success: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[delete-tenants] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
