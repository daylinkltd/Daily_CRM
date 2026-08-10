-- ============================================================
-- 109 — Rebrand: Dailybuz → Dailybiz (new domain dailybiz.in)
--
-- The codebase reads every name and URL from src/config/brand.ts, so
-- the app rebrands with a deploy. What a deploy cannot touch is DATA:
-- migration 107 seeded 16 platform message templates whose subjects
-- and bodies say "Dailybuz". 107 stays untouched as the historical
-- record (same convention as 108 re-asserting 035); this migration
-- fixes the rows it left behind.
--
-- replace() is idempotent — a second paste finds nothing to replace.
-- Templates the admin has already hand-edited keep their edits; only
-- the brand string inside them changes.
-- ============================================================

UPDATE public.platform_message_templates
SET
  name    = replace(replace(name,    'Dailybuz', 'Dailybiz'), 'DailyBuz', 'DailyBiz'),
  subject = replace(replace(subject, 'Dailybuz', 'Dailybiz'), 'DailyBuz', 'DailyBiz'),
  body    = replace(replace(body,    'Dailybuz', 'Dailybiz'), 'DailyBuz', 'DailyBiz')
WHERE
  name    LIKE '%Dailyb%'
  OR subject LIKE '%Dailyb%'
  OR body    LIKE '%Dailyb%';

-- ============================================================
-- Verify (run after pasting):
--
-- SELECT count(*) AS still_old
-- FROM public.platform_message_templates
-- WHERE name || coalesce(subject, '') || body ILIKE '%dailybuz%';
--   -- expect: 0
--
-- SELECT count(*) AS rebranded
-- FROM public.platform_message_templates
-- WHERE name || coalesce(subject, '') || body LIKE '%Dailybiz%';
--   -- expect: > 0 (the seeded email/SMS templates)
-- ============================================================
