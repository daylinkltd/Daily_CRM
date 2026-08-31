-- ============================================================
-- 124 — a seat you can take back, and workspaces only an owner makes
--
-- Two changes that both come down to the same thing: what a
-- subscription actually pays for.
--
-- ------------------------------------------------------------
-- PART A — per-user licences
-- ------------------------------------------------------------
-- Today the only way to stop paying for someone is to delete them, and
-- deleting them takes their history with them: who they were assigned
-- to, what they wrote, which letters they signed. So nobody deletes,
-- and the tenant keeps paying for people who left.
--
-- A licence separates "works here" from "is paid for". An unlicensed
-- person keeps every row they ever created and simply cannot sign in.
--
-- THE LICENCE IS PER TENANT, NOT PER MEMBERSHIP. Migration 118
-- established that a seat is a PERSON — one human in three of the
-- tenant's workspaces is one seat. A licence has to be pooled the same
-- way or it would mean nothing: licensing someone in workspace A and
-- not B would save no money, because the seat was never per-workspace
-- to begin with.
--
-- ABSENCE OF A ROW MEANS LICENSED. This is the whole safety design.
-- Every existing member has no row, so shipping this locks nobody out;
-- being unlicensed requires someone to have explicitly said so. A bug
-- in this table costs money, never access.
--
-- THE OWNER CAN NEVER BE UNLICENSED. Whatever the table says, the owner
-- passes — otherwise a misclick locks the account holder out of the
-- account they are paying for, and there is no one left who can undo it.
--
-- SIGN-IN IS BLOCKED ONLY WHEN NOTHING IS LICENSED. A person can work
-- for two different tenants. Revoking them at one must not lock them out
-- of the other, so the sign-in gate asks "is there anywhere you are
-- still licensed?" rather than checking one tenant.
--
-- ------------------------------------------------------------
-- PART B — only an owner creates workspaces
-- ------------------------------------------------------------
-- `create_workspace_for_user` reads auth.uid() and makes the caller the
-- owner of whatever it creates, so ANY member could mint workspaces —
-- inheriting the tenant's plan and seat allowance into an account the
-- paying owner does not control.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A1. The licence roster.
--
-- Keyed on the OWNER rather than a workspace, because that is what
-- identifies a tenant — every workspace the same person owns.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_user_licenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_licensed     boolean NOT NULL DEFAULT true,
  revoked_reason  text,
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, user_id)
);

-- The sign-in gate asks "is this person licensed anywhere" on every
-- request, so that lookup gets its own index.
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_user
  ON public.tenant_user_licenses (user_id)
  WHERE is_licensed = false;

ALTER TABLE public.tenant_user_licenses ENABLE ROW LEVEL SECURITY;

-- Readable by anyone in the tenant, so the members page can show who is
-- licensed. Writes go through set_user_license only — see A4.
DROP POLICY IF EXISTS "Tenant members can read licences" ON public.tenant_user_licenses;
CREATE POLICY "Tenant members can read licences" ON public.tenant_user_licenses
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
        FROM public.workspace_members wm
       WHERE wm.user_id = auth.uid()
         AND public.workspace_owner_id(wm.workspace_id) = tenant_user_licenses.owner_user_id
    )
  );

