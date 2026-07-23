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
