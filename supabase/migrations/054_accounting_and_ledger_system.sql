-- supabase/migrations/054_accounting_and_ledger_system.sql
-- ===========================================================================
-- Enterprise General Ledger & Automated Accounting Engine
-- ===========================================================================

-- 1. Chart of Accounts (GL Accounts)
CREATE TABLE IF NOT EXISTS public.commerce_chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    sub_category TEXT CHECK (sub_category IN ('CASH', 'BANK', 'CUSTOMER_KHATA', 'CHEQUE_IN_HAND', 'SALES_REVENUE', 'TAX_PAYABLE', 'PURCHASE_EXPENSE')),
    is_system BOOLEAN DEFAULT false,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, account_code)
);
CREATE POLICY "Active members can manage chart_of_accounts" ON public.commerce_chart_of_accounts
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- 2. Bank Accounts Directory
CREATE TABLE IF NOT EXISTS public.commerce_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL, -- e.g. 'SBI Current', 'HDFC Current', 'ICICI Current'
    account_number TEXT,
    ifsc_code TEXT,
    upi_id TEXT,
    ledger_id UUID REFERENCES public.commerce_chart_of_accounts(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage bank_accounts" ON public.commerce_bank_accounts
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_bank_accounts ENABLE ROW LEVEL SECURITY;

-- 3. Journal Vouchers & Daybook
CREATE TABLE IF NOT EXISTS public.commerce_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    voucher_number TEXT NOT NULL,
    voucher_date DATE DEFAULT CURRENT_DATE,
    reference_type TEXT CHECK (reference_type IN ('POS_SALE', 'KHATA_COLLECTION', 'CHEQUE_CLEARANCE', 'EXPENSE', 'MANUAL_JOURNAL')),
    reference_id TEXT,
    utr_number TEXT, -- Prevent duplicate UTR
    payment_app TEXT, -- 'PhonePe', 'Google Pay', 'Paytm', 'BHIM'
    card_last_digits TEXT,
    cheque_number TEXT,
    narration TEXT,
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_utr ON public.commerce_journal_entries(workspace_id, utr_number);
CREATE POLICY "Active members can manage journal_entries" ON public.commerce_journal_entries
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_journal_entries ENABLE ROW LEVEL SECURITY;

-- 4. Double-Entry Journal Lines (Debit & Credit Lines)
CREATE TABLE IF NOT EXISTS public.commerce_journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.commerce_journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.commerce_chart_of_accounts(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL, -- Customer Khata linkage
    debit_amount NUMERIC DEFAULT 0,
    credit_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage journal_lines" ON public.commerce_journal_lines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_journal_entries
            WHERE commerce_journal_entries.id = commerce_journal_lines.journal_entry_id
            AND public.is_active_workspace_member(commerce_journal_entries.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_journal_lines ENABLE ROW LEVEL SECURITY;

-- 5. Customer Khata Credit Balances Table
CREATE TABLE IF NOT EXISTS public.commerce_customer_khata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    credit_limit NUMERIC DEFAULT 50000,
    outstanding_balance NUMERIC DEFAULT 0,
    credit_days INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, contact_id)
);
CREATE POLICY "Active members can manage customer_khata" ON public.commerce_customer_khata
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_customer_khata ENABLE ROW LEVEL SECURITY;
