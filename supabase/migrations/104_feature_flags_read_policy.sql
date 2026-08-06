-- ============================================================
-- 104 — let tenants READ their own platform feature flags
-- ============================================================
--
-- The SaaS console writes per-tenant module kill switches to
-- `saas_workspace_feature_flags`, and until now nothing on the tenant
-- side read them — the table had RLS enabled with no SELECT policy, so
-- the client's fetch returned nothing and every module stayed on.
--
-- This adds exactly one capability: a workspace member may read THEIR
-- OWN workspace's flag row. Writes stay service-role only (the console),
-- because a tenant who could write this table could switch their own
-- modules back on.
-- ============================================================

BEGIN;

ALTER TABLE public.saas_workspace_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read_own_workspace
  ON public.saas_workspace_feature_flags;
CREATE POLICY feature_flags_read_own_workspace
  ON public.saas_workspace_feature_flags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
       WHERE m.workspace_id = saas_workspace_feature_flags.workspace_id
         AND m.user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
--  WHERE tablename = 'saas_workspace_feature_flags';
--   -- expect exactly one row: feature_flags_read_own_workspace / SELECT
--
-- As any signed-in member (SQL editor impersonation or the app):
--   SELECT * FROM saas_workspace_feature_flags;   -- only their row(s)
-- Any INSERT/UPDATE as authenticated must fail (no policy for it).
-- ============================================================
