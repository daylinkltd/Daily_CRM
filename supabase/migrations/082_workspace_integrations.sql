-- ============================================================
-- 082 — workspace_integrations.
--
-- The Outlook App Registration feature (/api/integrations/outlook)
-- upserts into `workspace_integrations`, but no migration ever
-- created it — the table is absent in production, so saving the
-- config fails with PGRST205 and Outlook can't be connected at all.
--
-- One row per (workspace, provider). Credentials live in `settings`
-- with the secret already encrypted by the application
-- (settings.encrypted_client_secret, via @/lib/whatsapp/encryption),
-- so this table never holds a plaintext secret.
--
-- Generic by design: the same shape serves future providers
-- (google, smtp, ses, email-marketing) without another migration.
--
-- Idempotent; validated in Docker.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'inactive'
               CHECK (status IN ('active', 'inactive', 'error')),
  -- Provider-specific config. Secrets MUST be stored encrypted by the
  -- application layer; never write a plaintext secret here.
  settings     JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error   TEXT,
  updated_by   UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The upsert in /api/integrations/outlook targets this constraint.
  UNIQUE (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace
  ON public.workspace_integrations (workspace_id);

ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

-- Reading the roster is fine for members (the secret is encrypted and
-- is never rendered), but only admins may connect or change a
-- provider — these credentials can send mail as the whole tenant.
-- 'integrations' is the existing role flag (owners/admins bypass it
-- inside has_workspace_permission); a made-up key would never match.
DROP POLICY IF EXISTS workspace_integrations_select ON public.workspace_integrations;
CREATE POLICY workspace_integrations_select ON public.workspace_integrations
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS workspace_integrations_admin ON public.workspace_integrations;
CREATE POLICY workspace_integrations_admin ON public.workspace_integrations
  FOR ALL
  USING (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  )
  WITH CHECK (
    public.is_active_workspace_member(workspace_id, auth.uid())
    AND public.has_workspace_permission(workspace_id, auth.uid(), 'integrations'::text)
  );

DROP TRIGGER IF EXISTS set_updated_at ON public.workspace_integrations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.workspace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
