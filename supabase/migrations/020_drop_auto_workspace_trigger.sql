-- ── 020: Remove automatic workspace creation trigger ───────────────────────
--
-- The trigger `on_auth_user_created_workspace` auto-created a workspace for
-- every new auth user (including the SaaS admin). This is wrong:
--
-- - SaaS admin (super_admin) should NEVER get a workspace
-- - Tenant owners get their root workspace explicitly via the
--   create_owner_with_workspace() RPC called from the admin dashboard
-- - Regular workspace members are invited in, not auto-provisioned
--
-- We drop the trigger and the function entirely.
-- Workspace creation is now fully explicit and intentional.

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_workspace();
