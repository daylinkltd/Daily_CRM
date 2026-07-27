-- supabase/migrations/061_enterprise_platform_engines.sql
-- ===========================================================================
-- Enterprise ERP Platform: Shared Infrastructure Engines (Event Bus, Policy Engine, DMS, Number Series, Audit Trail, Soft Delete)
-- ===========================================================================

-- 1. Universal Document Number Series Generator
CREATE TABLE IF NOT EXISTS public.platform_number_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'INVOICE', 'PURCHASE_ORDER', 'GRN', 'STOCK_TRANSFER', 'QUOTATION', 'CREDIT_NOTE', 'DEBIT_NOTE', 'JOURNAL'
    prefix TEXT DEFAULT 'INV/',
    suffix TEXT DEFAULT '/26-27',
    running_number INT DEFAULT 1,
    financial_year TEXT DEFAULT '2026-2027',
    branch_id UUID,
    reset_rule TEXT DEFAULT 'YEARLY' CHECK (reset_rule IN ('NEVER', 'YEARLY', 'MONTHLY', 'DAILY')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, document_type, prefix, financial_year)
);
CREATE POLICY "Active members can manage number_series" ON public.platform_number_series
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.platform_number_series ENABLE ROW LEVEL SECURITY;

-- RPC Function to generate next document number atomically
CREATE OR REPLACE FUNCTION public.generate_next_document_number(
    p_workspace_id UUID,
    p_document_type TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_series RECORD;
    v_doc_number TEXT;
BEGIN
    SELECT * INTO v_series 
    FROM public.platform_number_series
    WHERE workspace_id = p_workspace_id AND document_type = p_document_type
    FOR UPDATE;

    IF NOT FOUND THEN
        v_doc_number := p_document_type || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6));
        RETURN v_doc_number;
    END IF;

    v_doc_number := COALESCE(v_series.prefix, '') || LPAD(v_series.running_number::text, 6, '0') || COALESCE(v_series.suffix, '');

    UPDATE public.platform_number_series
    SET running_number = running_number + 1
    WHERE id = v_series.id;

    RETURN v_doc_number;
END;
$$;

-- 2. Document Management System (DMS) Platform Module
CREATE TABLE IF NOT EXISTS public.platform_dms_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    folder_path TEXT DEFAULT '/',
    tags JSONB DEFAULT '[]'::jsonb,
    ocr_extracted_text TEXT,
    version_number INT DEFAULT 1,
    uploaded_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage dms documents" ON public.platform_dms_documents
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.platform_dms_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_dms_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.platform_dms_documents(id) ON DELETE CASCADE,
    entity_name TEXT NOT NULL, -- e.g. 'commerce_purchase_orders', 'commerce_sales_orders', 'commerce_rma_tickets'
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage dms links" ON public.platform_dms_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.platform_dms_documents
            WHERE platform_dms_documents.id = platform_dms_links.document_id
            AND public.is_active_workspace_member(platform_dms_documents.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.platform_dms_links ENABLE ROW LEVEL SECURITY;

-- 3. Immutable Platform Audit Log Engine
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    performed_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'PRICE_OVERRIDE', 'STOCK_ADJUST'
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can view audit logs" ON public.platform_audit_logs
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Central Platform Policy Engine Rules
CREATE TABLE IF NOT EXISTS public.platform_policy_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    policy_domain TEXT NOT NULL CHECK (policy_domain IN (
        'PRICING', 'APPROVAL', 'SECURITY_ABAC', 'INVENTORY', 
        'NOTIFICATION', 'VALIDATION', 'NUMBER_SERIES', 'AUTOMATION'
    )),
    conditions_ast JSONB NOT NULL DEFAULT '{}'::jsonb, -- AST Condition Tree
    actions_ast JSONB NOT NULL DEFAULT '{}'::jsonb,    -- Action Execution Rules
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage policy rules" ON public.platform_policy_rules
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.platform_policy_rules ENABLE ROW LEVEL SECURITY;

-- 5. Soft Delete Audit Protocol Columns Helper
-- Adds deleted_at and deleted_by to key sales and ledger tables for financial audit compliance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commerce_sales_orders' AND column_name='deleted_at') THEN
        ALTER TABLE public.commerce_sales_orders ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE public.commerce_sales_orders ADD COLUMN deleted_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commerce_journal_entries' AND column_name='deleted_at') THEN
        ALTER TABLE public.commerce_journal_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE public.commerce_journal_entries ADD COLUMN deleted_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
    END IF;
END $$;
