-- Migration 053: Enterprise HRMS Exit Management, Clearance Matrix & Full & Final (F&F) Settlement

-- 1. Resignation & Exit Requests
CREATE TABLE IF NOT EXISTS public.hr_exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    
    resignation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    requested_lwd DATE NOT NULL,
    approved_lwd DATE,
    actual_lwd DATE,
    
    notice_days INTEGER DEFAULT 30,
    served_days INTEGER DEFAULT 0,
    waived_days INTEGER DEFAULT 0,
    shortfall_days INTEGER DEFAULT 0,
    shortfall_recovery_amount NUMERIC DEFAULT 0,
    
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'CLEARANCE_IN_PROGRESS', 'FNF_IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, hr_employee_id)
);

-- 2. Configurable 5-Stage Exit Clearance Matrix
CREATE TABLE IF NOT EXISTS public.hr_exit_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    exit_id UUID NOT NULL REFERENCES public.hr_exits(id) ON DELETE CASCADE,
    
    clearance_type TEXT NOT NULL CHECK (clearance_type IN ('MANAGER', 'HR', 'IT', 'ASSET', 'FINANCE')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    comments TEXT,
    asset_recovery_amount NUMERIC DEFAULT 0,
    
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exit_id, clearance_type)
);

-- 3. Full & Final (F&F) Settlement Calculations
CREATE TABLE IF NOT EXISTS public.hr_fnf_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    exit_id UUID NOT NULL REFERENCES public.hr_exits(id) ON DELETE CASCADE,
    hr_employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
    
    -- Applicable Earnings
    prorated_salary NUMERIC DEFAULT 0,
    leave_encashment_amount NUMERIC DEFAULT 0,
    reimbursements_amount NUMERIC DEFAULT 0,
    bonus_incentives_amount NUMERIC DEFAULT 0,
    total_earnings NUMERIC DEFAULT 0,
    
    -- Applicable Deductions
    notice_shortfall_recovery NUMERIC DEFAULT 0,
    approved_asset_recovery NUMERIC DEFAULT 0,
    salary_advance_recovery NUMERIC DEFAULT 0,
    statutory_deductions NUMERIC DEFAULT 0,
    other_deductions NUMERIC DEFAULT 0,
    total_deductions NUMERIC DEFAULT 0,
    
    -- Settlement Payout vs Receivable
    net_settlement_amount NUMERIC DEFAULT 0,
    is_receivable BOOLEAN DEFAULT FALSE,
    receivable_amount NUMERIC DEFAULT 0,
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'APPROVED', 'PAID')),
    retryable_document_state TEXT DEFAULT 'PENDING' CHECK (retryable_document_state IN ('PENDING', 'GENERATED', 'FAILED')),
    relieving_letter_url TEXT,
    experience_letter_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, exit_id)
);
