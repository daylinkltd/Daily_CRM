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

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, status } = await request.json();
    if (!requestId || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'requestId and status (APPROVED|REJECTED) are required' }, { status: 400 });
    }

    const { data: existing, error: exErr } = await supabase
      .from('hr_employee_requests')
      .select('id, workspace_id, status')
      .eq('id', requestId)
      .single();
    if (exErr || !existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Deciding requests is an admin action.
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', existing.workspace_id)
      .eq('user_id', user.id)
      .single();
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Only workspace admins can decide requests' }, { status: 403 });
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: `Request is already ${existing.status.toLowerCase()}` }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('hr_employee_requests')
      .update({ status, assigned_to_employee_id: member.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
