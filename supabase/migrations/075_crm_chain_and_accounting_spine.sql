-- ============================================================
-- 075 — CRM chain (commercials → quotations → invoices) and
--        accounting spine hardening.
--
-- What this does, in order:
--   1. Widens the journal reference_type CHECK so every module can
--      post (invoices, purchases, returns, payroll, credit notes).
--   2. Widens chart-of-accounts sub_category CHECK with the account
--      roles those postings need (AP, GST in/out, salaries, …).
--   3. Deletes provably-corrupt vouchers (KHATA_COLLECTION headers
--      with zero lines — written by a bug in /api/commerce/ledger).
--   4. Enforces double-entry at the DB: a deferred constraint
--      trigger rejects any transaction that leaves a journal entry
--      unbalanced, and a partial unique index prevents posting the
--      same source document twice.
--   5. Creates `commercials` + `commercial_line_items` — the
--      internal costing/margin stage between a deal and a quotation.
--   6. Creates unified `invoices` + `invoice_items` +
--      `invoice_payments` (CRM, project and retail invoices in one
--      table, discriminated by `source`). Replaces project_invoices,
--      which is empty in production and whose creation UI is dead
--      code. amount_paid is trigger-maintained from payment rows —
--      never client-written.
--   7. Seeds per-workspace number series (INV- / COM-) for the
--      atomic generate_next_document_number() RPC from 061.
--   8. Seeds module_accounting=true on every existing role
--      (non-disruptive, same pattern as 073).
--
-- Idempotent: safe to run twice. Validated against a
-- production-shaped Postgres in Docker before shipping.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Journal entries: let every module post.
--    The CHECK from 054 is unnamed, so find-and-drop it by
--    definition rather than guessing the auto-generated name.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.commerce_journal_entries'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%reference_type%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.commerce_journal_entries DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.commerce_journal_entries
  ADD CONSTRAINT commerce_journal_entries_reference_type_chk
  CHECK (reference_type IN (
    -- original five (054)
    'POS_SALE', 'KHATA_COLLECTION', 'CHEQUE_CLEARANCE', 'EXPENSE', 'MANUAL_JOURNAL',
    -- CRM / sales documents
    'INVOICE', 'INVOICE_PAYMENT', 'CREDIT_NOTE',
    -- supply side
    'PURCHASE', 'PURCHASE_PAYMENT', 'SALES_RETURN',
    -- HR
    'PAYROLL'
  ));

-- ------------------------------------------------------------
-- 2. Chart of accounts: sub_category roles for the new postings.
--    (sub_category is how the posting engine finds accounts, so
--    every rule in the posting matrix needs a role here.)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.commerce_chart_of_accounts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%sub_category%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.commerce_chart_of_accounts DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.commerce_chart_of_accounts
  ADD CONSTRAINT commerce_chart_of_accounts_sub_category_chk
  CHECK (sub_category IN (
    -- original seven (054)
    'CASH', 'BANK', 'CUSTOMER_KHATA', 'CHEQUE_IN_HAND', 'SALES_REVENUE',
    'TAX_PAYABLE', 'PURCHASE_EXPENSE',
    -- new roles
    'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE',
    'GST_OUTPUT', 'GST_INPUT',
    'SALARY_EXPENSE', 'SALARIES_PAYABLE',
    'SALES_RETURNS', 'GENERAL_EXPENSE', 'INVENTORY', 'OWNERS_EQUITY'
  ));

-- ------------------------------------------------------------
-- 3. Data repair: corrupt khata-collection vouchers.
--    /api/commerce/ledger inserted journal headers with no lines —
--    no amount, no debit, no credit. They carry no financial
--    meaning and would trip nothing (the balance trigger only sees
--    line writes), but they pollute the daybook. Scope is
--    deliberately narrow: only zero-line KHATA_COLLECTION headers.
-- ------------------------------------------------------------
DELETE FROM public.commerce_journal_entries e
WHERE e.reference_type = 'KHATA_COLLECTION'
  AND NOT EXISTS (
    SELECT 1 FROM public.commerce_journal_lines l
    WHERE l.journal_entry_id = e.id
  );

