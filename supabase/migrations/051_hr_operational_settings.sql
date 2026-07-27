-- supabase/migrations/051_hr_operational_settings.sql

-- ===========================================================================
-- HR Operational Settings & Hierarchical Scope Overrides Schema
-- ===========================================================================

-- Permission Helper Function (Ensures RLS policies pass)
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
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND role IN ('owner', 'admin')
    ) THEN
        RETURN TRUE;
    END IF;

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

CREATE TABLE IF NOT EXISTS public.hr_operational_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    setting_type TEXT NOT NULL CHECK (setting_type IN ('ATTENDANCE_SHIFT', 'LEAVE_RULES', 'PAYROLL_CONFIG')),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('WORKSPACE_DEFAULT', 'DEPARTMENT', 'DESIGNATION', 'MEMBER')),
    scope_id UUID, -- NULL when scope_type is WORKSPACE_DEFAULT, otherwise references department.id, designation.id, or workspace_member.id
    
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, setting_type, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_operational_settings_workspace ON public.hr_operational_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_operational_settings_scope ON public.hr_operational_settings(scope_type, scope_id);

-- RLS Policies
CREATE POLICY "Active members can view hr_operational_settings" ON public.hr_operational_settings
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_operational_settings" ON public.hr_operational_settings
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'settings_workspace'::text)
    );

ALTER TABLE public.hr_operational_settings ENABLE ROW LEVEL SECURITY;
