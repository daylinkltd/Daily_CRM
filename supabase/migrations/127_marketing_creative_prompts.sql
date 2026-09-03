-- ============================================================
-- 127 — Marketing Creative Prompts & Objective Schema
--
-- Adds creative prompt storage, prompt versioning, and objective tracking to `marketing_posts`.
-- Prompts are production-ready text specs for external models (e.g. OpenAI DALL-E 3 / Sora).
-- DailyBuz stores prompts and user-attached media separately.
-- ============================================================

ALTER TABLE public.marketing_posts
  ADD COLUMN IF NOT EXISTS image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS video_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_prompt_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS video_prompt_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS objective TEXT;

-- Verify
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'marketing_posts' 
--   AND column_name IN ('image_prompt', 'video_prompt', 'image_prompt_version', 'video_prompt_version', 'objective');