-- ------------------------------------------------------------
-- A2. Is this person licensed in this tenant?
--
-- Two deliberate 'true's: the owner always, and anyone with no row.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_licensed(p_owner uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_owner IS NULL OR p_user IS NULL THEN true
    -- The account holder cannot be locked out of the account.
    WHEN p_owner = p_user THEN true
    ELSE COALESCE(
      (SELECT l.is_licensed
         FROM public.tenant_user_licenses l
        WHERE l.owner_user_id = p_owner
          AND l.user_id = p_user),
      true)  -- no row = licensed
  END;
$$;

-- Is there anywhere at all this person is still licensed?
--
-- A user with no memberships is NOT blocked — they may be mid-invite or
-- mid-onboarding, and locking them out would break signing up.
CREATE OR REPLACE FUNCTION public.user_has_any_license(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
           SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = p_user
         )
      OR EXISTS (
           SELECT 1
             FROM public.workspace_members wm
            WHERE wm.user_id = p_user
              AND public.user_is_licensed(
                    public.workspace_owner_id(wm.workspace_id), p_user)
         );
$$;

-- ------------------------------------------------------------
-- A3. Seats count LICENSED people. This is the point of the feature —
-- revoking a licence has to give the seat back, or nothing is saved.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_seat_usage(p_workspace uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(DISTINCT wm.user_id)::integer
    FROM public.workspace_members wm
    JOIN public.tenant_workspace_ids(p_workspace) t ON t.workspace_id = wm.workspace_id
   WHERE public.user_is_licensed(public.workspace_owner_id(p_workspace), wm.user_id);
$$;

-- ------------------------------------------------------------
-- A4. Granting and revoking, with the permission check in one place.
--
-- SECURITY DEFINER with an explicit owner/admin test, rather than an
-- RLS write policy: the rules here ("not the owner", "not yourself")
-- are conditions RLS states badly and this states plainly.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_license(
  p_workspace uuid,
  p_user      uuid,
  p_licensed  boolean,
  p_reason    text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid := public.workspace_owner_id(p_workspace);
  v_actor_role text;
BEGIN
  IF v_actor IS NULL OR v_owner IS NULL THEN
    RAISE EXCEPTION 'not_permitted: no workspace owner resolved';
  END IF;

  -- The actor must be owner or admin somewhere in THIS tenant.
  SELECT wm.role INTO v_actor_role
    FROM public.workspace_members wm
    JOIN public.tenant_workspace_ids(p_workspace) t ON t.workspace_id = wm.workspace_id
   WHERE wm.user_id = v_actor
     AND wm.role IN ('owner', 'admin')
   LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'not_permitted: only an owner or admin can change licences';
  END IF;

  -- The account holder's licence is not a thing anyone can take away,
  -- including themselves. Without this the tenant can be orphaned:
  -- nobody left who is allowed to sign in and grant licences back.
  IF p_user = v_owner THEN
    RAISE EXCEPTION 'owner_always_licensed: the account owner always holds a licence';
  END IF;

  -- The target must actually be in this tenant, so one tenant's admin
  -- cannot reach into another's roster.
  IF NOT EXISTS (
    SELECT 1
      FROM public.workspace_members wm
      JOIN public.tenant_workspace_ids(p_workspace) t ON t.workspace_id = wm.workspace_id
     WHERE wm.user_id = p_user
  ) THEN
    RAISE EXCEPTION 'not_found: that person is not in this account';
  END IF;

  INSERT INTO public.tenant_user_licenses
      (owner_user_id, user_id, is_licensed, revoked_reason, updated_by, updated_at)
  VALUES (v_owner, p_user, p_licensed,
          CASE WHEN p_licensed THEN NULL ELSE p_reason END, v_actor, now())
  ON CONFLICT (owner_user_id, user_id) DO UPDATE
    SET is_licensed    = EXCLUDED.is_licensed,
        revoked_reason = EXCLUDED.revoked_reason,
        updated_by     = EXCLUDED.updated_by,
        updated_at     = now();

  -- Revoking ends their sessions immediately. Leaving them signed in
  -- until the token expires would mean the licence you stopped paying
  -- for still works for the rest of the day.
  IF NOT p_licensed AND to_regclass('public.user_sessions') IS NOT NULL THEN
    UPDATE public.user_sessions
       SET status = 'revoked',
           revoked_at = now(),
           revoked_reason = 'licence revoked'
     WHERE user_id = p_user
       AND status = 'active';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.user_is_licensed(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_any_license(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_license(uuid, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_licensed(uuid, uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_any_license(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_license(uuid, uuid, boolean, text) TO authenticated;

-- ------------------------------------------------------------
-- A5. The sign-in gate.
--
-- register_session is already called on every request to enforce
-- single-device sign-in, so the licence verdict rides along at no extra
-- cost. Everything about migrations 100 and 122 is unchanged.
--
-- Order matters: an unlicensed person is not asked for a 2FA code.
-- There is nothing behind the code for them to reach.
--
-- The new verdict is 'unlicensed'. A deploy that predates it reads
-- anything unrecognised as 'unknown' and lets the request through, so a
-- mid-rollout mismatch fails OPEN — the same choice made for 'needs_2fa',
-- for the same reason: the cost of failing closed here is every user at
-- once.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_session(
  p_session_id text,
  p_user_agent text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_email text;
  v_displaced integer := 0;
  v_needs_2fa boolean := false;
  v_verified timestamptz;
BEGIN
  IF v_user IS NULL OR p_session_id IS NULL OR p_session_id = '' THEN
    RETURN 'anonymous';
  END IF;

  SELECT status, two_factor_verified_at INTO v_status, v_verified
    FROM public.user_sessions
   WHERE user_id = v_user AND session_id = p_session_id;

  IF v_status = 'revoked' THEN
    RETURN 'revoked';
  END IF;

  -- No licence anywhere: stop here, before a session is created and
  -- before a code is demanded.
  IF NOT public.user_has_any_license(v_user) THEN
    RETURN 'unlicensed';
  END IF;

  SELECT two_factor_enabled INTO v_needs_2fa
    FROM public.profiles WHERE user_id = v_user;

  IF v_status IS NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE user_id = v_user;

    UPDATE public.user_sessions
       SET status = 'revoked',
           revoked_at = now(),
           revoked_reason = 'signed in on another device'
     WHERE user_id = v_user AND status = 'active';
    GET DIAGNOSTICS v_displaced = ROW_COUNT;

    INSERT INTO public.user_sessions (user_id, session_id, user_agent, ip_address)
    VALUES (v_user, p_session_id, p_user_agent, p_ip_address)
    ON CONFLICT (user_id, session_id) DO UPDATE
      SET status = 'active',
          revoked_at = NULL,
          revoked_reason = NULL,
          last_seen_at = now();

    INSERT INTO public.platform_activity_log
      (event, severity, user_id, user_email, details, ip_address, user_agent)
    VALUES (
      'auth.session_started',
      CASE WHEN v_displaced > 0 THEN 'warning' ELSE 'info' END,
      v_user, v_email,
      jsonb_build_object('session_id', p_session_id, 'displaced_sessions', v_displaced),
      p_ip_address, p_user_agent
    );

    IF COALESCE(v_needs_2fa, false) THEN
      RETURN 'needs_2fa';
    END IF;
    RETURN 'active';
  END IF;

  UPDATE public.user_sessions
     SET last_seen_at = now()
   WHERE user_id = v_user AND session_id = p_session_id;

  IF COALESCE(v_needs_2fa, false) AND v_verified IS NULL THEN
    RETURN 'needs_2fa';
  END IF;

  RETURN 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.register_session(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_session(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- B. Only an owner creates a workspace.
--
-- Everything else about this function — the plan-limit check, the
-- copied plan_limits, the owner membership row — is migration 021's and
-- is left as it was.
--
-- A caller who owns nothing yet is still allowed through: that is the
-- signup path, where `create_owner_with_workspace` has not yet run or
-- the account genuinely has no workspace. The rule being added is that
-- somebody ELSE'S member cannot mint one.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_may_create_workspace()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owns integer;
  v_member_of integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_permitted: sign in first';
  END IF;

  SELECT count(*) INTO v_owns
    FROM public.workspace_members
   WHERE user_id = v_user AND role = 'owner';

  IF v_owns > 0 THEN
    RETURN;  -- already an owner: this is their own account to extend
  END IF;

  SELECT count(*) INTO v_member_of
    FROM public.workspace_members
   WHERE user_id = v_user;

  IF v_member_of > 0 THEN
    RAISE EXCEPTION
      'not_permitted: only the account owner can create workspaces. Ask the owner of your account to create it.';
  END IF;

  -- Owns nothing, belongs to nothing: a brand-new account creating its
  -- first workspace.
END;
$$;

REVOKE ALL ON FUNCTION public.assert_may_create_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_may_create_workspace() TO authenticated;

-- ------------------------------------------------------------
-- B2. create_workspace_for_user, now asking permission first.
--
-- Re-declared in full because the guard has to run before any row is
-- written. Migration 021's body is otherwise carried over unchanged
-- except for one fix noted below.
--
-- THE 'Agent' FIX. Migration 119 renamed the built-in staff role to
-- 'Team Member' — but only the rows that existed. This function still
-- seeded 'Agent' into every workspace created afterwards, so the rename
-- undid itself the moment anyone made a new workspace, and the preflight
-- would eventually report 119 as missing on a database where it had
-- genuinely been applied.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(p_name TEXT)
RETURNS TABLE (
    id          UUID,
    name        TEXT,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
    v_primary_ws   RECORD;
    v_ws_count     INT;
    v_max_ws       INT;
BEGIN
    -- Before anything else: may this caller create a workspace at all?
    PERFORM public.assert_may_create_workspace();

    IF trim(p_name) = '' THEN
        RAISE EXCEPTION 'Workspace name cannot be empty';
    END IF;

    SELECT w.plan, w.plan_limits
    INTO v_primary_ws
    FROM public.workspaces w
    JOIN public.workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
    ORDER BY w.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        v_max_ws := (v_primary_ws.plan_limits->>'max_workspaces')::int;

        IF v_max_ws IS NOT NULL THEN
            SELECT COUNT(*) INTO v_ws_count
            FROM public.workspace_members
            WHERE user_id = auth.uid() AND role = 'owner';

            IF v_ws_count >= v_max_ws THEN
                RAISE EXCEPTION 'You have reached the maximum number of workspaces allowed on your % plan (Max: %)', UPPER(v_primary_ws.plan), v_max_ws;
            END IF;
        END IF;

        INSERT INTO public.workspaces (name, plan, plan_limits)
        VALUES (trim(p_name), v_primary_ws.plan, v_primary_ws.plan_limits)
        RETURNING public.workspaces.id INTO v_workspace_id;
    ELSE
        INSERT INTO public.workspaces (name)
        VALUES (trim(p_name))
        RETURNING public.workspaces.id INTO v_workspace_id;
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, auth.uid(), 'owner');

    INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
    VALUES (v_workspace_id, 'Admin', 'Can manage team, settings, and all CRM features', true, '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
      "automations": true, "integrations": true, "settings_profile": true,
      "settings_workspace": true, "settings_templates": true, "settings_tags": true,
      "reports": true, "team_members:create": true, "team_members:read": true,
      "team_members:update": true, "team_members:delete": true
    }'::jsonb);

    INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
    VALUES (v_workspace_id, 'Team Member', 'Can view inbox and manage contacts', true, '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": false,
      "automations": false, "integrations": false, "settings_profile": true,
      "settings_workspace": false, "settings_templates": false, "settings_tags": false,
      "reports": false, "team_members:read": true
    }'::jsonb);

    RETURN QUERY
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM public.workspaces w
        WHERE w.id = v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace_for_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_for_user(TEXT) TO authenticated;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- Replace <ws> with a workspace id you own and <user> with a member's
-- user_id (NOT the owner's).
--
-- 1. Nobody is unlicensed yet — shipping this must lock nobody out:
-- SELECT count(*) FROM public.tenant_user_licenses WHERE NOT is_licensed;
--   -- expect 0
--
-- 2. Everyone still passes, because absence of a row means licensed:
-- SELECT count(*) FROM public.workspace_members wm
--  WHERE NOT public.user_has_any_license(wm.user_id);
--   -- expect 0
--
-- 3. Seats before and after revoking one person:
-- SELECT public.tenant_seat_usage('<ws>');            -- note the number
-- SELECT public.set_user_license('<ws>', '<user>', false, 'left the company');
-- SELECT public.tenant_seat_usage('<ws>');            -- expect one fewer
-- SELECT public.user_has_any_license('<user>');       -- expect false
--
-- 4. Give it back:
-- SELECT public.set_user_license('<ws>', '<user>', true);
-- SELECT public.user_has_any_license('<user>');       -- expect true
--
-- 5. The owner cannot be revoked, by anyone, ever:
-- SELECT public.set_user_license('<ws>',
--          public.workspace_owner_id('<ws>'), false);
--   -- expect ERROR: owner_always_licensed
--
-- 6. Workspace creation is owner-only:
-- SELECT public.assert_may_create_workspace();
--   -- as an owner: returns quietly. As a non-owner member: raises
--   -- 'not_permitted: only the account owner can create workspaces'.
-- ============================================================
