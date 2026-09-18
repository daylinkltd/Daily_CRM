-- ============================================================
-- 135 — CRM Media: move uploads off the container filesystem.
--
-- THE BUG THIS FIXES
--   /api/media/upload wrote files to `public/uploads/<Workspace>/…`
--   inside the running container and stored that path in
--   media_files.local_path. `public/uploads/*` is gitignored, so the
--   directory ships EMPTY in the image and every uploaded file lived
--   only in the container's writable layer. Coolify replaces the
--   container on each deploy, so every deploy silently deleted every
--   document anyone had ever uploaded — the rows survived, the bytes
--   did not, and the UI served 404s.
--
--   Second, quieter problem: those URLs were world-readable. Anyone
--   with (or guessing) /uploads/<Company>/<Deal>/<file>.pdf could read
--   another tenant's quotations. The new bucket is PRIVATE and every
--   read goes through /api/media/file, which checks membership.
--
-- WHAT THIS DOES
--   1. A private `media-files` bucket.
--   2. `media_files.storage_path` — the object key. Rows that still
--      carry only `local_path` are the legacy (lost) ones; the app
--      distinguishes them and says so rather than 404ing blankly.
--
--   No storage policies are granted to `authenticated`: reads and
--   writes happen server-side with the service role, which bypasses
--   RLS. That keeps one enforcement point (the API route) instead of
--   two that can disagree.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media-files', 'media-files', false, 52428800)  -- 50 MB
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE public.media_files
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

COMMENT ON COLUMN public.media_files.storage_path IS
  'Object key in the private media-files bucket. NULL = legacy row whose bytes lived on the container filesystem and did not survive a deploy.';

-- Legacy rows are worth marking so support can answer "where is my
-- file?" without guessing: anything uploaded before this migration has
-- no object behind it.
CREATE INDEX IF NOT EXISTS idx_media_files_storage_path
  ON public.media_files (workspace_id) WHERE storage_path IS NULL;

-- ============================================================
-- Verify (run after pasting):
--
-- SELECT id, name, public, file_size_limit FROM storage.buckets
--   WHERE id = 'media-files';                    -- public = false
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'media_files' AND column_name = 'storage_path';
--                                                -- one row
--
-- SELECT count(*) AS legacy_rows_without_bytes
--   FROM public.media_files WHERE storage_path IS NULL;
--   -- these are the uploads lost to container restarts; they will show
--   -- in the UI as "file missing", and can be re-uploaded or deleted.
-- ============================================================