-- ------------------------------------------------------------
-- 4a. Double-entry enforcement.
--     Deferred constraint trigger: at COMMIT, every journal entry
--     whose lines were touched in the transaction must balance.
--     Writers must therefore insert all legs of an entry in one
--     transaction — which is exactly the discipline we want.
--     A 0.005 tolerance absorbs numeric rounding on split lines.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_journal_entry_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_debit NUMERIC;
  v_credit NUMERIC;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO v_debit, v_credit
  FROM public.commerce_journal_lines
  WHERE journal_entry_id = v_entry_id;

  IF ABS(v_debit - v_credit) > 0.005 THEN
    RAISE EXCEPTION
      'Journal entry % is unbalanced: debits % != credits %. All legs of an entry must be written in one transaction and must balance.',
      v_entry_id, v_debit, v_credit
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_balanced ON public.commerce_journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.commerce_journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_journal_entry_balanced();

-- ------------------------------------------------------------
-- 4b. One posting per source document.
--     Partial: only one-shot document types. Repeatable events
--     (khata collections, manual journals, cheque clearances) are
--     excluded; INVOICE_PAYMENT and PURCHASE_PAYMENT reference the
--     payment row (unique per payment), not the invoice.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_journal_source_posting
  ON public.commerce_journal_entries (workspace_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL
    AND deleted_at IS NULL
    AND reference_type IN (
      'POS_SALE', 'INVOICE', 'INVOICE_PAYMENT', 'CREDIT_NOTE',
      'PURCHASE', 'PURCHASE_PAYMENT', 'SALES_RETURN', 'PAYROLL'
    );

-- ------------------------------------------------------------
-- 5. Commercials — internal costing between deal and quotation.
--    Cost and margin are INTERNAL: conversion to a quotation maps
--    unit_price only, never unit_cost.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reference               TEXT NOT NULL,
  title                   TEXT,
  deal_id                 UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id              UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'converted')),
  currency                TEXT NOT NULL DEFAULT 'USD',
  payment_terms           TEXT,
  valid_until             DATE,
  notes                   TEXT,
  discount_percent        NUMERIC(5,2) NOT NULL DEFAULT 0
                          CHECK (discount_percent >= 0 AND discount_percent <= 100),
  total_cost              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_value             NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_percent          NUMERIC(7,2) GENERATED ALWAYS AS (
                            CASE WHEN total_value = 0 THEN 0
                                 ELSE ROUND(((total_value - total_cost) / total_value) * 100, 2)
                            END
                          ) STORED,
  approved_by             UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  converted_quotation_id  UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  created_by              UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_commercials_workspace ON public.commercials (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercials_deal ON public.commercials (deal_id);
CREATE INDEX IF NOT EXISTS idx_commercials_contact ON public.commercials (contact_id);

CREATE TABLE IF NOT EXISTS public.commercial_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_id     UUID NOT NULL REFERENCES public.commercials(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  quantity          NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_cost         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent  NUMERIC(5,2) NOT NULL DEFAULT 0
                    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  line_total        NUMERIC(14,2) GENERATED ALWAYS AS (
                      ROUND(quantity * unit_price * (1 - discount_percent / 100), 2)
                    ) STORED,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_items_commercial ON public.commercial_line_items (commercial_id);

ALTER TABLE public.commercials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercials_members ON public.commercials;
CREATE POLICY commercials_members ON public.commercials
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS commercial_line_items_members ON public.commercial_line_items;
CREATE POLICY commercial_line_items_members ON public.commercial_line_items
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at ON public.commercials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.commercials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at ON public.commercial_line_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.commercial_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 6. Unified invoices.
--    source discriminates who created it (crm | project | retail).
--    project_invoices (empty in prod, dead creation UI) is
--    superseded — left in place untouched for now, dropped in a
--    later cleanup migration once the UI cutover has shipped.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'crm' CHECK (source IN ('crm', 'project', 'retail')),
  contact_id       UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id          UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  quotation_id     UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  project_id       UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  -- Maintained exclusively by the invoice_payments trigger below.
  amount_paid      NUMERIC(14,2) NOT NULL DEFAULT 0
                   CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  notes            TEXT,
  terms            TEXT,
  sent_at          TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON public.invoices (contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices (project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price    NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total    NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  mode              TEXT NOT NULL DEFAULT 'bank_transfer'
                    CHECK (mode IN ('cash', 'upi', 'card', 'bank_transfer', 'cheque')),
  bank_account_id   UUID REFERENCES public.commerce_bank_accounts(id) ON DELETE SET NULL,
  reference_number  TEXT,
  -- Set by the posting engine after the journal entry is written.
  journal_entry_id  UUID REFERENCES public.commerce_journal_entries(id) ON DELETE SET NULL,
  notes             TEXT,
  created_by        UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_workspace ON public.invoice_payments (workspace_id, payment_date DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_members ON public.invoices;
CREATE POLICY invoices_members ON public.invoices
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS invoice_items_members ON public.invoice_items;
CREATE POLICY invoice_items_members ON public.invoice_items
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS invoice_payments_members ON public.invoice_payments;
CREATE POLICY invoice_payments_members ON public.invoice_payments
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at ON public.invoices;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 6b. Payment integrity.
--     BEFORE trigger on payments: lock the invoice row, reject
--     payments on draft/void invoices, reject overpayment.
--     AFTER trigger: recompute amount_paid from the payment rows
--     and derive status. The client never writes amount_paid.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_payment_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_already NUMERIC;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;  -- serializes concurrent payments on one invoice

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', NEW.invoice_id;
  END IF;

  IF v_invoice.status IN ('draft', 'void') THEN
    RAISE EXCEPTION 'Cannot record a payment on a % invoice', v_invoice.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM v_invoice.workspace_id THEN
    RAISE EXCEPTION 'Payment workspace does not match invoice workspace'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_already
  FROM public.invoice_payments
  WHERE invoice_id = NEW.invoice_id
    AND id IS DISTINCT FROM NEW.id;

  IF v_already + NEW.amount > v_invoice.total_amount + 0.005 THEN
    RAISE EXCEPTION
      'Payment of % would exceed invoice total % (already paid %)',
      NEW.amount, v_invoice.total_amount, v_already
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_payment_guard ON public.invoice_payments;
CREATE TRIGGER trg_invoice_payment_guard
  BEFORE INSERT OR UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_payment_guard();

CREATE OR REPLACE FUNCTION public.invoice_recompute_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
  v_paid NUMERIC;
  v_total NUMERIC;
  v_status TEXT;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.invoice_payments
  WHERE invoice_id = v_invoice_id;

  SELECT total_amount, status INTO v_total, v_status
  FROM public.invoices
  WHERE id = v_invoice_id
  FOR UPDATE;

  UPDATE public.invoices
  SET amount_paid = v_paid,
      status = CASE
        WHEN v_status IN ('draft', 'void') THEN v_status  -- guard trigger prevents this; belt and braces
        WHEN v_paid >= v_total - 0.005 AND v_total > 0 THEN 'paid'
        WHEN v_paid > 0 THEN 'partially_paid'
        WHEN v_status = 'partially_paid' OR v_status = 'paid' THEN 'sent'  -- payment deleted
        ELSE v_status
      END,
      paid_at = CASE
        WHEN v_paid >= v_total - 0.005 AND v_total > 0 THEN COALESCE(paid_at, NOW())
        ELSE NULL
      END
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_recompute_paid ON public.invoice_payments;
CREATE TRIGGER trg_invoice_recompute_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_recompute_paid();

-- ------------------------------------------------------------
-- 7. Number series for the documents this migration introduces.
--    generate_next_document_number() falls back to a random suffix
--    when no series row exists; seeding one per workspace gives
--    proper INV-000001 style sequences. financial_year is pinned
--    to 'ALL' (reset_rule NEVER) — yearly reset can be opted into
--    later per workspace.
-- ------------------------------------------------------------
INSERT INTO public.platform_number_series
  (workspace_id, document_type, prefix, suffix, running_number, financial_year, reset_rule)
SELECT w.id, s.document_type, s.prefix, '', 1, 'ALL', 'NEVER'
FROM public.workspaces w
CROSS JOIN (VALUES
  ('INVOICE', 'INV-'),
  ('COMMERCIAL', 'COM-')
) AS s(document_type, prefix)
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_number_series ns
  WHERE ns.workspace_id = w.id AND ns.document_type = s.document_type
);

-- ------------------------------------------------------------
-- 8. Accounting module key — non-disruptive seed (073 pattern).
--    Every existing role keeps working; the key defaults to TRUE
--    so promoting Accounting out of Retail removes nobody's access.
--    The full CRUD RLS for the new tables lands with the catalog
--    regeneration in a follow-up migration.
-- ------------------------------------------------------------
UPDATE public.workspace_roles
SET permissions = permissions || '{"module_accounting": true}'::jsonb
WHERE NOT (permissions ? 'module_accounting');
