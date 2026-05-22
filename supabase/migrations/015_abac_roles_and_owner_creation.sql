-- ===========================================================================
-- 015_abac_roles_and_owner_creation.sql
--
-- Implements full ABAC (Attribute-Based Access Control) for workspaces:
--   1. workspace_roles  — custom roles defined per workspace by the owner
--   2. role_permissions — feature-flag bitmask per role (JSONB)
--   3. profiles.status  — active | blocked | pending (cascade block on owner)
--   4. workspace_members now carries role_id (FK to workspace_roles)
--   5. create_owner_with_workspace RPC — called by SaaS Admin service-role API
--   6. Updated RLS: blocked owner → all tenant members are blocked
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Add status column to profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'blocked', 'pending'));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);


-- ---------------------------------------------------------------------------
-- 2. workspace_roles — custom ABAC roles owned by a workspace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  -- JSONB permissions bitmask. Keys are feature strings, values are booleans.
  -- Known keys: inbox, contacts, pipelines, broadcasts, automations,
  --             integrations, settings_profile, settings_workspace,
  --             settings_templates, settings_tags, reports
  permissions  JSONB NOT NULL DEFAULT '{
    "inbox": true,
    "contacts": true,
    "pipelines": false,
    "broadcasts": false,
    "automations": false,
    "integrations": false,
    "settings_profile": true,
    "settings_workspace": false,
    "settings_templates": false,
    "settings_tags": false,
    "reports": false
  }'::jsonb,
  is_system    BOOLEAN NOT NULL DEFAULT false, -- true = owner/admin/member built-ins
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;

-- Only workspace members can view their workspace's roles
CREATE POLICY "Members can view workspace roles"
ON public.workspace_roles FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Only owners can create/modify/delete roles
CREATE POLICY "Owners can manage workspace roles"
ON public.workspace_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.workspace_roles.workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
);

CREATE POLICY "Owners can update workspace roles"
ON public.workspace_roles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.workspace_roles.workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.workspace_roles.workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
);

CREATE POLICY "Owners can delete workspace roles"
ON public.workspace_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.workspace_roles.workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
);


-- ---------------------------------------------------------------------------
-- 3. Add role_id to workspace_members (nullable — uses role enum if NULL)
--    role_id points to a custom role; when NULL, the enum `role` applies.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.workspace_roles(id) ON DELETE SET NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_workspace_members_role_id
  ON public.workspace_members(role_id);


-- ---------------------------------------------------------------------------
-- 4. RPC: create_owner_with_workspace
--    Called ONLY by the service-role API route (SaaS Admin creates an owner).
--    Creates a root workspace for the owner and seeds system roles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_owner_with_workspace(
  p_user_id UUID,
  p_org_name TEXT
)
RETURNS TABLE (workspace_id UUID, workspace_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_ws_name      TEXT;
  v_role_owner   UUID;
  v_role_admin   UUID;
  v_role_member  UUID;
BEGIN
  -- Sanitize org name
  v_ws_name := trim(p_org_name);
  IF v_ws_name = '' THEN
    RAISE EXCEPTION 'Organisation name cannot be empty';
  END IF;

  -- 1. Create the root workspace
  INSERT INTO public.workspaces (name)
  VALUES (v_ws_name)
  RETURNING id INTO v_workspace_id;

  -- 2. Add the user as workspace owner (using the existing role enum)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'owner');

  -- 3. Seed system roles for this workspace
  --    These are the defaults users can pick from; owners can add custom ones.

  INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
  VALUES (v_workspace_id, 'Admin', 'Can manage team, settings, and all CRM features', true, '{
    "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
    "automations": true, "integrations": true, "settings_profile": true,
    "settings_workspace": true, "settings_templates": true, "settings_tags": true,
    "reports": true
  }'::jsonb)
  RETURNING id INTO v_role_admin;

  INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
  VALUES (v_workspace_id, 'Agent', 'Can view inbox and manage contacts', true, '{
    "inbox": true, "contacts": true, "pipelines": true, "broadcasts": false,
    "automations": false, "integrations": false, "settings_profile": true,
    "settings_workspace": false, "settings_templates": false, "settings_tags": false,
    "reports": false
  }'::jsonb)
  RETURNING id INTO v_role_member;

  RETURN QUERY SELECT v_workspace_id, v_ws_name;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_with_workspace(UUID, TEXT) FROM PUBLIC;
-- Only callable via service role (no GRANT to authenticated)


-- ---------------------------------------------------------------------------
-- 5. Helper: get_user_permissions(workspace_id)
--    Returns the permissions JSONB for the calling user in a workspace.
--    Falls back to system defaults if no custom role_id is set.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_role_id   UUID;
  v_perms     JSONB;
