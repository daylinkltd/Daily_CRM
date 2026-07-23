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
      const { data: app, error } = await supabase
        .from('hr_job_applications')
        .update({
          stage: newStage,
          stage_changed_at: new Date().toISOString()
        })
        .eq('id', applicationId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ application: app });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
