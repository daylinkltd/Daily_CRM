import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_GROWTH_LIMITS = {
  max_members: 20,
  max_workspaces: 2,
  max_storage_gb: 5,
  channels: ['whatsapp', 'instagram', 'messenger', 'email'],
  max_automations: null,
};

/**
 * POST /api/saas-admin/create-owner
 *
 * Body: { full_name, email, password, org_name, plan?, plan_limits? }
 *
 * Security:
 *  1. Caller must be authenticated AND have system_role = 'super_admin'
 *  2. Uses service-role to create auth.users entry (bypasses signup disabled)
 *  3. Calls create_owner_with_workspace RPC to seed root workspace + system roles
 *  4. Stores plan + plan_limits on the new workspace
 */
export async function POST(request: NextRequest) {
  try {
    // --- 1. Authenticate caller ---
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- 2. Verify super_admin system role ---
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || profile?.system_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin required' }, { status: 403 });
    }

    // --- 3. Parse & validate body ---
    const body = await request.json();
    const { full_name, email, password, org_name, plan, plan_limits } = body as {
      full_name?: string;
      email?: string;
      password?: string;
      org_name?: string;
      plan?: string;
      plan_limits?: Record<string, unknown>;
    };

    if (!full_name?.trim() || !email?.trim() || !password || !org_name?.trim()) {
      return NextResponse.json(
        { error: 'full_name, email, password, and org_name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const selectedPlan = plan === 'custom' ? 'custom' : 'growth';
    const effectiveLimits =
      selectedPlan === 'custom' && plan_limits ? plan_limits : DEFAULT_GROWTH_LIMITS;

    // --- 4. Create auth user via admin API ---
    const adminClient = createAdminClient();

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (createError) {
      if (createError.message?.includes('already been registered')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
      console.error('[create-owner] Auth create error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const ownerId = newUser.user.id;

    // --- 5. Create root workspace + seed system roles via SECURITY DEFINER RPC ---
    const { data: wsData, error: wsError } = await adminClient
      .rpc('create_owner_with_workspace', {
        p_user_id: ownerId,
        p_org_name: org_name.trim(),
      })
      .single();

    if (wsError) {
      await adminClient.auth.admin.deleteUser(ownerId);
      console.error('[create-owner] Workspace RPC error:', wsError);
      return NextResponse.json({ error: wsError.message }, { status: 500 });
    }

    const workspaceId = (wsData as any).workspace_id;

    // --- 6. Store plan + limits on the workspace ---
    if (workspaceId) {
      const { error: planError } = await adminClient
        .from('workspaces')
        .update({ plan: selectedPlan, plan_limits: effectiveLimits })
        .eq('id', workspaceId);

      if (planError) {
        console.warn('[create-owner] Plan update warn:', planError.message);
      }
    }

    return NextResponse.json({
      success: true,
      owner_id: ownerId,
      workspace_id: workspaceId,
      workspace_name: (wsData as any).workspace_name,
      plan: selectedPlan,
    });
  } catch (err: any) {
    console.error('[create-owner] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
