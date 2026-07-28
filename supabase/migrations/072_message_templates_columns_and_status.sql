-- ============================================================
-- 072_message_templates_columns_and_status.sql
--
-- Two independent template failures reported in production:
--
--   1. Submitting a template:
--      "Could not find the 'header_media_url' column of
--       'message_templates' in the schema cache"
--      The submit route writes four columns that were never added to
--      the table: header_media_url, submission_error, rejection_reason,
--      last_submitted_at. The template WAS created on Meta, but the
--      local row insert failed.
--
--   2. "Sync from Meta" reporting every template as failed:
--      "violates check constraint message_templates_status_check"
--      Migration 001 defined status as
--        CHECK (status IN ('Draft','Pending','Approved','Rejected'))
--      but the app standardised on Meta's uppercase vocabulary
--      (DRAFT/PENDING/APPROVED/REJECTED/PAUSED/DISABLED/IN_APPEAL/
--       PENDING_DELETION — see template-status-normalize.ts). Every
--      synced row therefore violated the old constraint.
--
-- Idempotent.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Missing columns the submit route writes.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS header_media_url TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS submission_error TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------
-- 2. Bring the status CHECK in line with the app's vocabulary.
--
--    Order matters: DROP the old constraint FIRST, otherwise the
--    normalizing UPDATE ('Draft' -> 'DRAFT') violates the very
--    title-case constraint we're trying to replace.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_status_check;

UPDATE public.message_templates
SET status = upper(status)
WHERE status IS NOT NULL
  AND status <> upper(status);

-- Map the one legacy value that isn't just a case change.
UPDATE public.message_templates
SET status = 'PENDING'
WHERE status = 'PENDING_REVIEW';

-- Anything still outside the allowed set becomes PENDING rather than
-- blocking the constraint swap (keeps the row visible).
UPDATE public.message_templates
SET status = 'PENDING'
WHERE status IS NULL
   OR status NOT IN (
     'DRAFT', 'PENDING', 'APPROVED', 'REJECTED',
     'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION'
   );

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_status_check
  CHECK (status IN (
    'DRAFT', 'PENDING', 'APPROVED', 'REJECTED',
    'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION'
  ));

ALTER TABLE public.message_templates
  ALTER COLUMN status SET DEFAULT 'DRAFT';

-- ---------------------------------------------------------------
-- 3. header_type also standardised to uppercase (TEXT/IMAGE/VIDEO/
--    DOCUMENT) in the builder, while 001 constrained it to lowercase.
--    Relax it to accept both so a synced media-header template can't
--    trip the same wall as status.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_header_type_check;

UPDATE public.message_templates
SET header_type = lower(header_type)
WHERE header_type IS NOT NULL
  AND header_type <> lower(header_type);

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_header_type_check
  CHECK (
    header_type IS NULL
    OR lower(header_type) IN ('text', 'image', 'video', 'document')
  );
