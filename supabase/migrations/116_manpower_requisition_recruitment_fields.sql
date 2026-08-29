-- supabase/migrations/116_manpower_requisition_recruitment_fields.sql
-- ===========================================================================
-- Manpower Requisition, Recruitment Budgeting & Employee Lifecycle Extensions
-- ===========================================================================

-- 1. Extend hr_recruitment_jobs table with Budgeting and Requisition fields
ALTER TABLE public.hr_recruitment_jobs
ADD COLUMN IF NOT EXISTS cost_center TEXT,
ADD COLUMN IF NOT EXISTS budget_type TEXT DEFAULT 'ANNUAL_BUDGET',
ADD COLUMN IF NOT EXISTS approved_budget_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_approval_status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS vacancies_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS hiring_manager TEXT,
ADD COLUMN IF NOT EXISTS expected_doj DATE,
ADD COLUMN IF NOT EXISTS hiring_reason TEXT,
ADD COLUMN IF NOT EXISTS designation_grade TEXT,
ADD COLUMN IF NOT EXISTS roles_responsibilities TEXT,
ADD COLUMN IF NOT EXISTS required_skills TEXT,
ADD COLUMN IF NOT EXISTS min_experience_years NUMERIC,
ADD COLUMN IF NOT EXISTS max_experience_years NUMERIC,
ADD COLUMN IF NOT EXISTS educational_criteria TEXT,
ADD COLUMN IF NOT EXISTS min_salary NUMERIC,
ADD COLUMN IF NOT EXISTS max_salary NUMERIC,
ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS job_description_url TEXT;

-- 2. Extend hr_job_applications with decision, BGV, and offer details
ALTER TABLE public.hr_job_applications
ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS bgv_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS offered_salary NUMERIC,
ADD COLUMN IF NOT EXISTS offered_doj DATE,
ADD COLUMN IF NOT EXISTS document_status TEXT DEFAULT 'PENDING';

-- 3. Ensure hr_employees has probation and decision columns
ALTER TABLE public.hr_employees
ADD COLUMN IF NOT EXISTS probation_decision TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS probation_notes TEXT;

-- 4. Enable RLS permissions on updated tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_recruitment_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_applications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employees TO authenticated, service_role;
