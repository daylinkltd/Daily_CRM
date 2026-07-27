import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    let query = supabase
      .from('hr_policies')
      .select(`
        *,
        owner:workspace_members!hr_policies_owner_workspace_member_id_fkey(
          id, user_id
        ),
        versions:hr_policy_versions(*),
        targets:hr_policy_targets(*)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Two-step profile enrichment
    const policies = data || [];
    const ownerUserIds = policies.map((p: any) => p.owner?.user_id).filter(Boolean);
    if (ownerUserIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', ownerUserIds);
      const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
      policies.forEach((p: any) => {
        if (p.owner?.user_id) p.owner.profiles = profileMap[p.owner.user_id] || null;
      });
    }

    return NextResponse.json({ policies });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      workspaceId,
      title,
      category,
      content,
      changeSummary,
      mandatory,
      effectiveAt,
      expiresAt,
      ownerId,
      linkedModule,
      linkedEntityId,
      targets // Array of { target_type, target_id }
    } = body;

    if (!workspaceId || !title || !category || !content) {
      return NextResponse.json({ error: 'Title, category, and content are required' }, { status: 400 });
    }

    // 1. Create Policy Header
    const { data: policy, error: policyErr } = await supabase
      .from('hr_policies')
      .insert({
        workspace_id: workspaceId,
        title,
        category,
        owner_workspace_member_id: ownerId || null,
        linked_module: linkedModule || 'NONE',
        linked_entity_id: linkedEntityId || null,
        status: 'DRAFT'
      })
      .select()
      .single();

    if (policyErr) {
      return NextResponse.json({ error: policyErr.message }, { status: 500 });
    }

    // 2. Create Initial Version 1 Draft
    const { data: version, error: versionErr } = await supabase
      .from('hr_policy_versions')
      .insert({
        workspace_id: workspaceId,
        policy_id: policy.id,
        version_number: 1,
        content,
        change_summary: changeSummary || 'Initial Draft',
        mandatory: !!mandatory,
        effective_at: effectiveAt || null,
        expires_at: expiresAt || null
      })
      .select()
      .single();

    if (versionErr) {
      return NextResponse.json({ error: versionErr.message }, { status: 500 });
    }

    // 3. Insert Audience Targets if provided
    if (Array.isArray(targets) && targets.length > 0) {
      const targetRows = targets.map((t: any) => ({
        workspace_id: workspaceId,
        policy_id: policy.id,
        target_type: t.target_type,
        target_id: t.target_id
      }));

      await supabase.from('hr_policy_targets').insert(targetRows);
    }

    return NextResponse.json({ policy, version });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
