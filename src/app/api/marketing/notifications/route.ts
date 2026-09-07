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
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id query parameter is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('marketing_notifications')
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`recipient_user_id.is.null,recipient_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data: notifications, error } = await query;

    if (error) {
      // Table might not be migrated yet or empty
      console.warn('[MarketingNotificationsAPI] Query warning:', error.message);
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        total: 0,
      });
    }

    const mapped = (notifications || []).map((n: any) => ({
      id: n.id,
      workspace_id: n.workspace_id,
      recipient_user_id: n.recipient_user_id,
      title: n.title,
      message: n.message,
      type: n.type,
      severity: n.severity || 'INFO',
      targetId: n.related_post_id,
      related_post_id: n.related_post_id,
      related_calendar_event_id: n.related_calendar_event_id,
      metadata: n.metadata || {},
      dedupe_key: n.dedupe_key,
      isRead: Boolean(n.read_at),
      read_at: n.read_at,
      createdAt: n.created_at,
      created_at: n.created_at,
    }));

    const unreadCount = mapped.filter((n: any) => !n.isRead).length;

    return NextResponse.json({
      notifications: mapped,
      unreadCount,
      total: mapped.length,
    });
  } catch (err: any) {
    console.error('[MarketingNotificationsAPI] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
