-- supabase/combined_hr_and_projects_setup.sql

-- ===========================================================================
-- Master Combined HR, Projects & Enterprise Extensions Setup Script
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

-- supabase/migrations/040_payroll_management.sql

-- ===========================================================================
-- HR / Payroll Management Schema
-- ===========================================================================

-- 1. Payroll Cycles
CREATE TABLE IF NOT EXISTS public.payroll_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
    processed_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    total_payout NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, month, year)
);
CREATE POLICY "Active members can manage payroll_cycles" ON public.payroll_cycles
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.payroll_cycles ENABLE ROW LEVEL SECURITY;

-- 2. Expense Claims
CREATE TABLE IF NOT EXISTS public.expense_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Travel', 'Meals', 'Office Supplies', 'Client Meeting', 'Other')),
    amount NUMERIC NOT NULL,
    description TEXT,
    receipt_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage expense_claims" ON public.expense_claims
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

-- 3. Salary Advances
CREATE TABLE IF NOT EXISTS public.salary_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deducted')),
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage salary_advances" ON public.salary_advances
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- 4. Payslips
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    payroll_cycle_id UUID NOT NULL REFERENCES public.payroll_cycles(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    
    -- Earnings
    basic_salary NUMERIC DEFAULT 0,
    hra NUMERIC DEFAULT 0,
    lta NUMERIC DEFAULT 0,
    special_allowance NUMERIC DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    reimbursements NUMERIC DEFAULT 0, -- Pulled from approved expense_claims
    total_earnings NUMERIC DEFAULT 0,
    
    -- Deductions
    pf_deduction NUMERIC DEFAULT 0,
    tds_deduction NUMERIC DEFAULT 0,
    professional_tax NUMERIC DEFAULT 0,
    unpaid_leave_deduction NUMERIC DEFAULT 0,
    advance_deduction NUMERIC DEFAULT 0, -- Pulled from salary_advances
    total_deductions NUMERIC DEFAULT 0,
    
    -- Final
    net_payable NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paid')),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(payroll_cycle_id, workspace_member_id)
);
CREATE POLICY "Active members can manage payslips" ON public.payslips
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
-- supabase/migrations/041_project_management_v2.sql

-- Add parent_id to tasks for subtasks support
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Ensure RLS on task_comments allows reading and writing for workspace members
-- (Already handled in 039_people_and_projects.sql, but we can double check)

-- Ensure RLS on task_files allows reading and writing for workspace members
-- (Already handled in 039_people_and_projects.sql)

-- Create storage bucket for project-files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for project-files bucket
CREATE POLICY "Active members can view project-files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Active members can insert project-files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Active members can delete project-files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'project-files' 
        AND auth.role() = 'authenticated'
    );
-- supabase/migrations/042_project_management_sprint2.sql

-- ===========================================================================
-- Sprint 2 Architecture: Methodologies, Planning, Organization, and Audit
-- ===========================================================================

-- 1. Project Methodologies
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'BASIC' CHECK (project_type IN ('SCRUM', 'KANBAN', 'BASIC'));

-- 2. Sprints & Epics
CREATE TABLE IF NOT EXISTS public.sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage sprints" ON public.sprints
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = sprints.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage epics" ON public.epics
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = epics.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;

-- 3. Labels & Components
CREATE TABLE IF NOT EXISTS public.workspace_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'slate',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);
CREATE POLICY "Active members can manage workspace_labels" ON public.workspace_labels
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.workspace_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.project_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);
CREATE POLICY "Active members can manage project_components" ON public.project_components
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_components.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_components ENABLE ROW LEVEL SECURITY;

-- 4. Update Tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON public.tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_epic ON public.tasks(epic_id);

-- 5. Join Tables (Many to Many)
CREATE TABLE IF NOT EXISTS public.task_labels (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.workspace_labels(id) ON DELETE CASCADE,
    PRIMARY KEY(task_id, label_id)
);
CREATE POLICY "Active members can manage task_labels" ON public.task_labels
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_labels.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.task_components (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.project_components(id) ON DELETE CASCADE,
    PRIMARY KEY(task_id, component_id)
);
CREATE POLICY "Active members can manage task_components" ON public.task_components
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_components.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_components ENABLE ROW LEVEL SECURITY;

-- 6. Watchers
CREATE TABLE IF NOT EXISTS public.task_watchers (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(task_id, workspace_member_id)
);
CREATE POLICY "Active members can manage task_watchers" ON public.task_watchers
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_watchers.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

