-- ============================================================
-- 102 — seats and workspace membership, enforced where it cannot be missed
-- ============================================================
--
-- Two rules, one trigger:
--
--   1. A workspace cannot hold more members than the seats it paid for.
--   2. A user flagged single-workspace cannot be added to a second one.
--
-- WHY A TRIGGER AND NOT (ONLY) APPLICATION CHECKS. Members enter
-- `workspace_members` today through at least three paths: the invite API,
-- the `redeem_invitation` RPC (migration 019), and the saas-admin
-- create-owner route. Each currently checks what it remembers to check.
-- A BEFORE INSERT trigger is the one place all of them pass through — the
-- application keeps its friendly, specific error messages, and this stays
-- the backstop that makes "we were sold 5 seats, we have 9 members"
-- impossible rather than merely unlikely.
--
-- Exceptions use ERRCODE 'P0001' with fixed message prefixes
-- ('seat_limit:', 'single_workspace:') so API routes can translate them
-- into their own copy without string-matching whole sentences.
-- ============================================================

BEGIN;

-- The per-user membership policy. Default false: multi-workspace stays
-- allowed unless the platform admin restricts a specific user.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS single_workspace_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.single_workspace_only IS
  'When true, this user can belong to at most one workspace. Set from the SaaS admin console; enforced by enforce_membership_rules().';

CREATE OR REPLACE FUNCTION public.enforce_membership_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max_members integer;
  v_current integer;
  v_single boolean;
  v_elsewhere integer;
BEGIN
  -- ---- Rule 1: seats ------------------------------------------------
  -- plan_limits.max_members is what checkout sold. NULL or absent means
  -- unlimited (enterprise/legacy), and jsonb null must not coerce to 0 —
  -- hence the guarded cast.
  SELECT NULLIF(plan_limits->>'max_members', '')::integer
    INTO v_max_members
    FROM public.workspaces
   WHERE id = NEW.workspace_id;

  IF v_max_members IS NOT NULL THEN
    SELECT count(*) INTO v_current
      FROM public.workspace_members
     WHERE workspace_id = NEW.workspace_id;

    IF v_current >= v_max_members THEN
      RAISE EXCEPTION 'seat_limit: this workspace has % of % seats in use', v_current, v_max_members
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ---- Rule 2: single-workspace users --------------------------------
  SELECT single_workspace_only INTO v_single
    FROM public.profiles
   WHERE user_id = NEW.user_id;

  IF v_single THEN
    SELECT count(*) INTO v_elsewhere
      FROM public.workspace_members
     WHERE user_id = NEW.user_id
       AND workspace_id <> NEW.workspace_id;

    IF v_elsewhere > 0 THEN
      RAISE EXCEPTION 'single_workspace: this user is restricted to one workspace'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_membership_rules ON public.workspace_members;
CREATE TRIGGER trg_enforce_membership_rules
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_membership_rules();

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.workspace_members'::regclass
--    AND tgname = 'trg_enforce_membership_rules';    -- one row
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name = 'single_workspace_only';
--
-- Seat rule (rolled back, uses your smallest real workspace):
--   BEGIN;
--     UPDATE public.workspaces
--        SET plan_limits = jsonb_set(coalesce(plan_limits,'{}'::jsonb),
--                                    '{max_members}', '1')
--      WHERE id = (SELECT workspace_id FROM public.workspace_members
--                  GROUP BY workspace_id ORDER BY count(*) LIMIT 1);
--     -- Any INSERT of a second member into that workspace must now fail
--     -- with 'seat_limit: ...'.
--   ROLLBACK;
-- ============================================================
