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

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch parallel dashboard aggregates
    const [empRes, attRes, lveRes, reqRes, jobRes] = await Promise.all([
      supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('attendance_logs').select('id, status').eq('workspace_id', workspaceId).eq('date', todayStr),
      supabase.from('leave_requests').select('id, status').eq('workspace_id', workspaceId).eq('status', 'PENDING'),
      supabase.from('hr_employee_requests').select('id, status').eq('workspace_id', workspaceId).eq('status', 'PENDING'),
      supabase.from('hr_recruitment_jobs').select('id').eq('workspace_id', workspaceId).eq('status', 'OPEN')
    ]);

    const totalEmployees = empRes.count ?? 0;
    const presentToday = attRes.data?.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length || 0;
    const pendingLeaves = lveRes.data?.length || 0;
    const pendingRequests = reqRes.data?.length || 0;
    const openJobs = jobRes.data?.length || 0;

    return NextResponse.json({
      metrics: {
        totalEmployees,
        presentToday,
        onLeaveToday: totalEmployees > 0 ? Math.max(0, totalEmployees - presentToday) : 0,
        pendingApprovals: pendingLeaves + pendingRequests,
        pendingLeaves,
        pendingRequests,
        openJobs
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
