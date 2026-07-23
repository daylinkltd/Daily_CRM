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

    const { data: requests, error } = await supabase
      .from('hr_employee_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspaceId, employeeId, requestType, detailsJson, notes } = body;

    if (!workspaceId || !employeeId || !requestType) {
      return NextResponse.json({ error: 'workspaceId, employeeId, and requestType are required' }, { status: 400 });
    }

    const { data: req, error } = await supabase
      .from('hr_employee_requests')
      .insert({
        workspace_id: workspaceId,
        hr_employee_id: employeeId,
        request_type: requestType,
        details_json: detailsJson || {},
        notes: notes || '',
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: req });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
