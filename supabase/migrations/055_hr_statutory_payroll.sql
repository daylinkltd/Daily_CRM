-- Migration 055: Configurable Effective-Dated Statutory Payroll Rules

CREATE TABLE IF NOT EXISTS public.hr_statutory_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    rule_type TEXT NOT NULL CHECK (rule_type IN ('PF', 'ESI', 'PT', 'TDS')),
    rule_name TEXT NOT NULL,
    
    employee_rate NUMERIC DEFAULT 0,
    employer_rate NUMERIC DEFAULT 0,
    wage_ceiling NUMERIC DEFAULT 0,
    min_threshold NUMERIC DEFAULT 0,
    
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
