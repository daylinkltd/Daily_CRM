import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getNextScheduledPost } from '@/lib/marketing/calendar-notifications';
import type { SocialPlatform } from '@/types/calendar';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const requestedTimezone = searchParams.get('timezone');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id query parameter is required' }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let effectiveTimezone = requestedTimezone || 'Asia/Kolkata';
    try {
      const { data: settings } = await supabase
        .from('marketing_settings')
        .select('default_timezone')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (settings?.default_timezone && !requestedTimezone) {
        effectiveTimezone = settings.default_timezone;
      }
    } catch {
      // ignore
    }

    let disconnectedChannels: SocialPlatform[] = [];
    try {
      const { data: channels } = await supabase
        .from('marketing_social_channels')
        .select('platform, status, is_enabled')
        .eq('workspace_id', workspaceId);

      if (channels && channels.length > 0) {
        disconnectedChannels = channels
          .filter((c: any) => c.is_enabled && c.status !== 'connected')
          .map((c: any) => c.platform as SocialPlatform);
      }
    } catch {
      // ignore
    }

    const { data: posts } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('status', 'in', '("published","cancelled")')
      .order('scheduled_at', { ascending: true });

    const nextPost = getNextScheduledPost(
      posts || [],
      effectiveTimezone,
      new Date(),
      disconnectedChannels
    );

    return NextResponse.json({
      success: true,
      nextPost,
    });
  } catch (err: any) {
    console.error('[MarketingCalendarNextAPI] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch next post' }, { status: 500 });
  }
}
