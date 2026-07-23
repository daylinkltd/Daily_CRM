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