-- 7. Task Activity (Audit Log)
CREATE TABLE IF NOT EXISTS public.task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL, -- Who did it
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity(task_id);
CREATE POLICY "Active members can read task_activity" ON public.task_activity
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_activity.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
-- Allow service role or trigger to insert
CREATE POLICY "Allow trigger to insert task_activity" ON public.task_activity
    FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- 8. Activity Trigger
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
BEGIN
    -- Attempt to get the workspace_member_id of the person making the change.
    -- This relies on the client passing the member ID via a custom header or query if possible,
    -- but usually Supabase triggers run as postgres. We can extract user_id from auth.uid()
    -- and find their workspace_member_id for this task's workspace.
    IF auth.uid() IS NOT NULL THEN
        SELECT id INTO v_member_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND workspace_id = NEW.workspace_id
        LIMIT 1;
    END IF;

    -- Track Status Change
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'STATUS_CHANGED', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;

    -- Track Priority Change
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'PRIORITY_CHANGED', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
    END IF;

    -- Track Assignee Change
    IF (TG_OP = 'UPDATE' AND OLD.assigned_workspace_member_id IS DISTINCT FROM NEW.assigned_workspace_member_id) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'ASSIGNEE_CHANGED', jsonb_build_object('old', OLD.assigned_workspace_member_id, 'new', NEW.assigned_workspace_member_id));
    END IF;
    
    -- Track Column Change
    IF (TG_OP = 'UPDATE' AND OLD.column_id IS DISTINCT FROM NEW.column_id) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'COLUMN_CHANGED', jsonb_build_object('old', OLD.column_id, 'new', NEW.column_id));
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_activity_trigger ON public.tasks;
CREATE TRIGGER task_activity_trigger
    AFTER UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_activity();
-- supabase/migrations/043_project_management_sprint3.sql

-- ===========================================================================
-- Sprint 3 Architecture: Custom Workflows & Statuses
-- ===========================================================================

-- 1. Project Statuses
CREATE TABLE IF NOT EXISTS public.project_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    column_id UUID REFERENCES public.project_columns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TODO', 'IN_PROGRESS', 'DONE')),
    color TEXT DEFAULT 'slate',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);
CREATE POLICY "Active members can manage project_statuses" ON public.project_statuses
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_statuses.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- 2. Project Workflows (Transitions)
CREATE TABLE IF NOT EXISTS public.project_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    from_status_id UUID REFERENCES public.project_statuses(id) ON DELETE CASCADE, -- NULL means creation
    to_status_id UUID NOT NULL REFERENCES public.project_statuses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, from_status_id, to_status_id)
);
CREATE POLICY "Active members can manage project_workflows" ON public.project_workflows
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_workflows.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;

-- 3. Add status_id to tasks BEFORE dropping status text column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.project_statuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);

-- 4. Data Migration Script
-- We use an anonymous code block to execute the migration
DO $$
DECLARE
    v_project RECORD;
    v_todo_id UUID;
    v_in_progress_id UUID;
    v_review_id UUID;
    v_done_id UUID;
BEGIN
    -- Loop through all existing projects
    FOR v_project IN SELECT id FROM public.projects LOOP
        
        -- Create default statuses
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'To Do', 'TODO', 'slate', 1) RETURNING id INTO v_todo_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'In Progress', 'IN_PROGRESS', 'blue', 2) RETURNING id INTO v_in_progress_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'Review', 'IN_PROGRESS', 'orange', 3) RETURNING id INTO v_review_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'Done', 'DONE', 'emerald', 4) RETURNING id INTO v_done_id;

        -- Create default workflow transitions (Allow all to all for simplicity in default setup)
        -- In a real strict setup, you might only allow specific paths, but we leave it open.
        
        -- Migrate Tasks
        UPDATE public.tasks SET status_id = v_todo_id WHERE project_id = v_project.id AND status = 'todo';
        UPDATE public.tasks SET status_id = v_in_progress_id WHERE project_id = v_project.id AND status = 'in_progress';
        UPDATE public.tasks SET status_id = v_review_id WHERE project_id = v_project.id AND status = 'review';
        UPDATE public.tasks SET status_id = v_done_id WHERE project_id = v_project.id AND status = 'completed';
        
        -- Also handle any 'blocked' tasks or tasks not covered, default to To Do
        UPDATE public.tasks SET status_id = v_todo_id WHERE project_id = v_project.id AND status_id IS NULL;
        
    END LOOP;
