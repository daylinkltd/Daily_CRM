import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodaysPostingSummary } from '@/lib/marketing/calendar-notifications';
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

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this workspace' }, { status: 403 });
    }

    // Determine timezone: query param > workspace marketing_settings > default
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

    // Fetch workspace disconnected channels if any
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

    // Fetch all active/scheduled posts in the workspace
    const { data: posts, error: postsError } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true });

    if (postsError) {
      console.warn('[MarketingCalendarTodayAPI] Error fetching posts:', postsError.message);
    }

    const summary = getTodaysPostingSummary(
      posts || [],
      effectiveTimezone,
      new Date(),
      disconnectedChannels
    );

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('[MarketingCalendarTodayAPI] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch today posting summary' }, { status: 500 });
  }
}
