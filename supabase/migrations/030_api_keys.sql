-- ============================================================
-- 030_api_keys.sql — Public API credentials
--
-- Ported and adapted from upstream 026_api_keys.sql.
--
-- Adaptation: upstream scoped keys to `accounts`; we scope to
-- `workspaces`. RLS mirrors our workspace_members role model:
-- any member may list keys; owner/admin may create/revoke.
--
-- Design:
--   - Workspace-scoped, not user-scoped. created_by records who
--     minted the key (audit) and is ON DELETE SET NULL so removing
--     a team member doesn't cascade-delete active API keys.
--   - Only SHA-256 hash stored — never the plaintext key. The
--     caller receives the key exactly once at creation.
--   - key_prefix is a short display string (e.g. "dcrm_a1b2c3d4")
--     so the UI can identify keys without revealing the secret.
--   - scopes[] (app-layer model). The DB doesn't constrain the
--     vocabulary — a new scope is a code change, not a migration.
--   - The public-API auth path reads with service_role client
--     (RLS-bypassing) since API callers have no Supabase session.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_id_idx ON api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Any workspace member (viewer+) can see the key roster.
DROP POLICY IF EXISTS api_keys_select ON api_keys;
CREATE POLICY api_keys_select ON api_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
  ));

-- Owner / admin may create keys.
DROP POLICY IF EXISTS api_keys_insert ON api_keys;
CREATE POLICY api_keys_insert ON api_keys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ));

-- Owner / admin may update (revoke by setting revoked_at).
DROP POLICY IF EXISTS api_keys_update ON api_keys;
CREATE POLICY api_keys_update ON api_keys FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ));

-- Owner / admin may hard-delete a key.
DROP POLICY IF EXISTS api_keys_delete ON api_keys;
CREATE POLICY api_keys_delete ON api_keys FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ));
