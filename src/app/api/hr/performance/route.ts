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

    const [cyclesRes, goalsRes, reviewsRes, promoRes] = await Promise.all([
      supabase.from('hr_review_cycles').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('hr_performance_goals').select('*').eq('workspace_id', workspaceId),
      supabase.from('hr_performance_reviews').select('*, cycle:hr_review_cycles(*)').eq('workspace_id', workspaceId),
      supabase.from('hr_employee_promotions').select('*, oldDesig:designations!hr_employee_promotions_old_designation_id_fkey(title), newDesig:designations!hr_employee_promotions_new_designation_id_fkey(title)').eq('workspace_id', workspaceId)
    ]);

    return NextResponse.json({
      cycles: cyclesRes.data || [],
      goals: goalsRes.data || [],
      reviews: reviewsRes.data || [],
      promotions: promoRes.data || []
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

    if (action === 'CREATE_CYCLE') {
      const { name, startDate, endDate } = body;
      const { data: cycle, error } = await supabase
        .from('hr_review_cycles')
        .insert({
          workspace_id: workspaceId,
          name,
          start_date: startDate,
          end_date: endDate,
          status: 'OPEN'
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ cycle });
    }

    if (action === 'CREATE_GOAL') {
      const { employeeId, title, description, targetDate } = body;
      const { data: goal, error } = await supabase
        .from('hr_performance_goals')
        .insert({
          workspace_id: workspaceId,
          hr_employee_id: employeeId,
          title,
          description: description || '',
          target_date: targetDate || null,
          progress_pct: 0,
          status: 'IN_PROGRESS'
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ goal });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
