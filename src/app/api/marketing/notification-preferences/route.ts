import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/marketing/calendar-notifications';
import type { MarketingNotificationPreferences } from '@/types/calendar';

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

    const { data: prefs, error } = await supabase
      .from('marketing_notification_preferences')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !prefs) {
      return NextResponse.json({
        preferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          workspace_id: workspaceId,
          user_id: user.id,
        },
      });
    }

    return NextResponse.json({
      preferences: {
        workspace_id: prefs.workspace_id,
        user_id: prefs.user_id,
        posting_reminders_enabled: prefs.posting_reminders_enabled ?? true,
        daily_summary_enabled: prefs.daily_summary_enabled ?? true,
        daily_summary_time: prefs.daily_summary_time || '09:00',
        upcoming_reminders_enabled: prefs.upcoming_reminders_enabled ?? true,
        upcoming_timing_minutes: prefs.upcoming_timing_minutes ?? 30,
        approval_notifications_enabled: prefs.approval_notifications_enabled ?? true,
        publishing_success_enabled: prefs.publishing_success_enabled ?? true,
        publishing_failure_enabled: prefs.publishing_failure_enabled ?? true,
        missing_media_enabled: prefs.missing_media_enabled ?? true,
        channels: prefs.channels || { in_app: true, email: false },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      posting_reminders_enabled = true,
      daily_summary_enabled = true,
      daily_summary_time = '09:00',
      upcoming_reminders_enabled = true,
      upcoming_timing_minutes = 30,
      approval_notifications_enabled = true,
      publishing_success_enabled = true,
      publishing_failure_enabled = true,
      missing_media_enabled = true,
      channels = { in_app: true, email: false },
    } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = {
      workspace_id,
      user_id: user.id,
      posting_reminders_enabled,
      daily_summary_enabled,
      daily_summary_time,
      upcoming_reminders_enabled,
      upcoming_timing_minutes,
      approval_notifications_enabled,
      publishing_success_enabled,
      publishing_failure_enabled,
      missing_media_enabled,
      channels,
    };

    const { data: saved, error } = await supabase
      .from('marketing_notification_preferences')
      .upsert(payload, { onConflict: 'workspace_id,user_id' })
      .select()
      .single();

    if (error) {
      console.warn('[MarketingNotifPrefsAPI] Upsert error (table may need migration):', error.message);
      return NextResponse.json({ preferences: payload });
    }

    return NextResponse.json({ preferences: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update preferences' }, { status: 500 });
  }
}
