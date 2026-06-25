-- ── 032_workspace_invitations.sql — Workspace invitations peek + redeem RPCs
--
-- Adapts the upstream account-based invitations to our workspace-based multi-tenancy.
-- Scopes invitations to `workspaces` (via `account_id` mapping) and inserts
-- a row into `workspace_members` upon redemption instead of deleting accounts.

-- 1. Create account_invitations Table (mapped to workspaces)
CREATE TABLE IF NOT EXISTS public.account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role <> 'owner'),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for pending invites
CREATE INDEX IF NOT EXISTS idx_account_invitations_account_pending
  ON public.account_invitations(account_id, expires_at)
  WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage workspace invitations" ON public.account_invitations;
CREATE POLICY "Users can manage workspace invitations"
  ON public.account_invitations
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member(account_id, auth.uid()));

-- ============================================================
-- peek_invitation(p_token_hash text)
--
-- Anonymous read by token hash.
-- ============================================================
CREATE OR REPLACE FUNCTION public.peek_invitation(
  p_token_hash TEXT
) RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv account_invitations%ROWTYPE;
  v_workspace_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'used');
  END IF;

  IF v_inv.expires_at <= NOW() THEN
    RETURN json_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT name INTO v_workspace_name
  FROM workspaces
  WHERE id = v_inv.account_id;

  RETURN json_build_object(
    'ok', true,
    'account_name', v_workspace_name,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at
  );
END;
$$;

ALTER FUNCTION public.peek_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.peek_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_invitation(TEXT) TO anon, authenticated;

-- ============================================================
-- redeem_invitation(p_token_hash text)
--
-- Authenticated. Adds user to workspace_members.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS TEXT  -- the joined workspace_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_db_role public.workspace_role;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  -- Map AccountRole ('admin', 'agent', 'viewer') to workspace_role ('admin', 'member')
  IF v_inv.role = 'admin' THEN
    v_db_role := 'admin';
  ELSE
    v_db_role := 'member';
  END IF;

  -- Add the caller to workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.account_id, v_caller_id, v_db_role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Stamp the invitation as accepted
  UPDATE public.account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  RETURN v_inv.account_id::TEXT;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
