-- ============================================================
-- 122 — email two-factor: the switch, and where "verified" is recorded
--
-- Migration 121 gave the product a way to prove someone can read a
-- mailbox. This turns that into an actual second factor: a per-account
-- switch, and a per-SESSION record of whether the code was answered.
--
-- WHY THE FLAG LIVES ON THE SESSION, not on the user. If "verified"
-- were a property of the account, answering one code would unlock
-- every future sign-in from anywhere — which is no second factor at
-- all. Recording it against `user_sessions` means each new sign-in
-- starts unverified and must answer its own code, while the device you
-- are already on is not re-challenged on every page.
--
-- WHY register_session RETURNS IT. The proxy already calls that
-- function on every request to enforce single-device sign-in. Folding
-- the 2FA verdict into the same call keeps enforcement at zero extra
-- round trips; a separate lookup would put a query on every page load.
--
-- The new verdict is 'needs_2fa'. Existing callers treat anything that
-- is not 'revoked' as usable, so a stale deploy fails OPEN rather than
-- locking everyone out mid-rollout — deliberate, because the cost of a
-- lockout here is every user at once.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Prerequisites. This migration extends `user_sessions` (migration
-- 100) and re-defines `register_session`, whose body logs to
-- `platform_activity_log` (migration 101). Without them Postgres
-- reports a bare 42P01 naming a table nobody remembers creating, so
-- say plainly what to run instead.
-- ------------------------------------------------------------
DO $pre$
BEGIN
  IF to_regclass('public.user_sessions') IS NULL THEN
    RAISE EXCEPTION
      'Migration 100 (single active session) has not been applied — it creates public.user_sessions. Run 100_single_active_session.sql, then 101_saas_admin_console.sql, then this one. Paste 000_preflight_check.sql to see everything that is missing.';
  END IF;

  IF to_regclass('public.platform_activity_log') IS NULL THEN
    RAISE EXCEPTION
      'Migration 101 (SaaS admin console) has not been applied — it creates public.platform_activity_log, which register_session writes to. Run 101_saas_admin_console.sql first.';
  END IF;
END
$pre$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_enabled_at timestamptz;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS two_factor_verified_at timestamptz;

-- ------------------------------------------------------------
-- Mark the CURRENT session as having answered its code. Called only
-- after the code has been checked server-side; it proves nothing on
-- its own, it just records the result against this session.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_session_two_factor_verified(p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rows integer;
BEGIN
  IF v_user IS NULL OR p_session_id IS NULL OR p_session_id = '' THEN
    RETURN false;
  END IF;

  UPDATE public.user_sessions
     SET two_factor_verified_at = now()
   WHERE user_id = v_user
     AND session_id = p_session_id
     AND status = 'active';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_session_two_factor_verified(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_session_two_factor_verified(text) TO authenticated;

-- ------------------------------------------------------------
-- register_session, now also reporting whether this session still owes
-- a code. Everything about single-device enforcement is unchanged.
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

    -- A brand-new session has answered nothing yet.
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

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name LIKE 'two_factor%';
--   -- expect: two_factor_enabled, two_factor_enabled_at
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'user_sessions' AND column_name = 'two_factor_verified_at';
--   -- expect: one row
--
-- Nobody has 2FA on yet, so every existing session must still resolve
-- to 'active' — this migration must not sign anyone out:
-- SELECT count(*) FROM public.profiles WHERE two_factor_enabled;  -- expect 0
-- ============================================================
