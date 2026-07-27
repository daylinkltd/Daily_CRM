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

    // 4. Clean up workspaces that now have NO members at all (FK
    //    cascades removed the memberships with the users). PostgREST
    //    can't evaluate a SQL subquery inside .not('id','in',...) —
    //    the previous version passed one as a string, which either
    //    errored (cleanup silently never ran) or, worse, would treat
    //    the literal as a value list and match EVERY workspace for
    //    deletion. Resolve the member-owned ids first, then delete
    //    only true orphans.
    const { data: memberRows, error: memberErr } = await admin
      .from('workspace_members')
      .select('workspace_id');

    if (memberErr) {
      console.warn('[delete-tenants] Workspace cleanup skipped:', memberErr.message);
    } else {
      const ownedIds = [
        ...new Set((memberRows ?? []).map((m) => m.workspace_id).filter(Boolean)),
      ];
      let orphanQuery = admin.from('workspaces').delete();
      if (ownedIds.length > 0) {
        orphanQuery = orphanQuery.not(
          'id',
          'in',
          `(${ownedIds.join(',')})`
        );
      }
      const { error: wsError } = await orphanQuery;
      // wsError is non-fatal — log it but proceed
      if (wsError) {
        console.warn('[delete-tenants] Workspace cleanup warn:', wsError.message);
      }
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
