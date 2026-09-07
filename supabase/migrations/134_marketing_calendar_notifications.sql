-- ============================================================
-- 134 — DailyBuz Marketing Hub: Calendar Notifications & Reminders
--
-- Adds multi-tenant tables for:
-- 1. `marketing_notifications` (Posting reminders, approval alerts, failure alerts)
-- 2. `marketing_notification_preferences` (Per-user & per-workspace reminder config)
--
-- Enforces:
-- - Strict workspace_id scoping with Row Level Security (RLS)
-- - Deterministic deduplication via (workspace_id, dedupe_key) index
-- ============================================================

-- 1. Marketing Notifications
CREATE TABLE IF NOT EXISTS public.marketing_notifications (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type                      TEXT NOT NULL,
  severity                  TEXT NOT NULL DEFAULT 'INFO'
                            CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  title                     TEXT NOT NULL,
  message                   TEXT NOT NULL,
  related_post_id           UUID REFERENCES public.marketing_posts(id) ON DELETE CASCADE,
  related_calendar_event_id TEXT,
  metadata                  JSONB DEFAULT '{}'::jsonb,
  dedupe_key                TEXT,
  read_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_notifications_workspace
  ON public.marketing_notifications (workspace_id);

CREATE INDEX IF NOT EXISTS idx_marketing_notifications_recipient
  ON public.marketing_notifications (workspace_id, recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_notifications_post
  ON public.marketing_notifications (workspace_id, related_post_id);

CREATE INDEX IF NOT EXISTS idx_marketing_notifications_read
  ON public.marketing_notifications (workspace_id, read_at);

CREATE INDEX IF NOT EXISTS idx_marketing_notifications_type
  ON public.marketing_notifications (workspace_id, type);

-- Unique index for deterministic deduplication per workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_notifications_dedupe
  ON public.marketing_notifications (workspace_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.marketing_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_notifications_select ON public.marketing_notifications;
CREATE POLICY marketing_notifications_select ON public.marketing_notifications
  FOR SELECT
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  );

DROP POLICY IF EXISTS marketing_notifications_modify ON public.marketing_notifications;
CREATE POLICY marketing_notifications_modify ON public.marketing_notifications
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS set_marketing_notifications_updated_at ON public.marketing_notifications;
CREATE TRIGGER set_marketing_notifications_updated_at
  BEFORE UPDATE ON public.marketing_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Marketing Notification Preferences
CREATE TABLE IF NOT EXISTS public.marketing_notification_preferences (
  workspace_id                     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  posting_reminders_enabled        BOOLEAN NOT NULL DEFAULT true,
  daily_summary_enabled            BOOLEAN NOT NULL DEFAULT true,
  daily_summary_time               TEXT NOT NULL DEFAULT '09:00',
  upcoming_reminders_enabled       BOOLEAN NOT NULL DEFAULT true,
  upcoming_timing_minutes          INTEGER NOT NULL DEFAULT 30,
  approval_notifications_enabled   BOOLEAN NOT NULL DEFAULT true,
  publishing_success_enabled       BOOLEAN NOT NULL DEFAULT true,
  publishing_failure_enabled       BOOLEAN NOT NULL DEFAULT true,
  missing_media_enabled            BOOLEAN NOT NULL DEFAULT true,
  channels                         JSONB NOT NULL DEFAULT '{"in_app": true, "email": false}'::jsonb,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_notif_prefs_workspace
  ON public.marketing_notification_preferences (workspace_id);

ALTER TABLE public.marketing_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_notif_prefs_select ON public.marketing_notification_preferences;
CREATE POLICY marketing_notif_prefs_select ON public.marketing_notification_preferences
  FOR SELECT
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS marketing_notif_prefs_modify ON public.marketing_notification_preferences;
CREATE POLICY marketing_notif_prefs_modify ON public.marketing_notification_preferences
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND user_id = auth.uid()
  );

DROP TRIGGER IF EXISTS set_marketing_notif_prefs_updated_at ON public.marketing_notification_preferences;
CREATE TRIGGER set_marketing_notif_prefs_updated_at
  BEFORE UPDATE ON public.marketing_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VERIFY
-- ============================================================
-- SELECT to_regclass('public.marketing_notifications') IS NOT NULL AS has_notifications,
--        to_regclass('public.marketing_notification_preferences') IS NOT NULL AS has_preferences;
