-- ============================================================
-- 101 — what the platform console needs to exist
-- ============================================================
--
-- Two tables. Both are PLATFORM scoped, not workspace scoped, which is
-- why neither reuses what is already there:
--
--   * `platform_audit_logs` requires a workspace_id and a
--     performed_by_member_id. A super-admin is not a member of the tenant
--     they are acting on, so every platform action would have to invent
--     both — and "who changed this tenant's plan?" would be unanswerable
--     precisely when it matters.
--
--   * announcements have no home at all today.
--
-- WHY THE AUDIT TABLE IS APPEND-ONLY AT THE DATABASE LEVEL. An audit log
-- an administrator can edit is not evidence, it is a diary. The revoke
-- below removes UPDATE and DELETE from every role except the service role
-- that Postgres owners implicitly retain, so a compromised console
-- session can add entries but cannot erase its own.
-- ============================================================

BEGIN;

-- ============================================================
-- Announcements — the platform talking to its tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  -- info = neutral, warning = act soon, critical = outage/breaking.
  -- Drives the colour and whether it can be dismissed.
  level       text NOT NULL DEFAULT 'info'
              CHECK (level IN ('info', 'warning', 'critical')),
  -- NULL audience = everyone. An explicit list targets specific tenants,
  -- which is what makes "your workspace is over its message allowance"
  -- possible without spamming the other few hundred.
  workspace_ids uuid[],
  /**
   * Only plans in this list see it, or every plan when NULL. Lets a
   * trial-expiry nudge reach trials without reaching paying customers.
   */
  plan_ids    text[],
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  dismissible boolean NOT NULL DEFAULT true,
  /** Optional call to action. */
  link_url    text,
  link_label  text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  published   boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS platform_announcements_live_idx
  ON public.platform_announcements (starts_at DESC)
  WHERE published;

-- Per-user dismissals. Keyed by user rather than workspace so one
-- person's "got it" does not silence the banner for their colleagues.
CREATE TABLE IF NOT EXISTS public.platform_announcement_dismissals (
  announcement_id uuid NOT NULL
    REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Tenants read published, in-window announcements. Audience filtering by
-- workspace happens in the application, which knows the caller's active
-- workspace; the policy's job is only to keep drafts and expired notices
-- out of reach.
DROP POLICY IF EXISTS platform_announcements_read_live ON public.platform_announcements;
CREATE POLICY platform_announcements_read_live ON public.platform_announcements
  FOR SELECT TO authenticated
  USING (
    published
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS platform_announcement_dismissals_own ON public.platform_announcement_dismissals;
CREATE POLICY platform_announcement_dismissals_own ON public.platform_announcement_dismissals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Platform admin audit — every privileged action, append-only
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saas_admin_audit (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  /**
   * Denormalised on purpose. If the admin account is later deleted,
   * actor_id goes NULL and the trail would otherwise say only "someone".
   */
  actor_email  text,
  action       text NOT NULL,
  target_type  text,
  target_id    text,
  /** Before/after, or the request body for actions that have no before. */
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saas_admin_audit_created_idx
  ON public.saas_admin_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS saas_admin_audit_target_idx
  ON public.saas_admin_audit (target_type, target_id);

ALTER TABLE public.saas_admin_audit ENABLE ROW LEVEL SECURITY;

-- No policies at all: nobody reaches this through the anon or
-- authenticated roles. The console reads it with the service role, which
-- bypasses RLS. Deliberate — an audit trail readable by tenants would
-- leak other tenants' names and plan changes.

-- Append-only for everyone the API could possibly connect as.
REVOKE UPDATE, DELETE ON public.saas_admin_audit FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.saas_admin_audit FROM anon, authenticated;

-- ============================================================
-- Platform activity log — what the system did, not just what admins did
-- ============================================================
--
-- `saas_admin_audit` above answers "which administrator changed this".
-- This table answers "what happened", which is a different and larger
-- question: sign-ins, displaced devices, plan changes, payments, invites.
--
-- ADMIN-ONLY BY CONSTRUCTION. No RLS policy is defined, so no tenant role
-- can read a single row — the console reads it with the service role. That
-- is not an oversight to be fixed later: the log spans every tenant, so
-- one readable row could expose another customer's company name, sign-in
-- times and IP addresses.
--
-- Also append-only, for the same reason as the audit table.
CREATE TABLE IF NOT EXISTS public.platform_activity_log (
  id           bigserial PRIMARY KEY,
  /** Dotted and stable: 'auth.signed_in', 'billing.plan_changed'. */
  event        text NOT NULL,
  /** info | warning | error — drives filtering, not styling. */
  severity     text NOT NULL DEFAULT 'info'
               CHECK (severity IN ('info', 'warning', 'error')),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   text,
  workspace_id uuid,
  /** Free-form context. Never put a secret or a token in here. */
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_activity_created_idx
  ON public.platform_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_activity_event_idx
  ON public.platform_activity_log (event, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_activity_user_idx
  ON public.platform_activity_log (user_id, created_at DESC);

ALTER TABLE public.platform_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON public.platform_activity_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.platform_activity_log FROM anon, authenticated;

-- ============================================================
-- Log auth events from inside register_session
-- ============================================================
--
-- Sign-ins and displacements are recorded by the same function that
-- enforces the session rule, in the same transaction. Doing it in
-- application code instead would mean a code path that skipped the log —
-- and the events most worth having are exactly the ones an attacker would
-- like to skip.
--
-- Replaces the version from migration 100; the enforcement logic is
-- unchanged.
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
BEGIN
  IF v_user IS NULL OR p_session_id IS NULL OR p_session_id = '' THEN
    RETURN 'anonymous';
  END IF;

  SELECT status INTO v_status
    FROM public.user_sessions
   WHERE user_id = v_user AND session_id = p_session_id;

  IF v_status = 'revoked' THEN
    RETURN 'revoked';
  END IF;

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
      -- A sign-in that kicks another device out is the seat-sharing
      -- signal, so it is a warning rather than routine noise.
      CASE WHEN v_displaced > 0 THEN 'warning' ELSE 'info' END,
      v_user, v_email,
      jsonb_build_object('session_id', p_session_id, 'displaced_sessions', v_displaced),
      p_ip_address, p_user_agent
    );

    RETURN 'active';
  END IF;

  UPDATE public.user_sessions
     SET last_seen_at = now()
   WHERE user_id = v_user AND session_id = p_session_id;

  RETURN 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.register_session(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_session(text, text, text) TO authenticated;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.platform_announcements'),
--        to_regclass('public.platform_announcement_dismissals'),
--        to_regclass('public.saas_admin_audit');
--   -- expect three non-null
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('platform_announcements',
--                    'platform_announcement_dismissals',
--                    'saas_admin_audit');
--   -- expect relrowsecurity = true for all three
--
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_name = 'saas_admin_audit'
--    AND privilege_type IN ('UPDATE','DELETE')
--    AND grantee IN ('anon','authenticated');
--   -- expect ZERO rows
--
-- SELECT policyname FROM pg_policies
--  WHERE tablename IN ('saas_admin_audit','platform_activity_log');
--   -- expect zero rows for both (service-role only, by design)
--
-- Auth logging (run as an authenticated user, rolled back):
--   BEGIN;
--     SELECT public.register_session('log-test-A');
--     SELECT public.register_session('log-test-B');   -- displaces A
--     SELECT event, severity, details->>'displaced_sessions'
--       FROM public.platform_activity_log ORDER BY id DESC LIMIT 2;
--       -- expect the newest row: auth.session_started / warning / 1
--   ROLLBACK;
-- ============================================================