END $$;

-- 5. Drop the old status text column
ALTER TABLE public.tasks DROP COLUMN IF EXISTS status;
-- supabase/migrations/044_project_management_sprint5.sql

-- ===========================================================================
-- Sprint 5 Architecture: Timesheets & Time Tracking Configuration
-- ===========================================================================

-- 1. Project-level Billing Configuration
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS default_billable_time BOOLEAN DEFAULT true;

-- 2. Time Logs Future-Proofing (Approvals & Invoicing)
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS invoice_id UUID; -- Assuming an invoices table will be created later

-- We already have Row Level Security enabled for time_logs from 039_people_and_projects.sql
-- supabase/migrations/045_project_management_sprint6.sql

-- ===========================================================================
-- Sprint 6 Architecture: Automations & Rules Engine
-- ===========================================================================

-- 1. Automations Table
CREATE TABLE IF NOT EXISTS public.project_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Trigger
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('STATUS_CHANGED')),
    trigger_condition JSONB NOT NULL, -- e.g., {"status_id": "uuid"}
    
    -- Action
    action_type TEXT NOT NULL CHECK (action_type IN ('ASSIGN_MEMBER', 'SET_PRIORITY')),
    action_payload JSONB NOT NULL, -- e.g., {"member_id": "uuid"} or {"priority": "high"}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL
);

CREATE INDEX idx_project_automations_project ON public.project_automations(project_id);

-- RLS
CREATE POLICY "Active members can manage project_automations" ON public.project_automations
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.project_automations ENABLE ROW LEVEL SECURITY;


-- 2. Rules Engine Function
CREATE OR REPLACE FUNCTION public.evaluate_project_automations()
RETURNS TRIGGER AS $$
DECLARE
    rule RECORD;
BEGIN
    -- Evaluate rules only if this is an update and the status has changed
    IF TG_OP = 'UPDATE' AND OLD.status_id IS DISTINCT FROM NEW.status_id AND NEW.status_id IS NOT NULL THEN
        
        -- Loop through all active STATUS_CHANGED rules for this project that match the NEW status
        FOR rule IN 
            SELECT * FROM public.project_automations 
            WHERE project_id = NEW.project_id 
            AND is_active = true 
            AND trigger_type = 'STATUS_CHANGED'
            AND (trigger_condition->>'status_id')::TEXT = NEW.status_id::TEXT
        LOOP
            
            -- Action: Assign Member
            IF rule.action_type = 'ASSIGN_MEMBER' THEN
                -- payload: {"member_id": "uuid" or "none"}
                IF (rule.action_payload->>'member_id') = 'none' THEN
                    NEW.assigned_workspace_member_id = NULL;
                ELSE
                    NEW.assigned_workspace_member_id = (rule.action_payload->>'member_id')::UUID;
                END IF;
            END IF;
            
            -- Action: Set Priority
            IF rule.action_type = 'SET_PRIORITY' THEN
                -- payload: {"priority": "high"}
                NEW.priority = (rule.action_payload->>'priority')::TEXT;
            END IF;
            
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to Tasks
DROP TRIGGER IF EXISTS trigger_evaluate_automations ON public.tasks;
CREATE TRIGGER trigger_evaluate_automations
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.evaluate_project_automations();
-- supabase/migrations/046_project_management_sprint7.sql

-- ===========================================================================
-- Sprint 7 Architecture: Invoicing & Billing Integration
-- ===========================================================================

-- 1. Add Hourly Rate to Projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;

