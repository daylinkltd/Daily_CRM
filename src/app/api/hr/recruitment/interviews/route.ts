import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const applicationId = searchParams.get('applicationId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    let query = admin
      .from('hr_interviews')
      .select(`
        *,
        application:hr_job_applications(
          id,
          stage,
          candidate:hr_candidates(id, full_name, email, phone, resume_url),
          job:hr_recruitment_jobs(id, title)
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true });

    if (applicationId) {
      query = query.eq('application_id', applicationId);
    }

    const { data: interviews, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ interviews: interviews || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, applicationId, interviewerMemberId, interviewType, scheduledAt } = body;

    if (!workspaceId || !applicationId || !scheduledAt) {
      return NextResponse.json({ error: 'workspaceId, applicationId, and scheduledAt are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: interview, error } = await admin
      .from('hr_interviews')
      .insert({
        workspace_id: workspaceId,
        application_id: applicationId,
        interviewer_member_id: interviewerMemberId || null,
        interview_type: interviewType || 'TECHNICAL',
        scheduled_at: scheduledAt,
        rating: null,
        feedback_notes: null,
        decision: 'PENDING',
      })
      .select(`
        *,
        application:hr_job_applications(
          id,
          stage,
          candidate:hr_candidates(id, full_name, email, phone, resume_url),
          job:hr_recruitment_jobs(id, title)
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Automatically update candidate application stage to INTERVIEW
    await admin
      .from('hr_job_applications')
      .update({ stage: 'INTERVIEW', stage_changed_at: new Date().toISOString() })
      .eq('id', applicationId);

    return NextResponse.json({ interview });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, workspaceId, rating, feedbackNotes, decision, scheduledAt, interviewerMemberId, interviewType } = body;

    if (!id || !workspaceId) {
      return NextResponse.json({ error: 'id and workspaceId are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const patch: Record<string, any> = {};
    if (rating !== undefined) patch.rating = rating ? Number(rating) : null;
    if (feedbackNotes !== undefined) patch.feedback_notes = feedbackNotes;
    if (decision !== undefined) patch.decision = decision;
    if (scheduledAt !== undefined) patch.scheduled_at = scheduledAt;
    if (interviewerMemberId !== undefined) patch.interviewer_member_id = interviewerMemberId || null;
    if (interviewType !== undefined) patch.interview_type = interviewType;

    const { data: updated, error } = await admin
      .from('hr_interviews')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        application:hr_job_applications(
          id,
          stage,
          candidate:hr_candidates(id, full_name, email, phone, resume_url),
          job:hr_recruitment_jobs(id, title)
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ interview: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
