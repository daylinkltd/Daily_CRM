-- ============================================================
-- 099 — the workspace's own GST identity
-- ============================================================
--
-- WHAT WAS WRONG
--
-- `recordGstLedgerEntry` had no idea which state the seller was in, so it
-- defaulted to `source_state_code = '27'` (Maharashtra) and
-- `destination_state_code = '27'`. Those two values decide the single most
-- consequential thing in an Indian GST entry: whether tax splits into
-- CGST + SGST (intra-state) or lands as IGST (inter-state).
--
-- Equal defaults mean every sale was recorded as intra-state. For a seller
-- in Karnataka selling within Karnataka the split came out right by luck.
-- For the same seller invoicing a Maharashtra customer it came out wrong,
-- in a report filed with the government, with no warning anywhere.
--
-- The seller's GSTIN was worse: hardcoded to '27AAAAA0000A1Z5', a
-- documentation placeholder belonging to nobody.
--
-- WHY THESE COLUMNS
--
-- The first two characters of a GSTIN are the state code, so `state_code`
-- is derivable — but only when a GSTIN has been entered, and unregistered
-- businesses below the turnover threshold legitimately have none while
-- still needing a place of supply. Hence both columns, with a trigger
-- keeping them consistent when the GSTIN is present.
--
-- Nullable on purpose. Backfilling a guess would recreate exactly the bug
-- this migration exists to remove: the application must be able to tell
-- "not configured" apart from "configured as Maharashtra", and refuse to
-- compute a tax split it cannot justify.
-- ============================================================

BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS state_code text;

COMMENT ON COLUMN public.workspaces.gstin IS
  'The workspace''s own GSTIN. NULL means unregistered or not yet entered — never substitute a placeholder.';
COMMENT ON COLUMN public.workspaces.state_code IS
  'Two-digit GST state code of the place of business. Drives CGST/SGST vs IGST. NULL means unknown; do not default it.';

-- Format guards. A malformed GSTIN silently corrupts every tax split
-- derived from it, so it is rejected at write time rather than found in a
-- filing. NULL stays allowed.
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_gstin_format;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_gstin_format
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_state_code_format;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_state_code_format
  CHECK (state_code IS NULL OR state_code ~ '^[0-9]{2}$');

-- Keep the two in agreement. The GSTIN is authoritative when present:
-- its first two characters ARE the state code, so a mismatch is always a
-- data-entry error rather than a legitimate combination.
CREATE OR REPLACE FUNCTION public.sync_workspace_state_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.gstin IS NOT NULL THEN
    NEW.state_code := substring(NEW.gstin FROM 1 FOR 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_workspace_state_code ON public.workspaces;
CREATE TRIGGER trg_sync_workspace_state_code
  BEFORE INSERT OR UPDATE OF gstin ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workspace_state_code();

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'workspaces' AND column_name IN ('gstin','state_code');
--
-- Expect: two rows, both text, both YES.
--
-- Trigger check (rolled back, touches no real data):
--   BEGIN;
--     UPDATE public.workspaces SET gstin = '29AAAAA0000A1Z5'
--      WHERE id = (SELECT id FROM public.workspaces LIMIT 1)
--      RETURNING gstin, state_code;   -- expect state_code = '29'
--   ROLLBACK;
--
-- Constraint check (expect an error, then rollback):
--   BEGIN;
--     UPDATE public.workspaces SET state_code = '999'
--      WHERE id = (SELECT id FROM public.workspaces LIMIT 1);
--   ROLLBACK;
-- ============================================================
