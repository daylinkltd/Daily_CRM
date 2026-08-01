import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: policy, error } = await supabase
      .from('hr_policies')
      .select(`
        *,
        owner:workspace_members!hr_policies_owner_workspace_member_id_fkey(
          id, user_id
        ),
        versions:hr_policy_versions(*),
        targets:hr_policy_targets(*),
        acknowledgements:hr_policy_acknowledgements(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Two-step: enrich owner with profile data
    if (policy?.owner?.user_id) {
      const { data: profileData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').eq('user_id', policy.owner.user_id).single();
      if (profileData) policy.owner.profiles = profileData;
    }

    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const {
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
      targets,
      isNewVersion
    } = body;

    // 1. Fetch current policy header & latest version
    const { data: existingPolicy, error: fetchErr } = await supabase
      .from('hr_policies')
      .select(`*, versions:hr_policy_versions(*)`)
      .eq('id', id)
      .single();

    if (fetchErr || !existingPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // 2. Update Header
    await supabase.from('hr_policies').update({
      title: title || existingPolicy.title,
      category: category || existingPolicy.category,
      owner_workspace_member_id: ownerId !== undefined ? ownerId : existingPolicy.owner_workspace_member_id,
      linked_module: linkedModule || existingPolicy.linked_module,
      linked_entity_id: linkedEntityId !== undefined ? linkedEntityId : existingPolicy.linked_entity_id,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    // 3. Handle Version creation or update
    const currentVersions = existingPolicy.versions || [];
    const maxVersionNum = currentVersions.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
    const latestVersionObj = currentVersions.find((v: any) => v.version_number === maxVersionNum);

    if (existingPolicy.status === 'PUBLISHED' || isNewVersion) {
      // Create new draft version (Immutable published rules)
      const newVerNum = maxVersionNum + 1;
      await supabase.from('hr_policy_versions').insert({
        workspace_id: existingPolicy.workspace_id,
        policy_id: id,
        version_number: newVerNum,
        content: content || latestVersionObj?.content,
        change_summary: changeSummary || `Version ${newVerNum} Update`,
        mandatory: mandatory !== undefined ? mandatory : latestVersionObj?.mandatory,
        effective_at: effectiveAt || latestVersionObj?.effective_at,
        expires_at: expiresAt || latestVersionObj?.expires_at
      });

      // Reset policy status back to DRAFT or PENDING_APPROVAL for new version review
      await supabase.from('hr_policies').update({ status: 'DRAFT' }).eq('id', id);
    } else if (latestVersionObj) {
      // Update existing draft version
      await supabase.from('hr_policy_versions').update({
        content: content || latestVersionObj.content,
        change_summary: changeSummary || latestVersionObj.change_summary,
        mandatory: mandatory !== undefined ? mandatory : latestVersionObj.mandatory,
        effective_at: effectiveAt || latestVersionObj.effective_at,
        expires_at: expiresAt || latestVersionObj.expires_at
      }).eq('id', latestVersionObj.id);
    }

    // 4. Update Target Audience if provided
    if (Array.isArray(targets)) {
      await supabase.from('hr_policy_targets').delete().eq('policy_id', id);
      if (targets.length > 0) {
        const targetRows = targets.map((t: any) => ({
          workspace_id: existingPolicy.workspace_id,
          policy_id: id,
          target_type: t.target_type,
          target_id: t.target_id
        }));
        await supabase.from('hr_policy_targets').insert(targetRows);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Cascading delete targets, versions, acknowledgements, and policy header
    await supabase.from('hr_policy_acknowledgements').delete().eq('policy_id', id);
    await supabase.from('hr_policy_targets').delete().eq('policy_id', id);
    await supabase.from('hr_policy_versions').delete().eq('policy_id', id);
    const { error } = await supabase.from('hr_policies').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete policy' }, { status: 500 });
  }
}