-- 2. Create Project Invoices Table
CREATE TABLE IF NOT EXISTS public.project_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    invoice_number TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID')),
    
    total_hours NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    
    UNIQUE(workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_project_invoices_project ON public.project_invoices(project_id);

-- RLS for Invoices
CREATE POLICY "Active members can manage project_invoices" ON public.project_invoices
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;

-- 3. Create Invoice Items Table (Immutable Snapshots)
CREATE TABLE IF NOT EXISTS public.project_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.project_invoices(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1, -- Usually hours
    unit_price NUMERIC NOT NULL DEFAULT 0, -- Snapshot of hourly rate
    amount NUMERIC NOT NULL DEFAULT 0, -- quantity * unit_price
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invoice_items_invoice ON public.project_invoice_items(invoice_id);

-- RLS for Invoice Items
CREATE POLICY "Active members can manage project_invoice_items" ON public.project_invoice_items
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.project_invoice_items ENABLE ROW LEVEL SECURITY;

-- 4. Foreign Key for time_logs to invoices (to lock time logs)
-- We added invoice_id in Sprint 5, now we make it a proper foreign key
ALTER TABLE public.time_logs 
    ADD CONSTRAINT fk_time_logs_invoice 
    FOREIGN KEY (invoice_id) 
    REFERENCES public.project_invoices(id) 
    ON DELETE SET NULL;
-- supabase/migrations/047_project_management_sprint8.sql

-- ===========================================================================
-- Sprint 8 Architecture: Timeline / Gantt Charts
-- ===========================================================================

-- 1. Add start_date to tasks table to support Gantt charts
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date DATE;
-- supabase/migrations/048_project_management_sprint9.sql

-- ===========================================================================
-- Sprint 9 Architecture: Client Portal (Public Sharing)
-- ===========================================================================

-- 1. Add fields to projects for public sharing
ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_share_token UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS portal_settings JSONB DEFAULT '{"show_timeline": true, "show_board": false}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(public_share_token);

-- 2. RLS Policies for Anonymous/Public Read Access
-- Allow reading a project if you have the token (is_public must be true)
CREATE POLICY "Public can view shared projects" ON public.projects
    FOR SELECT 
    USING (is_public = true);

-- Allow reading tasks if the parent project is public
CREATE POLICY "Public can view tasks of shared projects" ON public.tasks
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.tasks.project_id 
            AND is_public = true
        )
    );

-- Allow reading project statuses if the parent project is public
CREATE POLICY "Public can view statuses of shared projects" ON public.project_statuses
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.project_statuses.project_id 
            AND is_public = true
        )
    );

-- Allow reading epics if the parent project is public
CREATE POLICY "Public can view epics of shared projects" ON public.epics
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.epics.project_id 
            AND is_public = true
        )
    );
-- supabase/migrations/049_project_management_sprint10.sql

-- ===========================================================================
-- Sprint 10 Architecture: Advanced Resource Planning & Capacity
-- ===========================================================================

-- 1. Add weekly_capacity to workspace_members to track available hours
ALTER TABLE public.workspace_members 
    ADD COLUMN IF NOT EXISTS weekly_capacity NUMERIC DEFAULT 40;
-- supabase/migrations/050_hr_policies_and_agreements.sql

-- ===========================================================================
-- HR Policies, Terms & Conditions, and Legal Compliance Engine Schema
-- ===========================================================================

-- 1. Core HR Policies Header
CREATE TABLE IF NOT EXISTS public.hr_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'CODE_OF_CONDUCT', 'LEAVE', 'REMOTE_WORK', 'CONFIDENTIALITY', 
        'IT_SECURITY', 'POSH', 'TRAVEL', 'ATTENDANCE', 'TERMS_AND_CONDITIONS', 'CUSTOM'
    )),
    
    owner_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    linked_module TEXT CHECK (linked_module IN ('ATTENDANCE', 'LEAVE', 'PAYROLL', 'EXPENSES', 'NONE')),
    linked_entity_id TEXT,
    
    review_frequency_months INTEGER DEFAULT 12,
    next_review_date DATE,
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_policies_workspace ON public.hr_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_policies_category ON public.hr_policies(category);

-- 2. Immutable Policy Versions
CREATE TABLE IF NOT EXISTS public.hr_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    change_summary TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    mandatory BOOLEAN DEFAULT false,
    language TEXT DEFAULT 'en',
    content_hash VARCHAR(64), -- SHA-256 Hash of exact content
    
    published_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approval_comments TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(policy_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_versions_policy ON public.hr_policy_versions(policy_id);

-- 3. Normalized Target Audience
CREATE TABLE IF NOT EXISTS public.hr_policy_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    
    target_type TEXT NOT NULL CHECK (target_type IN ('DEPARTMENT', 'DESIGNATION', 'EMPLOYMENT_TYPE', 'ROLE')),
    target_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_targets_lookup ON public.hr_policy_targets(policy_id, target_type, target_id);

-- 4. Employee Policy Acknowledgements (Legal Evidence)
CREATE TABLE IF NOT EXISTS public.hr_policy_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.hr_policy_versions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 Hash at time of signing
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'REVOKED')),
    revocation_reason TEXT,
    
    signature_type TEXT DEFAULT 'TYPED_NAME' CHECK (signature_type IN ('TYPED_NAME', 'DRAWN_SIGNATURE')),
    signature_value TEXT NOT NULL,
    read_time_seconds INTEGER DEFAULT 0,
    read_till_bottom BOOLEAN DEFAULT true,
    
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    
    UNIQUE(version_id, workspace_member_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_acknowledgements_member ON public.hr_policy_acknowledgements(workspace_member_id);
CREATE INDEX IF NOT EXISTS idx_hr_policy_acknowledgements_policy ON public.hr_policy_acknowledgements(policy_id);

-- 5. Audit Notification Log
CREATE TABLE IF NOT EXISTS public.hr_policy_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.hr_policy_versions(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'OPENED'))
);