BEGIN
  SELECT role, role_id INTO v_role, v_role_id
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Owner always gets everything
  IF v_role = 'owner' THEN
    RETURN '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
      "automations": true, "integrations": true, "settings_profile": true,
      "settings_workspace": true, "settings_templates": true, "settings_tags": true,
      "reports": true, "manage_users": true, "manage_roles": true, "manage_workspaces": true
    }'::jsonb;
  END IF;

  -- If a custom role_id is set, use those permissions
  IF v_role_id IS NOT NULL THEN
    SELECT permissions INTO v_perms
    FROM public.workspace_roles
    WHERE id = v_role_id AND workspace_id = p_workspace_id;
    IF FOUND THEN
      RETURN v_perms;
    END IF;
  END IF;

  -- Fallback: system defaults by role enum
  IF v_role = 'admin' THEN
    RETURN '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
      "automations": true, "integrations": true, "settings_profile": true,
      "settings_workspace": true, "settings_templates": true, "settings_tags": true,
      "reports": true, "manage_users": true, "manage_roles": false, "manage_workspaces": false
    }'::jsonb;
  END IF;

  -- Default member fallback
  RETURN '{
    "inbox": true, "contacts": true, "pipelines": false, "broadcasts": false,
    "automations": false, "integrations": false, "settings_profile": true,
    "settings_workspace": false, "settings_templates": false, "settings_tags": false,
    "reports": false, "manage_users": false, "manage_roles": false, "manage_workspaces": false
  }'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 6. Helper: is_owner_blocked(workspace_id)
--    Returns TRUE if the workspace owner's profile is blocked.
--    Used in RLS to cascade-block all tenant members.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner_blocked(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.role = 'owner'
      AND p.status = 'blocked'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_owner_blocked(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. Helper: is_active_workspace_member(workspace_id, user_id)
--    Replaces is_workspace_member in data-table RLS. Checks:
--    (a) user is a member  (b) user's own profile is active
--    (c) workspace owner is NOT blocked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_workspace_member(
  p_workspace_id UUID,
  p_user_id      UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_user_id
      AND p.status = 'active'
  )
  AND NOT public.is_owner_blocked(p_workspace_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(UUID, UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 8. Update data-table RLS to use is_active_workspace_member
--    (replaces is_workspace_member checks on contacts, conversations, etc.)
-- ---------------------------------------------------------------------------

-- Contacts
DROP POLICY IF EXISTS "Users can manage workspace contacts" ON public.contacts;
CREATE POLICY "Active members can manage workspace contacts" ON public.contacts
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Tags
DROP POLICY IF EXISTS "Users can manage workspace tags" ON public.tags;
CREATE POLICY "Active members can manage workspace tags" ON public.tags
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Custom Fields
DROP POLICY IF EXISTS "Users can manage workspace custom fields" ON public.custom_fields;
CREATE POLICY "Active members can manage workspace custom fields" ON public.custom_fields
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Conversations
DROP POLICY IF EXISTS "Users can manage workspace conversations" ON public.conversations;
CREATE POLICY "Active members can manage workspace conversations" ON public.conversations
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- WhatsApp Config
DROP POLICY IF EXISTS "Users can manage workspace config" ON public.whatsapp_config;
CREATE POLICY "Active members can manage workspace config" ON public.whatsapp_config
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Message Templates
DROP POLICY IF EXISTS "Users can manage workspace templates" ON public.message_templates;
CREATE POLICY "Active members can manage workspace templates" ON public.message_templates
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Pipelines
DROP POLICY IF EXISTS "Users can manage workspace pipelines" ON public.pipelines;
CREATE POLICY "Active members can manage workspace pipelines" ON public.pipelines
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Pipeline Stages
DROP POLICY IF EXISTS "Users can manage workspace pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Active members can manage workspace pipeline stages" ON public.pipeline_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = pipeline_stages.pipeline_id
      AND public.is_active_workspace_member(pipelines.workspace_id, auth.uid())
    )
  );

-- Deals
DROP POLICY IF EXISTS "Users can manage workspace deals" ON public.deals;
CREATE POLICY "Active members can manage workspace deals" ON public.deals
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Broadcasts
DROP POLICY IF EXISTS "Users can manage workspace broadcasts" ON public.broadcasts;
CREATE POLICY "Active members can manage workspace broadcasts" ON public.broadcasts
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Automations
DROP POLICY IF EXISTS "Users can manage workspace automations" ON public.automations;
CREATE POLICY "Active members can manage workspace automations" ON public.automations
  FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Automation Steps
DROP POLICY IF EXISTS "Users can manage workspace automation steps" ON public.automation_steps;
CREATE POLICY "Active members can manage workspace automation steps" ON public.automation_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_steps.automation_id
      AND public.is_active_workspace_member(automations.workspace_id, auth.uid())
    )
  );

-- Automation Logs
DROP POLICY IF EXISTS "Users can view workspace automation logs" ON public.automation_logs;
CREATE POLICY "Active members can view workspace automation logs" ON public.automation_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_logs.automation_id
      AND public.is_active_workspace_member(automations.workspace_id, auth.uid())
    )
  );

-- workspace_members SELECT — use active check
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
CREATE POLICY "Active members can view workspace members"
ON public.workspace_members FOR SELECT
USING (
  public.is_active_workspace_member(workspace_id, auth.uid())
  OR -- Owners/admins can still see even if some members are blocked
  EXISTS (
    SELECT 1 FROM public.workspace_members wm2
    WHERE wm2.workspace_id = public.workspace_members.workspace_id
      AND wm2.user_id = auth.uid()
      AND wm2.role IN ('owner', 'admin')
  )
);
