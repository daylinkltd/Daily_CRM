import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTodaysPostingSummary,
  createPostingTodayNotificationPayload,
  createUpcomingReminderNotificationPayload,
  createMissingMediaNotificationPayload,
  getLocalDateString,
  getLocalTimeString,
  getMinutesUntil,
  buildMissedPostDedupeKey,
} from '@/lib/marketing/calendar-notifications';

export async function POST(request: Request) {
  try {
    const suppliedSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.AUTOMATION_CRON_SECRET;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Must match cron secret OR be authenticated user
    const isCronAuthorized = expectedSecret && suppliedSecret === expectedSecret;
    const isUserAuthorized = Boolean(user);

    if (!isCronAuthorized && !isUserAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: invalid cron secret or session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetWorkspaceId = body.workspace_id || new URL(request.url).searchParams.get('workspace_id');

    // Get list of workspaces to sweep
    let workspacesQuery = supabase.from('workspaces').select('id, name');
    if (targetWorkspaceId) {
      workspacesQuery = workspacesQuery.eq('id', targetWorkspaceId);
    }
    const { data: workspaces, error: wsError } = await workspacesQuery;

    if (wsError || !workspaces || workspaces.length === 0) {
      return NextResponse.json({ message: 'No workspaces to process', processed: 0 });
    }

    const now = new Date();
    let totalCreated = 0;
    let totalSkipped = 0;
    const logs: string[] = [];

    for (const ws of workspaces) {
      try {
        // Fetch workspace settings
        const { data: mktSettings } = await supabase
          .from('marketing_settings')
          .select('default_timezone')
          .eq('workspace_id', ws.id)
          .maybeSingle();

        const timezone = mktSettings?.default_timezone || 'Asia/Kolkata';
        const localDateStr = getLocalDateString(now, timezone);
        const localTimeStr = getLocalTimeString(now, timezone); // e.g. "09:15"

        // Fetch preferences for workspace members
        const { data: prefsList } = await supabase
          .from('marketing_notification_preferences')
          .select('*')
          .eq('workspace_id', ws.id);

        const defaultPrefs = {
          posting_reminders_enabled: true,
          daily_summary_enabled: true,
          daily_summary_time: '09:00',
          upcoming_reminders_enabled: true,
          upcoming_timing_minutes: 30,
          missing_media_enabled: true,
        };

        // Fetch all active posts in workspace
        const { data: posts } = await supabase
          .from('marketing_posts')
          .select('*')
          .eq('workspace_id', ws.id);

        if (!posts || posts.length === 0) continue;

        // 1. DAILY POSTING SUMMARY (Once per day per workspace/user after configured time)
        const summary = getTodaysPostingSummary(posts, timezone, now);
        if (summary.totalScheduled > 0) {
          const pref = prefsList?.[0] || defaultPrefs;
          if (pref.posting_reminders_enabled && pref.daily_summary_enabled) {
            const configuredTime = pref.daily_summary_time || '09:00';
            if (localTimeStr >= configuredTime) {
              const notifPayload = createPostingTodayNotificationPayload(ws.id, summary);
              const { error: insertErr } = await supabase
                .from('marketing_notifications')
                .insert({
                  workspace_id: ws.id,
                  recipient_user_id: null,
                  type: notifPayload.type,
                  severity: notifPayload.severity,
                  title: notifPayload.title,
                  message: notifPayload.message,
                  metadata: notifPayload.metadata,
                  dedupe_key: notifPayload.dedupe_key,
                });

              if (!insertErr) {
                totalCreated += 1;
                logs.push(`Daily summary created for workspace ${ws.id}`);
              } else {
                totalSkipped += 1; // Duplicate key prevented re-creation
              }
            }
          }
        }

        // 2. UPCOMING POST REMINDERS (X minutes before scheduled_at)
        for (const post of posts) {
          if (post.status === 'published' || post.status === 'cancelled') continue;
          const scheduledTimestamp = post.scheduled_at || (post.date && post.time ? `${post.date}T${post.time}:00Z` : null);
          if (!scheduledTimestamp) continue;

          const minutesUntil = getMinutesUntil(scheduledTimestamp, now);
          const prefTiming = prefsList?.[0]?.upcoming_timing_minutes || 30;

          // If post is within [0, prefTiming] window
          if (minutesUntil > 0 && minutesUntil <= prefTiming) {
            const notifPayload = createUpcomingReminderNotificationPayload(
              ws.id,
              { ...post, scheduled_at: scheduledTimestamp },
              prefTiming,
              timezone
            );

            const { error: insertErr } = await supabase
              .from('marketing_notifications')
              .insert({
                workspace_id: ws.id,
                recipient_user_id: post.creator_id || null,
                related_post_id: post.id,
                type: notifPayload.type,
                severity: notifPayload.severity,
                title: notifPayload.title,
                message: notifPayload.message,
                metadata: notifPayload.metadata,
                dedupe_key: notifPayload.dedupe_key,
              });

            if (!insertErr) {
              totalCreated += 1;
              logs.push(`Upcoming reminder created for post ${post.id}`);
            } else {
              totalSkipped += 1;
            }
          }

          // 3. MISSED POST DETECTION
          const postDate = new Date(scheduledTimestamp);
          const isPast = postDate.getTime() < (now.getTime() - 2 * 60 * 1000); // 2 min buffer
          if (isPast && (post.status === 'approved' || post.status === 'scheduled')) {
            const dedupeKey = buildMissedPostDedupeKey(post.id, localDateStr);
            const { error: insertErr } = await supabase
              .from('marketing_notifications')
              .insert({
                workspace_id: ws.id,
                recipient_user_id: post.creator_id || null,
                related_post_id: post.id,
                type: 'POST_MISSED',
                severity: 'ERROR',
                title: 'Scheduled Post Missed',
                message: `Post "${post.title || 'Untitled'}" scheduled for ${getLocalDateString(scheduledTimestamp, timezone)} was not published.`,
                dedupe_key: dedupeKey,
              });

            if (!insertErr) {
              totalCreated += 1;
              logs.push(`Missed post notification created for post ${post.id}`);
            } else {
              totalSkipped += 1;
            }
          }

          // 4. MISSING MEDIA DETECTION
          const visualChannels = ['instagram', 'tiktok', 'youtube'];
          const requiresMedia = post.channels?.some((c: string) => visualChannels.includes(c));
          const hasMedia = Boolean(post.media_url || (post.media_urls && post.media_urls.length > 0));
          if (requiresMedia && !hasMedia && post.status !== 'draft') {
            const notifPayload = createMissingMediaNotificationPayload(ws.id, {
              ...post,
              scheduled_at: scheduledTimestamp,
            });

            const { error: insertErr } = await supabase
              .from('marketing_notifications')
              .insert({
                workspace_id: ws.id,
                recipient_user_id: post.creator_id || null,
                related_post_id: post.id,
                type: notifPayload.type,
                severity: notifPayload.severity,
                title: notifPayload.title,
                message: notifPayload.message,
                dedupe_key: notifPayload.dedupe_key,
              });

            if (!insertErr) totalCreated += 1;
            else totalSkipped += 1;
          }
        }
      } catch (wsProcessErr) {
        console.warn(`[MarketingCron] Error processing workspace ${ws.id}:`, wsProcessErr);
      }
    }

    return NextResponse.json({
      success: true,
      workspacesProcessed: workspaces.length,
      notificationsCreated: totalCreated,
      notificationsSkipped: totalSkipped,
      logs,
    });
  } catch (err: any) {
    console.error('[MarketingCron] Fatal error:', err);
    return NextResponse.json({ error: err.message || 'Cron execution failed' }, { status: 500 });
  }
}
