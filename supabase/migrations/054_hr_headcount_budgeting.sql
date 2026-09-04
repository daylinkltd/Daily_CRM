-- Migration 054: Enterprise HRMS Headcount Budgeting & Manpower Requisitions

-- 1. Headcount & Salary Budget Allocation
CREATE TABLE IF NOT EXISTS public.hr_headcount_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL DEFAULT '2026-2027',
    
    budgeted_headcount INTEGER NOT NULL DEFAULT 5,
    approved_salary_budget NUMERIC DEFAULT 500000,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, department_id, financial_year)
);

-- 2. Manpower Requisitions
CREATE TABLE IF NOT EXISTS public.hr_manpower_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    
    position_title TEXT NOT NULL,
    requested_vacancies INTEGER NOT NULL DEFAULT 1,
    target_hiring_date DATE NOT NULL,
    justification TEXT NOT NULL,
    estimated_salary NUMERIC DEFAULT 0,
    
    status TEXT DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    requested_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
