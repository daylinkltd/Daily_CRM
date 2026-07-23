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

    const [shiftsRes, assignRes] = await Promise.all([
      supabase.from('hr_shifts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('hr_shift_assignments').select('*, shift:hr_shifts(*), employee:hr_employees(*)').eq('workspace_id', workspaceId)
    ]);

    return NextResponse.json({
      shifts: shiftsRes.data || [],
      assignments: assignRes.data || []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, name, code, startTime, endTime, gracePeriod, isRotational, color } = body;

    if (!workspaceId || !name || !startTime || !endTime) {
      return NextResponse.json({ error: 'Name, startTime, and endTime are required' }, { status: 400 });
    }

    const { data: shift, error } = await supabase
      .from('hr_shifts')
      .insert({
        workspace_id: workspaceId,
        name,
        code: code || name.slice(0, 3).toUpperCase(),
        start_time: startTime,
        end_time: endTime,
        grace_period_minutes: parseInt(gracePeriod || '15'),
        is_rotational: !!isRotational,
        color: color || '#10b981'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shift });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
