-- ============================================================
-- 136 — Native Social Publishing Engine (Meta & LinkedIn)
--
-- Extends DailyBuz Marketing Hub for native direct-to-platform
-- publishing across Facebook Pages, Instagram Professional accounts,
-- LinkedIn Personal Profiles, and LinkedIn Company Pages.
--
-- Adds:
-- 1. Granular per-platform tracking (`platform_results`), target channel
--    IDs, and atomic concurrency lock columns to `marketing_posts`.
-- 2. Metadata, account type, and encrypted page tokens to `marketing_social_channels`.
-- 3. Queue index for non-blocking scheduled dispatch.
-- ============================================================

-- 1. Extend marketing_posts
ALTER TABLE public.marketing_posts
  ADD COLUMN IF NOT EXISTS platform_results JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_channel_ids UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

CREATE INDEX IF NOT EXISTS idx_marketing_posts_publishing_queue
  ON public.marketing_posts (status, scheduled_at)
  WHERE status IN ('scheduled', 'publishing', 'reconciling');

-- 2. Extend marketing_social_channels
ALTER TABLE public.marketing_social_channels
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'page',
  ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS page_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Ensure check constraint on account_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_social_channels_account_type_check'
  ) THEN
    ALTER TABLE public.marketing_social_channels
      ADD CONSTRAINT marketing_social_channels_account_type_check
      CHECK (account_type IN ('page', 'instagram_business', 'profile', 'organization'));
  END IF;
END $$;

-- ============================================================
-- Verify block (commented for manual Supabase SQL Editor execution):
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'marketing_posts' 
--   AND column_name IN ('platform_results', 'target_channel_ids', 'idempotency_key', 'locked_at', 'locked_by');
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'marketing_social_channels' 
--   AND column_name IN ('account_type', 'raw_metadata', 'page_access_token_encrypted', 'token_expires_at');
-- ============================================================
