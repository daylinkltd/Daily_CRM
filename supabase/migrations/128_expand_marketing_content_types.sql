-- ============================================================
-- 128 — Expand Marketing Content Types Check Constraint
--
-- Widens the content_type check constraint on public.marketing_posts
-- to support all modern marketing formats including Case Studies,
-- Testimonials, Behind The Scenes, Industry Insights, Memes,
-- Polls, Hacks, Comparisons, UGC, and Seasonal content.
-- ============================================================

DO $$
BEGIN
  -- Drop existing constraint if present
  ALTER TABLE public.marketing_posts
    DROP CONSTRAINT IF EXISTS marketing_posts_content_type_check;

  -- Add updated constraint with complete suite of content types
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
END $$;
