import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { count, error } = await supabase
      .from('marketing_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('read_at', null)
      .or(`recipient_user_id.is.null,recipient_user_id.eq.${user.id}`);

    if (error) {
      return NextResponse.json({ unreadCount: 0 });
    }

    return NextResponse.json({ unreadCount: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching unread count' }, { status: 500 });
  }
}
