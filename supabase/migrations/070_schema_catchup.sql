-- ============================================================
-- 070_schema_catchup.sql
--
-- Adds columns the application code writes but which are missing from
-- the production database. Two separate causes:
--
--   1. messages.reply_to_message_id was declared in 028 but that
--      migration's ALTER never landed (its message_reactions table
--      did) — so every outbound send failed with "Could not find the
--      'reply_to_message_id' column", AFTER the message had already
--      been delivered to WhatsApp. The message was lost from the CRM.
--
--   2. message_templates.header_handle / sample_values /
--      meta_template_id / quality_score were never declared in ANY
--      migration, though the template submit + "Sync from Meta"
--      routes have always written them. Both paths failed on insert.
--
-- Idempotent — safe to run more than once, and safe to run before or
-- after any other pending migration.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. messages.reply_to_message_id — self-FK for quoted replies
--    (re-declared from 028 so a partially-applied 028 self-heals).
-- ---------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- ---------------------------------------------------------------
-- 2. message_templates — columns the submit / sync routes write.
--
--    header_handle    Meta media handle for image/video/document
--                     headers (from the Resumable Upload API).
--    sample_values    Example values Meta requires for review,
--                     { body: string[], header: string[] }.
--    meta_template_id Meta's own template id — required to scope
--                     edit/delete to ONE language variant (hsm_id);
--                     without it Meta deletes every variant sharing
--                     the template name.
--    quality_score    Meta's delivery-quality rating for the
--                     template: GREEN / YELLOW / RED.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS header_handle TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS sample_values JSONB;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS quality_score TEXT;

-- Meta's rating vocabulary. Added separately (and tolerantly) so a
-- re-run doesn't error on an already-present constraint.
DO $$
BEGIN
  ALTER TABLE public.message_templates
    ADD CONSTRAINT message_templates_quality_score_check
    CHECK (quality_score IS NULL OR quality_score IN ('GREEN', 'YELLOW', 'RED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One row per (workspace, template name, language) — the sync route
-- looks templates up by exactly this triple, and duplicates would
-- make it insert a second copy on every sync.
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_ws_name_lang
  ON public.message_templates(workspace_id, name, language);

CREATE INDEX IF NOT EXISTS idx_message_templates_meta_id
  ON public.message_templates(meta_template_id)
  WHERE meta_template_id IS NOT NULL;

-- ---------------------------------------------------------------
-- 3. Digit-normalized contact lookup.
--
-- The webhook matched an inbound sender to a contact with
--   phone LIKE '%<last 8 digits>'
-- against the RAW stored string. Indian-formatted numbers
-- ("+91 99023 19132") have a space inside those last 8 characters, so
-- the pattern misses and the webhook creates a SECOND contact — the
-- customer's reply then lands in a brand-new chat instead of the one
-- the team already has open.
--
-- This index + helper compare digits only, so every stored format
-- ("+91 9902319132", "9902319132", "919902319132") resolves to the
-- same contact. Oldest match wins, so repeat inbounds are stable.
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_phone_digits
  ON public.contacts (regexp_replace(phone, '\D', '', 'g'));

CREATE OR REPLACE FUNCTION public.find_contacts_by_phone_digits(
  p_workspace_id UUID,
  p_digits       TEXT
)
RETURNS SETOF public.contacts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT c.*, regexp_replace(c.phone, '\D', '', 'g') AS digits
    FROM public.contacts c
    WHERE (p_workspace_id IS NULL OR c.workspace_id = p_workspace_id)
  )
  SELECT (n.*)::public.contacts
  FROM normalized n
  WHERE length(n.digits) >= 7
    AND length(p_digits) >= 7
    AND (
      n.digits = p_digits
      -- One is a suffix of the other and the extra leading digits are a
      -- plausible country code (+ optional trunk 0): at most 4 digits.
      -- A blanket "same last 8 digits" rule would merge genuinely
      -- different numbers — real data has +255000000001 / +240000000001
      -- / +270000000001, three countries, one 8-digit tail.
      OR (
        length(n.digits) > length(p_digits)
        AND right(n.digits, length(p_digits)) = p_digits
        AND length(n.digits) - length(p_digits) <= 4
      )
      OR (
        length(p_digits) > length(n.digits)
        AND right(p_digits, length(n.digits)) = n.digits
        AND length(p_digits) - length(n.digits) <= 4
      )
    )
  -- Exact matches first, then oldest — deterministic across replays.
  ORDER BY (n.digits = p_digits) DESC, n.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.find_contacts_by_phone_digits(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_contacts_by_phone_digits(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_contacts_by_phone_digits(UUID, TEXT) TO service_role;
