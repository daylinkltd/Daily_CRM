-- ============================================================
-- 029_member_presence.sql — Team member presence (online/away)
--
-- Ported and adapted from upstream 024_member_presence.sql.
--
-- Adaptation: upstream scoped presence to `accounts`; we scope
-- to `workspaces` (our multi-tenant model). The touch_presence
-- RPC resolves workspace_id from workspace_members rather than
-- account_id from profiles.
--
-- Design:
--   Active clients heartbeat every ~30s via touch_presence().
--   "Offline" is derived from staleness (now() - last_seen_at),
--   so a closed tab resolves to offline without an unload write.
--
-- Visibility: any workspace member can read presence for their
-- workspace. Writes flow only through touch_presence() SECURITY
-- DEFINER — no client INSERT/UPDATE/DELETE policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS member_presence (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_presence_workspace_idx
  ON member_presence(workspace_id);

ALTER TABLE member_presence ENABLE ROW LEVEL SECURITY;

-- Any workspace member can see presence for their workspace.
DROP POLICY IF EXISTS member_presence_select ON member_presence;
CREATE POLICY member_presence_select ON member_presence FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = member_presence.workspace_id
      AND wm.user_id = auth.uid()
  ));

-- Heartbeat RPC — upserts the caller's presence. SECURITY DEFINER
-- so it can write without a client write policy. Workspace is
-- resolved from the caller's own membership (never client-supplied).
CREATE OR REPLACE FUNCTION public.touch_presence(
  p_status TEXT DEFAULT 'online'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('online', 'away') THEN
    RAISE EXCEPTION 'Invalid presence status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'No workspace for caller' USING ERRCODE = '22023';
  END IF;

  INSERT INTO member_presence (user_id, workspace_id, status, last_seen_at)
  VALUES (auth.uid(), v_workspace_id, p_status, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status       = excluded.status,
        last_seen_at = now(),
        workspace_id = excluded.workspace_id;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'member_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE member_presence;
  END IF;
END $$;
