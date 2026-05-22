-- Create a security definer function to check if user is owner/admin
-- This prevents infinite recursion in RLS policies on workspace_members
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND role IN ('owner', 'admin')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID, UUID) TO authenticated;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Active members can view workspace members" ON public.workspace_members;

-- Recreate it using the new SECURITY DEFINER function to avoid infinite recursion
CREATE POLICY "Active members can view workspace members"
ON public.workspace_members FOR SELECT
USING (
  public.is_active_workspace_member(workspace_id, auth.uid())
  OR 
  public.is_workspace_admin(workspace_id, auth.uid())
);
