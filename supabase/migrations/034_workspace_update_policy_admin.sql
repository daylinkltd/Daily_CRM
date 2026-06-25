-- ── 034_workspace_update_policy_admin.sql — Update workspaces FOR UPDATE policy
--
-- Drops the old "Workspace owners can update their workspace" policy.
-- Replaces it with a policy that allows both workspace owners and admins to update the workspace details (like name and default currency).

DROP POLICY IF EXISTS "Workspace owners can update their workspace" ON public.workspaces;

CREATE POLICY "Workspace owners and admins can update their workspace"
ON public.workspaces FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = public.workspaces.id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = public.workspaces.id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    )
);