-- RLS Policies
ALTER TABLE public.hr_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view hr_policies" ON public.hr_policies
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policies" ON public.hr_policies
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_versions" ON public.hr_policy_versions
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policy_versions" ON public.hr_policy_versions
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_targets" ON public.hr_policy_targets
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policy_targets" ON public.hr_policy_targets
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_acknowledgements" ON public.hr_policy_acknowledgements
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can insert own hr_policy_acknowledgements" ON public.hr_policy_acknowledgements
    FOR INSERT WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Active members can view hr_policy_notifications" ON public.hr_policy_notifications
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
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
-- supabase/migrations/052_enterprise_hrms_extensions.sql

-- ===========================================================================
-- 10/10 Master Enterprise HRMS Platform Architecture Schema
-- ===========================================================================

-- 1. HR Employee Master Table
CREATE TABLE IF NOT EXISTS public.hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    
    employee_code TEXT NOT NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    probation_end_date DATE,
    employment_status TEXT DEFAULT 'PROBATION' CHECK (employment_status IN ('PROBATION', 'CONFIRMED', 'NOTICE_PERIOD', 'TERMINATED')),
    
    reports_to_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    branch_id UUID,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    salary_structure_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_workspace ON public.hr_employees(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_member ON public.hr_employees(workspace_member_id);

-- 2. Employment Lifecycle History
CREATE TABLE IF NOT EXISTS public.hr_employee_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    
    change_type TEXT NOT NULL CHECK (change_type IN (
        'JOINED', 'PROMOTION', 'TRANSFER', 'SALARY_REVISION', 'DESIGNATION_CHANGE', 'DEPARTMENT_CHANGE', 'EXIT'
    )),
    old_value JSONB DEFAULT '{}'::jsonb,
    new_value JSONB DEFAULT '{}'::jsonb,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    changed_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    remarks TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Central Enterprise Security Audit Logs
CREATE TABLE IF NOT EXISTS public.hr_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    
    performed_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    ip_address TEXT,
    device_info TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Normalized Salary Components & Structures
CREATE TABLE IF NOT EXISTS public.hr_salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION')),
    calculation_type TEXT NOT NULL CHECK (calculation_type IN ('PERCENTAGE_OF_BASIC', 'FIXED_AMOUNT')),
    value_number NUMERIC NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_salary_structure_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_id UUID NOT NULL REFERENCES public.hr_salary_structures(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.hr_salary_components(id) ON DELETE CASCADE,
    UNIQUE(structure_id, component_id)
);

-- 5. Normalized Approval Workflow Engine with Conditional Rules
CREATE TABLE IF NOT EXISTS public.hr_approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    module TEXT NOT NULL CHECK (module IN ('LEAVE', 'EXPENSE', 'REQUEST', 'PROMOTION', 'RESIGNATION')),
    step_number INTEGER NOT NULL DEFAULT 1,
    approver_type TEXT NOT NULL CHECK (approver_type IN ('MANAGER', 'HR_ADMIN', 'SPECIFIC_EMPLOYEE', 'ROLE')),
    approver_id TEXT,
    
    condition_type TEXT DEFAULT 'ALWAYS' CHECK (condition_type IN ('ALWAYS', 'DAYS_GREATER_THAN', 'AMOUNT_GREATER_THAN')),
    condition_value NUMERIC DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, module, step_number)
);

