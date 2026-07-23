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
