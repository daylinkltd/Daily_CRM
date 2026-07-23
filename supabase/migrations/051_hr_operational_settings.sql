-- supabase/migrations/051_hr_operational_settings.sql

-- ===========================================================================
-- HR Operational Settings & Hierarchical Scope Overrides Schema
-- ===========================================================================

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
