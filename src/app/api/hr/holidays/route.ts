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

    const { data: holidays, error } = await supabase
      .from('hr_holidays')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holidays: holidays || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, title, date, holidayType, recurrenceType, description } = body;

    if (!workspaceId || !title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    const { data: holiday, error } = await supabase
      .from('hr_holidays')
      .insert({
        workspace_id: workspaceId,
        title,
        date,
        holiday_type: holidayType || 'COMPANY',
        recurrence_type: recurrenceType || 'YEARLY',
        description: description || ''
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ holiday });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
