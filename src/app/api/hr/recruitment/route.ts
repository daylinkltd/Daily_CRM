import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const [jobsRes, candidatesRes, appsRes] = await Promise.all([
      supabase.from('hr_recruitment_jobs').select('*, department:departments(name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('hr_candidates').select('*').eq('workspace_id', workspaceId),
      supabase.from('hr_job_applications').select('*, job:hr_recruitment_jobs(*), candidate:hr_candidates(*)').eq('workspace_id', workspaceId)
    ]);

    return NextResponse.json({
      jobs: jobsRes.data || [],
      candidates: candidatesRes.data || [],
      applications: appsRes.data || []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    if (action === 'CREATE_JOB') {
      const { title, departmentId, location, employmentType, experienceLevel, jobDescription } = body;
      const { data: job, error } = await supabase
        .from('hr_recruitment_jobs')
        .insert({
          workspace_id: workspaceId,
          title,
          department_id: departmentId || null,
          location: location || 'Remote / Hybrid',
          employment_type: employmentType || 'FULL_TIME',
          experience_level: experienceLevel || 'Mid-Senior',
          job_description: jobDescription || '',
          status: 'OPEN'
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ job });
    }

    if (action === 'ADD_CANDIDATE') {
      const { jobId, fullName, email, phone, resumeUrl } = body;

      // 1. Insert or get candidate
      const { data: cand } = await supabase
        .from('hr_candidates')
        .upsert({
          workspace_id: workspaceId,
          full_name: fullName,
          email,
          phone: phone || null,
          resume_url: resumeUrl || null
        }, { onConflict: 'workspace_id,email' })
        .select()
        .single();

      if (!cand) return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });

      // 2. Create Application
      const { data: app, error } = await supabase
        .from('hr_job_applications')
        .insert({
          workspace_id: workspaceId,
          job_id: jobId,
          candidate_id: cand.id,
          stage: 'APPLIED',
          stage_changed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ candidate: cand, application: app });
    }

    if (action === 'MOVE_STAGE') {
      const { applicationId, newStage } = body;
      // Scoped by workspace as well as id. RLS already prevents reaching
      // another tenant's row, but relying on that alone means a mistyped id
      // is indistinguishable from a permission failure.
      const { data: rows, error } = await supabase
        .from('hr_job_applications')
        .update({
          stage: newStage,
          stage_changed_at: new Date().toISOString()
        })
        .eq('id', applicationId)
        .eq('workspace_id', workspaceId)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Supabase reports success on a zero-row update, so distinguish
      // "gone" from "RLS refused" the same way DELETE does below.
      if (!rows || rows.length === 0) {
        const { data: stillThere } = await supabase
          .from('hr_job_applications')
          .select('id')
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        return stillThere
          ? NextResponse.json(
              {
                error:
                  'You do not have permission to move this application. It needs the "people_manage" permission on this workspace.',
              },
              { status: 403 }
            )
          : NextResponse.json(
              { error: 'That application no longer exists' },
              { status: 404 }
            );
      }
      return NextResponse.json({ application: rows[0] });
    }

    if (action === 'DELETE_APPLICATION') {
      const { applicationId } = body;
      const { data: rows, error } = await supabase
        .from('hr_job_applications')
        .delete()
        .eq('id', applicationId)
        .eq('workspace_id', workspaceId)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!rows || rows.length === 0) {
        // Zero rows has two very different causes and Supabase reports both
        // as success: the row is gone, or RLS filtered the DELETE away. Read
        // it back to tell them apart — "no longer exists" on a row the user
        // can plainly still see is the least useful message possible.
        const { data: stillThere } = await supabase
          .from('hr_job_applications')
          .select('id')
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        return stillThere
          ? NextResponse.json(
              {
                error:
                  'You do not have permission to remove this application. It needs the "people_manage" permission on this workspace.',
              },
              { status: 403 }
            )
          : NextResponse.json(
              { error: 'That application no longer exists' },
              { status: 404 }
            );
      }
      // The candidate row is intentionally left alone: a person can apply
      // to more than one opening, so removing an application must not
      // delete the human from the ATS.
      return NextResponse.json({ deleted: applicationId });
    }

    if (action === 'UPDATE_APPLICATION') {
      const { applicationId, candidateId, fullName, email, phone, jobId, stage } = body;

      // The candidate's details live on hr_candidates; the opening and
      // stage live on the application. An edit usually touches both, so
      // this action updates each side rather than making the UI do two
      // round trips that can half-fail.
      if (candidateId && (fullName || email || phone)) {
        const candidatePatch: Record<string, unknown> = {};
        if (fullName !== undefined) candidatePatch.full_name = fullName;
        if (email !== undefined) candidatePatch.email = email || null;
        if (phone !== undefined) candidatePatch.phone = phone || null;

        const { data: candRows, error: candErr } = await supabase
          .from('hr_candidates')
          .update(candidatePatch)
          .eq('id', candidateId)
          .eq('workspace_id', workspaceId)
          .select();
        if (candErr) {
          return NextResponse.json({ error: candErr.message }, { status: 500 });
        }
        if (!candRows || candRows.length === 0) {
          return NextResponse.json(
            { error: 'Could not update the candidate — you may not have permission.' },
            { status: 403 }
          );
        }
      }

      const appPatch: Record<string, unknown> = {};
      if (jobId !== undefined) appPatch.job_id = jobId;
      if (stage !== undefined) {
        appPatch.stage = stage;
        appPatch.stage_changed_at = new Date().toISOString();
      }

      if (Object.keys(appPatch).length > 0) {
        const { data: appRows, error: appErr } = await supabase
          .from('hr_job_applications')
          .update(appPatch)
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .select();
        if (appErr) {
          return NextResponse.json({ error: appErr.message }, { status: 500 });
        }
        if (!appRows || appRows.length === 0) {
          return NextResponse.json(
            { error: 'Could not update the application — you may not have permission.' },
            { status: 403 }
          );
        }
      }

      return NextResponse.json({ updated: applicationId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
