-- supabase/migrations/055_gst_tax_module.sql
-- ===========================================================================
-- GST (Goods & Services Tax) Engine & Tax Ledger Schema
-- ===========================================================================

-- 1. Master GST Ledger Table (Immutable Double-Entry Tax Audit Log)
CREATE TABLE IF NOT EXISTS public.commerce_gst_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    ledger_type TEXT NOT NULL CHECK (ledger_type IN ('OUTPUT', 'INPUT')), -- OUTPUT = Sales Liability, INPUT = Purchase ITC
    invoice_id UUID,
    invoice_number TEXT NOT NULL,
    invoice_date DATE DEFAULT CURRENT_DATE,
    party_name TEXT,
    gstin TEXT,
    source_state_code TEXT NOT NULL DEFAULT '27',
    destination_state_code TEXT NOT NULL DEFAULT '27',
    is_interstate BOOLEAN DEFAULT false,
    hsn_sac_code TEXT DEFAULT '7113',
    taxable_amount NUMERIC NOT NULL DEFAULT 0,
    cgst_rate NUMERIC DEFAULT 0,
    cgst_amount NUMERIC DEFAULT 0,
    sgst_rate NUMERIC DEFAULT 0,
    sgst_amount NUMERIC DEFAULT 0,
    igst_rate NUMERIC DEFAULT 0,
    igst_amount NUMERIC DEFAULT 0,
    total_gst NUMERIC NOT NULL DEFAULT 0,
    total_invoice_amount NUMERIC NOT NULL DEFAULT 0,
    is_b2b BOOLEAN DEFAULT false,
    irn_number TEXT, -- E-Invoice 64-char Hash
    ack_number TEXT,
    ack_date TIMESTAMPTZ,
    qr_code_payload TEXT, -- Base64 Signed QR Code
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast Compound Indexes for GSTR-1, GSTR-2B, and Monthly/Quarterly GST Filing
CREATE INDEX IF NOT EXISTS idx_gst_ledger_query 
ON public.commerce_gst_ledgers(workspace_id, invoice_date, ledger_type, status);

CREATE POLICY "Active members can manage commerce_gst_ledgers" 
ON public.commerce_gst_ledgers
FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

ALTER TABLE public.commerce_gst_ledgers ENABLE ROW LEVEL SECURITY;
