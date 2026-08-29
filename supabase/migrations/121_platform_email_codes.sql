-- ============================================================
-- 121 — one-time email codes (OTP / two-factor / verification)
--
-- The product had no way to prove someone can read a given mailbox.
-- That single missing primitive is what blocked two-factor sign-in,
-- email verification, and any step-up check before a sensitive action.
--
-- WHAT IS STORED. A SHA-256 hash of the code, never the code. A leaked
-- backup of this table must not let anyone walk into an account — the
-- same reasoning as `account_invitations`, which stores a token hash.
--
-- RATE AND GUESS LIMITS live in the row rather than in memory, because
-- the app runs as several instances behind a proxy: an in-process
-- counter would let an attacker spread six guesses across six workers
-- and never trip a limit.
--
-- RLS is on with NO tenant policy. These rows are the platform's, not
-- a workspace's; only the service role touches them.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_email_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lowercased. A code is issued to a MAILBOX; the account it belongs
  -- to may not exist yet (sign-up verification).
  email         text NOT NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose       text NOT NULL CHECK (purpose IN ('login_2fa', 'verify_email', 'step_up')),
  code_hash     text NOT NULL,
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_ip    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The verify path looks up the newest live code for a mailbox+purpose.
CREATE INDEX IF NOT EXISTS idx_platform_email_codes_lookup
  ON public.platform_email_codes (email, purpose, created_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE public.platform_email_codes ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: service role only.

REVOKE ALL ON public.platform_email_codes FROM anon, authenticated;

-- ------------------------------------------------------------
-- Housekeeping. A consumed or expired code has no further use, and
-- keeping them turns a convenience table into a slowly growing record
-- of who signed in when.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_email_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.platform_email_codes
   WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day')
      OR expires_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_email_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_email_codes() TO service_role;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.platform_email_codes');   -- not null
--
-- SELECT relrowsecurity FROM pg_class
--  WHERE oid = 'public.platform_email_codes'::regclass;  -- expect: true
--
-- SELECT count(*) FROM pg_policies
--  WHERE tablename = 'platform_email_codes';            -- expect: 0
--
-- SELECT public.purge_expired_email_codes();            -- expect: 0 on a fresh table
-- ============================================================
