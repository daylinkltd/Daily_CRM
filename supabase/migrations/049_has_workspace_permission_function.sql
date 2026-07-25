-- supabase/migrations/049_has_workspace_permission_function.sql
-- ===========================================================================
-- ABAC Permission Helper Function
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.has_workspace_permission(
    p_workspace_id UUID,
    p_user_id UUID,
    p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permissions JSONB;
BEGIN
    -- 1. Owners and Admins automatically pass all permission checks
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND role IN ('owner', 'admin')
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Otherwise check custom role permissions JSONB bitmask
    SELECT wr.permissions INTO v_permissions
    FROM public.workspace_members wm
    JOIN public.workspace_roles wr ON wm.role_id = wr.id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_user_id;

    IF v_permissions IS NOT NULL AND (v_permissions->>p_permission)::boolean IS TRUE THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_workspace_permission(UUID, UUID, TEXT) TO authenticated, service_role;
