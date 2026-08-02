import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertAffected } from '@/lib/supabase/affected-rows';

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

    // Every write below was previously fire-and-forget: the route returned
    // {success:true} unconditionally, so an RLS denial looked like a saved
    // policy. Each is now checked.
    // 2. Update Header
    const headerResult = await supabase.from('hr_policies').update({
      title: title || existingPolicy.title,
      category: category || existingPolicy.category,
      owner_workspace_member_id: ownerId !== undefined ? ownerId : existingPolicy.owner_workspace_member_id,
      linked_module: linkedModule || existingPolicy.linked_module,
      linked_entity_id: linkedEntityId !== undefined ? linkedEntityId : existingPolicy.linked_entity_id,
      updated_at: new Date().toISOString()
    }).eq('id', id).select('id');

    assertAffected(headerResult, 'the policy', 'save');

    // 3. Handle Version creation or update
    const currentVersions = existingPolicy.versions || [];
    const maxVersionNum = currentVersions.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
    const latestVersionObj = currentVersions.find((v: any) => v.version_number === maxVersionNum);

    if (existingPolicy.status === 'PUBLISHED' || isNewVersion) {
      // Create new draft version (Immutable published rules)
      const newVerNum = maxVersionNum + 1;
      const { error: versionErr } = await supabase.from('hr_policy_versions').insert({
        workspace_id: existingPolicy.workspace_id,
        policy_id: id,
        version_number: newVerNum,
        content: content || latestVersionObj?.content,
        change_summary: changeSummary || `Version ${newVerNum} Update`,
        mandatory: mandatory !== undefined ? mandatory : latestVersionObj?.mandatory,
        effective_at: effectiveAt || latestVersionObj?.effective_at,
        expires_at: expiresAt || latestVersionObj?.expires_at
      });

      // If the version insert fails, do NOT un-publish: resetting status to
      // DRAFT after a failed insert removed the policy from /policies and
      // from the compliance denominator with no replacement version.
      if (versionErr) {
        return NextResponse.json(
          { error: `Failed to create the new version: ${versionErr.message}` },
          { status: 500 }
        );
      }

      const statusResult = await supabase
        .from('hr_policies')
        .update({ status: 'DRAFT' })
        .eq('id', id)
        .select('id');
      assertAffected(statusResult, 'the policy status', 'update');
    } else if (latestVersionObj) {
      // Update existing draft version
      const { error: draftErr } = await supabase.from('hr_policy_versions').update({
        content: content || latestVersionObj.content,
        change_summary: changeSummary || latestVersionObj.change_summary,
        mandatory: mandatory !== undefined ? mandatory : latestVersionObj.mandatory,
        effective_at: effectiveAt || latestVersionObj.effective_at,
        expires_at: expiresAt || latestVersionObj.expires_at
      }).eq('id', latestVersionObj.id);
      if (draftErr) {
        return NextResponse.json({ error: draftErr.message }, { status: 500 });
      }
    }

    // 4. Update Target Audience if provided
    if (Array.isArray(targets)) {
      const { error: clearErr } = await supabase
        .from('hr_policy_targets').delete().eq('policy_id', id);
      if (clearErr) {
        return NextResponse.json({ error: clearErr.message }, { status: 500 });
      }
      if (targets.length > 0) {
        const targetRows = targets.map((t: any) => ({
          workspace_id: existingPolicy.workspace_id,
          policy_id: id,
          target_type: t.target_type,
          target_id: t.target_id
        }));
        const { error: targetErr } = await supabase
          .from('hr_policy_targets').insert(targetRows);
        if (targetErr) {
          return NextResponse.json({ error: targetErr.message }, { status: 500 });
        }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The policy header cascades to targets, versions and acknowledgements
    // (migration 050), so deleting the header is sufficient. The
    // acknowledgements are never deleted explicitly: they are the signed,
    // content-hashed compliance record and `hr_policy_acknowledgements` has
    // no DELETE policy, so that statement was always a silent no-op.
    const { data: deleted, error } = await supabase
      .from('hr_policies')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // An RLS denial removes zero rows without raising — without this check
    // the route reported success and the UI toasted "deleted" while the
    // policy was still there.
    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'Policy not found, or you do not have permission to delete it.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete policy' }, { status: 500 });
  }
}
