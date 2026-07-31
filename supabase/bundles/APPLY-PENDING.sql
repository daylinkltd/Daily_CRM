-- ==================== BEGIN 083_handbook_position ====================

-- ============================================================
-- 083 — handbook membership as data, not as a title prefix.
--
-- "Add policy to handbook" was implemented by RENAMING the policy to
-- `Handbook §Addendum — <title>`. That mutated the source policy
-- irreversibly (it shows renamed in Policies & Compliance, exports
-- and audit history, with no way back), silently excluded it from the
-- "Linked Company Policies" generation pass (which filters
-- `title NOT LIKE 'Handbook §%'`), and leaked the raw prefix into the
-- printed handbook because the UI strip regex expects digits.
--
-- Handbook membership and ordering now live in a column, so titles
-- are never touched and section order is deterministic (the previous
-- listing had no ORDER BY, so added sections renumbered themselves
-- between page loads as Postgres returned rows in different order).
--
-- Additive and idempotent.
-- ============================================================

ALTER TABLE public.hr_policies
  ADD COLUMN IF NOT EXISTS handbook_position INTEGER;

COMMENT ON COLUMN public.hr_policies.handbook_position IS
  'NULL = not part of the employee handbook. 1..13 are the generated standard sections; higher values are policies added afterwards. Drives handbook ordering.';

CREATE INDEX IF NOT EXISTS idx_hr_policies_handbook_position
  ON public.hr_policies (workspace_id, handbook_position)
  WHERE handbook_position IS NOT NULL;

-- Backfill: the 13 generated sections are identified by their
-- `Handbook §N — ...` titles, so their number IS their position.
UPDATE public.hr_policies
SET handbook_position = CAST(substring(title FROM 'Handbook §([0-9]+)') AS INTEGER)
WHERE handbook_position IS NULL
  AND title ~ '^Handbook §[0-9]+ — ';

-- Repair anything already damaged by the renaming implementation:
-- restore the original title and record it as an added section.
UPDATE public.hr_policies
SET title = regexp_replace(title, '^Handbook §Addendum — ', ''),
    handbook_position = COALESCE(handbook_position, 100)
WHERE title LIKE 'Handbook §Addendum — %';

-- ==================== END 083 ====================
