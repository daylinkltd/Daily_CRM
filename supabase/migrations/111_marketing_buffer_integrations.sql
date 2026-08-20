-- ============================================================
-- 111 — Dynamic Multi-Tenant Buffer Integration
--
-- Enables OAuth 2.0 PKCE connection to Buffer for multi-tenant
-- social media management, organization selection, and channel
-- synchronization.
--
-- All credentials stored encrypted at rest via AES-256-GCM.
-- Strictly scoped to workspace_id with Row-Level Security.
-- ============================================================

-- 1. Marketing Integrations (1 active connection per provider per workspace)
CREATE TABLE IF NOT EXISTS public.marketing_integrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'buffer',
  provider_account_id       TEXT,
  provider_account_name     TEXT,
  provider_account_email    TEXT,
  provider_organization_id  TEXT,
  provider_organization_name TEXT,
  access_token_encrypted    TEXT,
  refresh_token_encrypted   TEXT,
  token_expires_at          TIMESTAMPTZ,
  scopes                    TEXT[] DEFAULT ARRAY[]::TEXT[],
  status                    TEXT NOT NULL DEFAULT 'connected'
                            CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  last_error                TEXT,
  connected_by_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at            TIMESTAMPTZ,
  UNIQUE (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_marketing_integrations_workspace
  ON public.marketing_integrations (workspace_id);

ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_integrations_select ON public.marketing_integrations;
CREATE POLICY marketing_integrations_select ON public.marketing_integrations
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_integrations_admin ON public.marketing_integrations;
CREATE POLICY marketing_integrations_admin ON public.marketing_integrations
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  );

DROP TRIGGER IF EXISTS set_marketing_integrations_updated_at ON public.marketing_integrations;
CREATE TRIGGER set_marketing_integrations_updated_at
  BEFORE UPDATE ON public.marketing_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Marketing Social Channels (Channels belonging to the tenant's Buffer organization)
CREATE TABLE IF NOT EXISTS public.marketing_social_channels (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id            UUID NOT NULL REFERENCES public.marketing_integrations(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'buffer',
  provider_channel_id       TEXT NOT NULL,
  provider_organization_id  TEXT,
  platform                  TEXT NOT NULL,
  display_name              TEXT NOT NULL,
  username                  TEXT,
  avatar_url                TEXT,
  external_url              TEXT,
  is_enabled                BOOLEAN NOT NULL DEFAULT true,
  status                    TEXT NOT NULL DEFAULT 'connected'
                            CHECK (status IN ('connected', 'disconnected', 'error', 'paused')),
  connected_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider, provider_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_social_channels_workspace
  ON public.marketing_social_channels (workspace_id);

CREATE INDEX IF NOT EXISTS idx_marketing_social_channels_integration
  ON public.marketing_social_channels (integration_id);

ALTER TABLE public.marketing_social_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_social_channels_select ON public.marketing_social_channels;
CREATE POLICY marketing_social_channels_select ON public.marketing_social_channels
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_social_channels_admin ON public.marketing_social_channels;
CREATE POLICY marketing_social_channels_admin ON public.marketing_social_channels
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  );


-- 3. Marketing OAuth PKCE States (short-lived session state verification)
CREATE TABLE IF NOT EXISTS public.marketing_oauth_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state         TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'buffer',
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_oauth_states_lookup
  ON public.marketing_oauth_states (state, expires_at);

ALTER TABLE public.marketing_oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role will manage oauth states; members can insert for their own active workspace
DROP POLICY IF EXISTS marketing_oauth_states_insert ON public.marketing_oauth_states;
CREATE POLICY marketing_oauth_states_insert ON public.marketing_oauth_states
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_workspace_member(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS marketing_oauth_states_select ON public.marketing_oauth_states;
CREATE POLICY marketing_oauth_states_select ON public.marketing_oauth_states
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_active_workspace_member(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS marketing_oauth_states_delete ON public.marketing_oauth_states;
CREATE POLICY marketing_oauth_states_delete ON public.marketing_oauth_states
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_active_workspace_member(workspace_id, auth.uid())
  );
