-- ============================================================
-- 100 — one active session per user
-- ============================================================
--
-- Signing in on a second device must sign the first one out.
--
-- WHY A TABLE RATHER THAN "JUST CHECK THE NEWEST TOKEN"
--
-- Supabase issues an independent refresh-token chain per device and has no
-- notion of an exclusive session, so there is nothing to read. The obvious
-- shortcut — "if the request's session is not the one I last saw, adopt it
-- and boot the other" — ping-pongs forever: device A adopts, device B's
-- next request adopts back, and both stay logged in while thrashing the
-- database.
--
-- Keeping a row PER SESSION with an explicit status breaks the loop. A
-- session the table has never seen is by definition newer than every row
-- already there, so it revokes them and becomes active. A session that has
-- been revoked finds its own row saying so and is signed out. There is no
-- state in which two rows are active, and no state where a revoked session
-- can revive itself.
--
-- THE ROWS ARE ALSO THE AUDIT TRAIL. "Where am I signed in, and from
-- what?" is a question support gets, and the admin console needs to be
-- able to force a sign-out. Both fall out of this table for free.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The `session_id` claim from the access token. Stable across token
  -- refreshes, unique per sign-in — exactly the identity needed here.
  session_id  text        NOT NULL,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'revoked')),
  user_agent  text,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  -- Why it ended, so "I was randomly logged out" can be answered.
  revoked_reason text,
  PRIMARY KEY (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS user_sessions_active_idx
  ON public.user_sessions (user_id)
  WHERE status = 'active';

-- Housekeeping: revoked rows older than 30 days are no longer interesting.
CREATE INDEX IF NOT EXISTS user_sessions_revoked_at_idx
  ON public.user_sessions (revoked_at)
  WHERE revoked_at IS NOT NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Read-only to the owner. Writes go exclusively through the function
-- below: a user who could UPDATE this table directly could mark someone
-- else's revoked row active again, or keep two sessions alive by flipping
-- their own status back.
DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- register_session — the whole enforcement, in one atomic call
-- ============================================================
--
-- Returns 'active' when the caller may proceed and 'revoked' when they
-- have been displaced by a newer sign-in.
--
-- SECURITY DEFINER because it writes a table users cannot write, but it
-- reads the identity from auth.uid() and never from an argument, so a
-- caller cannot operate on anyone else's sessions.
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
BEGIN
  IF v_user IS NULL OR p_session_id IS NULL OR p_session_id = '' THEN
    -- No identity to enforce against. Say so rather than returning
    -- 'active', so a decoding bug upstream cannot read as a pass.
    RETURN 'anonymous';
  END IF;

  SELECT status INTO v_status
    FROM public.user_sessions
   WHERE user_id = v_user AND session_id = p_session_id;

  IF v_status = 'revoked' THEN
    RETURN 'revoked';
  END IF;

  IF v_status IS NULL THEN
    -- Never seen before, therefore newer than anything on file. It wins,
    -- and everything else for this user loses.
    UPDATE public.user_sessions
       SET status = 'revoked',
           revoked_at = now(),
           revoked_reason = 'signed in on another device'
     WHERE user_id = v_user AND status = 'active';

    INSERT INTO public.user_sessions (user_id, session_id, user_agent, ip_address)
    VALUES (v_user, p_session_id, p_user_agent, p_ip_address)
    ON CONFLICT (user_id, session_id) DO UPDATE
      SET status = 'active',
          revoked_at = NULL,
          revoked_reason = NULL,
          last_seen_at = now();

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

-- ============================================================
-- revoke_user_sessions — for the admin console and "sign out everywhere"
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(
  p_user_id uuid,
  p_reason text DEFAULT 'revoked by an administrator'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.user_sessions
     SET status = 'revoked', revoked_at = now(), revoked_reason = p_reason
   WHERE user_id = p_user_id AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Service role only. Deliberately NOT granted to `authenticated`: it takes
-- a user id as an argument, so any signed-in user could sign out any other.
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid, text) FROM PUBLIC;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.user_sessions');                  -- not null
-- SELECT proname, prosecdef FROM pg_proc
--  WHERE proname IN ('register_session','revoke_user_sessions');
--   -- expect two rows, prosecdef = true for both
--
-- SELECT rolname, has_function_privilege(rolname,
--          'public.register_session(text,text,text)', 'EXECUTE')
--   FROM pg_roles WHERE rolname IN ('anon','authenticated');
--   -- expect anon = false, authenticated = true
--
-- Behaviour (run as an authenticated user, rolled back):
--   BEGIN;
--     SELECT public.register_session('sess-A');  -- 'active'
--     SELECT public.register_session('sess-B');  -- 'active'  (B takes over)
--     SELECT public.register_session('sess-A');  -- 'revoked' (A displaced)
--     SELECT public.register_session('sess-B');  -- 'active'  (no ping-pong)
--   ROLLBACK;
-- ============================================================
