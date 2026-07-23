-- supabase/migrations/039_people_and_projects.sql

-- ===========================================================================
-- HR / People Module Schema
-- ===========================================================================

-- 1. Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage departments" ON public.departments
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 2. Designations
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage designations" ON public.designations
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

-- 3. Employee Profiles (Extends workspace_members)
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    workspace_member_id UUID PRIMARY KEY REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    employee_code TEXT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    manager_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    joining_date DATE,
    employment_type TEXT,
    salary_grade TEXT,
    emergency_contact JSONB,
    address TEXT,
    notes TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage employee_profiles" ON public.employee_profiles
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    punch_in_time TIMESTAMPTZ,
    punch_out_time TIMESTAMPTZ,
    punch_in_location JSONB, 
    punch_out_location JSONB,
    working_hours NUMERIC,
    status TEXT CHECK (status IN ('Present', 'Absent', 'Late', 'Remote', 'Half-Day')),
    remarks TEXT,
    UNIQUE(workspace_member_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON public.attendance(workspace_member_id, attendance_date);
CREATE POLICY "Active members can manage attendance" ON public.attendance
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 5. Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage leave_requests" ON public.leave_requests
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 6. Employee Assets
CREATE TABLE IF NOT EXISTS public.employee_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    asset_name TEXT NOT NULL,
    serial_number TEXT,
    assigned_date DATE,
    returned_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage employee_assets" ON public.employee_assets
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.employee_assets ENABLE ROW LEVEL SECURITY;

-- 7. Employee Documents
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage employee_documents" ON public.employee_documents
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- Projects & Tasks Module Schema
-- ===========================================================================

-- 1. Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    manager_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    project_source TEXT DEFAULT 'MANUAL' CHECK (project_source IN ('MANUAL', 'CRM', 'AUTOMATION', 'IMPORT', 'API')),
    budget NUMERIC,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage projects" ON public.projects
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 2. Project Members
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    role TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, workspace_member_id)
);
CREATE POLICY "Active members can manage project_members" ON public.project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_members.project_id
            AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3. Project Columns
CREATE TABLE IF NOT EXISTS public.project_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage project_columns" ON public.project_columns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_columns.project_id
            AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

-- 4. Project Activity
CREATE TABLE IF NOT EXISTS public.project_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage project_activity" ON public.project_activity
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_activity.project_id
            AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- 5. Tasks (Core Unit)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE, 
    column_id UUID REFERENCES public.project_columns(id) ON DELETE SET NULL,
    assigned_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_by_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'PROJECT' CHECK (task_type IN ('PROJECT', 'GENERAL', 'SUPPORT', 'MEETING', 'TRAINING', 'ADMIN')),
    status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED')),
    priority TEXT DEFAULT 'medium',
    estimated_hours NUMERIC,
    sort_order INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assigned_workspace_member_id);
CREATE POLICY "Active members can manage tasks" ON public.tasks
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage task_comments" ON public.task_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_comments.task_id
            AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- 7. Task Files
CREATE TABLE IF NOT EXISTS public.task_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage task_files" ON public.task_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_files.task_id
            AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.task_files ENABLE ROW LEVEL SECURITY;

-- 8. Time Logs
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration NUMERIC NOT NULL,
    billable BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_member_date ON public.time_logs(workspace_member_id, log_date);
CREATE POLICY "Active members can manage time_logs" ON public.time_logs
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;


-- ===========================================================================
-- ABAC Permissions Update
-- Need to update get_user_permissions function to support new modules
-- (Original is in 015_abac_roles_and_owner_creation.sql, overriding it here)
-- ===========================================================================

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
      "reports": true, "manage_users": true, "manage_roles": true, "manage_workspaces": true,
      "people_view": true, "people_manage": true, "attendance_manage": true, "leave_approve": true,
      "projects_view": true, "projects_manage": true
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
      "reports": true, "manage_users": true, "manage_roles": false, "manage_workspaces": false,
      "people_view": true, "people_manage": true, "attendance_manage": true, "leave_approve": true,
      "projects_view": true, "projects_manage": true
    }'::jsonb;
  END IF;

  -- Default member fallback
  RETURN '{
    "inbox": true, "contacts": true, "pipelines": false, "broadcasts": false,
    "automations": false, "integrations": false, "settings_profile": true,
    "settings_workspace": false, "settings_templates": false, "settings_tags": false,
    "reports": false, "manage_users": false, "manage_roles": false, "manage_workspaces": false,
    "people_view": true, "people_manage": false, "attendance_manage": false, "leave_approve": false,
    "projects_view": true, "projects_manage": false
  }'::jsonb;
END;
$$;

-- ===========================================================================
-- Backfills
-- ===========================================================================

-- Backfill Employee Profiles for existing members
INSERT INTO public.employee_profiles (workspace_member_id, workspace_id)
SELECT id, workspace_id FROM public.workspace_members
ON CONFLICT (workspace_member_id) DO NOTHING;

