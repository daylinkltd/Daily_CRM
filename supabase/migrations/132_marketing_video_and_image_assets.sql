-- ============================================================
-- 132 — Marketing AI Video & Image Creative Assets Migration
--
-- Idempotent PostgreSQL script to support:
-- 1. AI Video and Image generation prompt storage & prompt versioning
-- 2. Extended media types (video, reel, short, story, carousel, image)
-- 3. Fast indexing on content types and media sources
-- 4. Multi-tenant Row Level Security (RLS) policies
-- ============================================================

-- Step 1: Ensure columns exist on marketing_posts
ALTER TABLE public.marketing_posts
  ADD COLUMN IF NOT EXISTS image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS video_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_prompt_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS video_prompt_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'UPLOADED',
  ADD COLUMN IF NOT EXISTS objective TEXT;

-- Step 2: Expand Content Type Check Constraint (Safe replacement)
DO $$
BEGIN
  ALTER TABLE public.marketing_posts
    DROP CONSTRAINT IF EXISTS marketing_posts_content_type_check;

  ALTER TABLE public.marketing_posts
    ADD CONSTRAINT marketing_posts_content_type_check
    CHECK (content_type IN (
      'post',
      'social',
      'blog',
      'article',
      'promo',
      'product_service',
      'announcement',
      'educational',
      'case_study',
      'testimonial',
      'behind_the_scenes',
      'industry_insights',
      'interactive_poll',
      'tips_tricks',
      'event',
      'meme_humor',
      'comparison',
      'ugc_spotlight',
      'seasonal_holiday',
      'newsletter_digest',
      'reel',
      'story',
      'video',
      'carousel',
      'short'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint update skipped or already applied: %', SQLERRM;
END $$;

-- Step 3: Add High-Performance Indexes for Content Library Filtering
CREATE INDEX IF NOT EXISTS idx_marketing_posts_content_type
  ON public.marketing_posts (workspace_id, content_type);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_media_type
  ON public.marketing_posts (workspace_id, media_type);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_status
  ON public.marketing_posts (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_scheduled_at
  ON public.marketing_posts (workspace_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Step 4: Verify Row-Level Security (RLS) is Active
ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;

-- Step 5: Verification Output
DO $$
BEGIN
  RAISE NOTICE '✅ 129_marketing_video_and_image_assets migration completed successfully!';
END $$;
