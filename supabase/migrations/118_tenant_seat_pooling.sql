-- ============================================================
-- 118 — one pool of seats across a tenant's workspaces
--
-- THE BUG. `create_workspace_for_user` copies plan_limits from the
-- owner's first workspace, so a tenant that bought 5 seats got 5 seats
-- in workspace A and another 5 in workspace B — and the seat trigger,
-- which counts members of one workspace, happily allowed it. Twenty
-- people could work under a five-seat subscription simply by splitting
-- across four workspaces.
--
-- THE MODEL. A seat is a PERSON, not a membership. Someone who works in
-- three of the tenant's workspaces occupies one seat, because they are
-- one human being with one login. So:
--
--   tenant  = every workspace owned by the same user
--   limit   = max_members on that owner's FIRST workspace (the one
--             checkout wrote to)
--   usage   = count(DISTINCT user_id) across all of them
--
-- Deliberately NOT changed: per-workspace roles. The whole point is
-- that one person can be an admin in one workspace and a viewer in
-- another; that has always worked and stays untouched. What is pooled
-- is the seat, not the permission.
-- ============================================================

BEGIN;

-- The user who owns a workspace. Stable: `workspace_members` allows one
-- owner row per workspace, written at creation.
CREATE OR REPLACE FUNCTION public.workspace_owner_id(p_workspace uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT wm.user_id
    FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace
     AND wm.role = 'owner'
   ORDER BY wm.created_at
   LIMIT 1;
$$;

-- Every workspace belonging to the same owner, this one included.
CREATE OR REPLACE FUNCTION public.tenant_workspace_ids(p_workspace uuid)
RETURNS TABLE (workspace_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT wm.workspace_id
    FROM public.workspace_members wm
   WHERE wm.role = 'owner'
     AND wm.user_id = public.workspace_owner_id(p_workspace);
$$;

-- Seats sold, read from the owner's first workspace so every sibling
-- answers with the same number instead of its inherited copy.
CREATE OR REPLACE FUNCTION public.tenant_seat_limit(p_workspace uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(w.plan_limits->>'max_members', '')::integer
    FROM public.workspaces w
    JOIN public.tenant_workspace_ids(p_workspace) t ON t.workspace_id = w.id
   ORDER BY w.created_at
   LIMIT 1;
$$;

-- Distinct people across the tenant. One human, one seat, however many
-- of the tenant's workspaces they appear in.
CREATE OR REPLACE FUNCTION public.tenant_seat_usage(p_workspace uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(DISTINCT wm.user_id)::integer
    FROM public.workspace_members wm
    JOIN public.tenant_workspace_ids(p_workspace) t ON t.workspace_id = wm.workspace_id;
$$;

GRANT EXECUTE ON FUNCTION public.workspace_owner_id(uuid)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_workspace_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_seat_limit(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_seat_usage(uuid)    TO authenticated, service_role;

-- ------------------------------------------------------------
-- The trigger now counts people, not memberships.
-- ------------------------------------------------------------
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
  -- ---- Rule 1: seats, pooled across the tenant -----------------------
  v_max_members := public.tenant_seat_limit(NEW.workspace_id);

  IF v_max_members IS NOT NULL THEN
    -- Someone already inside the tenant is moving between workspaces,
    -- not consuming a new seat. Without this, adding an existing
    -- colleague to a second workspace would be refused on a full plan
    -- even though the headcount has not changed.
    IF EXISTS (
      SELECT 1
        FROM public.workspace_members wm
        JOIN public.tenant_workspace_ids(NEW.workspace_id) t
          ON t.workspace_id = wm.workspace_id
       WHERE wm.user_id = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;

    v_current := public.tenant_seat_usage(NEW.workspace_id);

    IF v_current >= v_max_members THEN
      RAISE EXCEPTION 'seat_limit: % of % seats in use across your workspaces', v_current, v_max_members
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

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- Replace <ws> with any workspace id you own.
--
-- SELECT public.tenant_seat_limit('<ws>')  AS seats_sold,
--        public.tenant_seat_usage('<ws>')  AS people_using,
--        (SELECT count(*) FROM public.tenant_workspace_ids('<ws>')) AS workspaces;
--   -- people_using counts each person ONCE even if they are in several
--   -- of those workspaces.
--
-- Adding a colleague who is already in a sibling workspace must succeed
-- on a full plan; adding a brand-new person must fail with
-- 'seat_limit: ...'.
-- ============================================================
