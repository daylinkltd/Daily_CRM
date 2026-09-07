import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runCalendarNotificationJob } from '@/lib/marketing/calendar-notifications';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Execute the real production job for this authenticated workspace
    const result = await runCalendarNotificationJob(supabase, workspace_id, new Date());

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[MarketingJobRunAPI] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to run notification job' }, { status: 500 });
  }
}
