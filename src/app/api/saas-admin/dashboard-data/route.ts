import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/saas-admin/dashboard-data
 * Returns all workspaces, profiles, and prospects for the admin dashboard.
 * Requires super_admin session — uses admin client to bypass RLS.
 */
export async function GET(request: NextRequest) {
  try {
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

    // Fetch all in parallel
    const [profilesRes, workspacesRes, membersRes, prospectsRes] = await Promise.all([
      admin.from('profiles').select('*').order('created_at', { ascending: false }),
      admin.from('workspaces').select('id, name, plan, plan_limits, created_at').order('created_at', { ascending: false }),
      admin.from('workspace_members').select('workspace_id'),
      admin.from('prospects').select('*').order('created_at', { ascending: false }),
    ]);

    // Build member counts
    const memberCounts: Record<string, number> = {};
    (membersRes.data || []).forEach(m => {
      memberCounts[m.workspace_id] = (memberCounts[m.workspace_id] || 0) + 1;
    });

    const workspaces = (workspacesRes.data || []).map(w => ({
      ...w,
      member_count: memberCounts[w.id] || 0,
    }));

    return NextResponse.json({
      profiles: profilesRes.data || [],
      workspaces,
      prospects: prospectsRes.data || [],
      errors: {
        profiles: profilesRes.error?.message,
        workspaces: workspacesRes.error?.message,
        prospects: prospectsRes.error?.message,
      },
    });
  } catch (err: any) {
    console.error('[dashboard-data]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
