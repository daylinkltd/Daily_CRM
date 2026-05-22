-- supabase/migrations/012_workspace_rls_fix.sql
--
-- Adds missing INSERT / UPDATE / DELETE RLS policies on the workspaces and
-- workspace_members tables so that authenticated users can:
--   • Create new workspaces from the UI
--   • Be added as owner member immediately after creation
--   • Rename / delete workspaces they own
--
-- Root cause: migrations 009 and 010 only defined SELECT policies, leaving
-- all write operations blocked by RLS for non-service-role clients.
-- ---------------------------------------------------------------------------

-- ── workspaces ──────────────────────────────────────────────────────────────

-- Any authenticated user may create a workspace (they become owner next)
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only owners of a workspace may rename it
DROP POLICY IF EXISTS "Workspace owners can update their workspace" ON public.workspaces;
CREATE POLICY "Workspace owners can update their workspace"
ON public.workspaces FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = public.workspaces.id
          AND user_id = auth.uid()
          AND role = 'owner'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = public.workspaces.id
          AND user_id = auth.uid()
          AND role = 'owner'
    )
);

-- Only owners of a workspace may delete it
DROP POLICY IF EXISTS "Workspace owners can delete their workspace" ON public.workspaces;
CREATE POLICY "Workspace owners can delete their workspace"
ON public.workspaces FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = public.workspaces.id
          AND user_id = auth.uid()
          AND role = 'owner'
    )
);


-- ── workspace_members ────────────────────────────────────────────────────────

-- A user may insert their own membership row (needed right after workspace creation,
-- and when accepting an invite). The workspace must already exist (FK enforced).
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
CREATE POLICY "Users can join workspaces"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Owners and admins may add other members (invite flow)
DROP POLICY IF EXISTS "Workspace admins can add members" ON public.workspace_members;
CREATE POLICY "Workspace admins can add members"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = public.workspace_members.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- Owners and admins may update member roles
DROP POLICY IF EXISTS "Workspace admins can update member roles" ON public.workspace_members;
CREATE POLICY "Workspace admins can update member roles"
ON public.workspace_members FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = public.workspace_members.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = public.workspace_members.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- Owners and admins may remove members; members may remove themselves
DROP POLICY IF EXISTS "Workspace admins can remove members" ON public.workspace_members;
CREATE POLICY "Workspace admins can remove members"
ON public.workspace_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()   -- self-removal
    OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = public.workspace_members.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);