CREATE TABLE IF NOT EXISTS public.hr_approval_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES public.hr_approval_instances(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    comments TEXT,
    acted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Dynamic Onboarding Checklist Tasks
CREATE TABLE IF NOT EXISTS public.hr_onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('DOCUMENT', 'ASSET', 'POLICY', 'ACCOUNT_CREATION')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_onboarding_employee_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.hr_onboarding_tasks(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    completed_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    UNIQUE(hr_employee_id, task_id)
);

-- 7. Shifts, Assignments & Holidays
CREATE TABLE IF NOT EXISTS public.hr_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INTEGER DEFAULT 15,
    half_day_threshold_hours NUMERIC DEFAULT 4.0,
    is_rotational BOOLEAN DEFAULT false,
    color TEXT DEFAULT '#10b981',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.hr_shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    assigned_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    holiday_type TEXT DEFAULT 'COMPANY' CHECK (holiday_type IN ('NATIONAL', 'COMPANY', 'OPTIONAL')),
    recurrence_type TEXT DEFAULT 'YEARLY' CHECK (recurrence_type IN ('YEARLY', 'MONTHLY', 'NONE')),
    branch_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Recruitment, Offer Letters & Applications
CREATE TABLE IF NOT EXISTS public.hr_recruitment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    location TEXT,
    employment_type TEXT DEFAULT 'FULL_TIME',
    experience_level TEXT,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
    job_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    resume_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS public.hr_job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.hr_recruitment_jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
    stage TEXT DEFAULT 'APPLIED' CHECK (stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED')),
    stage_changed_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.hr_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.hr_job_applications(id) ON DELETE CASCADE,
    interviewer_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    interview_type TEXT DEFAULT 'TECHNICAL',
    scheduled_at TIMESTAMPTZ NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_notes TEXT,
    decision TEXT DEFAULT 'PENDING' CHECK (decision IN ('PASSED', 'REJECTED', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_offer_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.hr_job_applications(id) ON DELETE CASCADE,
    offered_salary NUMERIC NOT NULL,
    joining_date DATE NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED')),
    offer_letter_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Performance Reviews, Goals & Promotions
CREATE TABLE IF NOT EXISTS public.hr_review_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('UPCOMING', 'OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_performance_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    progress_pct INTEGER DEFAULT 0,
    status TEXT DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'OVERDUE')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.hr_review_cycles(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    reviewer_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    self_rating INTEGER CHECK (self_rating >= 1 AND self_rating <= 5),
    manager_rating INTEGER CHECK (manager_rating >= 1 AND manager_rating <= 5),
    final_rating INTEGER CHECK (final_rating >= 1 AND final_rating <= 5),
    feedback_summary TEXT,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SELF_SUBMITTED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    old_designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    new_designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    old_salary NUMERIC DEFAULT 0,
    new_salary NUMERIC DEFAULT 0,
    promotion_reason TEXT DEFAULT 'ANNUAL_APPRAISAL' CHECK (promotion_reason IN ('ANNUAL_APPRAISAL', 'MERIT', 'INTERNAL_TRANSFER', 'EXCEPTIONAL')),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Employee Self-Service Requests
CREATE TABLE IF NOT EXISTS public.hr_employee_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN (
        'BANK_DETAILS_CHANGE', 'SALARY_CERTIFICATE', 'EXPERIENCE_LETTER', 'PF_DECLARATION', 'ADDRESS_CHANGE', 'RESIGNATION'
    )),
    details_json JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    assigned_to_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_onboarding_employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_recruitment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_offer_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_requests ENABLE ROW LEVEL SECURITY;

-- Standard Member Read / Admin All Policies
CREATE POLICY "Active members can view hr_employees" ON public.hr_employees FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage hr_employees" ON public.hr_employees FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()) AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text));

CREATE POLICY "Active members can view hr_shifts" ON public.hr_shifts FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage hr_shifts" ON public.hr_shifts FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()) AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text));

CREATE POLICY "Active members can view hr_holidays" ON public.hr_holidays FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage hr_holidays" ON public.hr_holidays FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()) AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text));

CREATE POLICY "Active members can view hr_recruitment_jobs" ON public.hr_recruitment_jobs FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage hr_recruitment_jobs" ON public.hr_recruitment_jobs FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()) AND public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text));

CREATE POLICY "Active members can view hr_employee_requests" ON public.hr_employee_requests FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members insert own hr_employee_requests" ON public.hr_employee_requests FOR INSERT WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));
