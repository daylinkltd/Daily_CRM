-- ==================== BEGIN 075_crm_chain_and_accounting_spine ====================

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

-- ==================== END 075_crm_chain_and_accounting_spine ====================

-- ==================== BEGIN 076_crud_rbac_accounting_module ====================

-- ============================================================
-- 074_crud_rbac.sql   *** GENERATED — DO NOT EDIT BY HAND ***
--
-- Source: src/lib/auth/resources.ts
-- Regenerate: node --experimental-strip-types scripts/generate-crud-rls.mjs \
--               > supabase/migrations/074_crud_rbac.sql
--
-- Per-resource, per-operation CRUD permissions enforced in the
-- database. Every permission is '<resource>:<action>' (e.g.
-- 'payroll:read', 'contacts:delete') stored in
-- workspace_roles.permissions, and each table gets four RESTRICTIVE
-- policies — one per SQL operation — so "read but never delete" is a
-- real boundary even against direct API calls.
--
-- RESTRICTIVE policies only narrow: existing permissive policies keep
-- their per-row logic and now additionally require the matching CRUD
-- permission. Owners/admins short-circuit inside the helper.
-- service_role bypasses RLS entirely, so webhooks and system jobs are
-- unaffected.
--
-- Rollout is non-disruptive — see the seeding section: existing roles
-- are granted every action they could already perform, and the three
-- built-in roles (Owner / Admin / Viewer) are created per workspace.
-- Nobody loses access on deploy; admins then untick what they want to
-- restrict.
--
-- Idempotent.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Permission helper: '<resource>:<action>' lookup.
--
-- Mirrors has_workspace_permission (migration 049) but is written for
-- the CRUD keys, and ALSO requires the row's module to be granted, so
-- a role can be shut out of a whole module without unticking 4x32
-- boxes. STABLE + SECURITY DEFINER so RLS can call it cheaply.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_resource_permission(
  p_workspace_id UUID,
  p_user_id      UUID,
  p_resource     TEXT,
  p_action       TEXT,
  p_module       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_perms JSONB;
BEGIN
  IF p_user_id IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owners and admins bypass the matrix entirely.
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT wr.permissions INTO v_perms
  FROM public.workspace_members wm
  JOIN public.workspace_roles wr ON wr.id = wm.role_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = p_user_id;

  -- No role assigned → no access to gated resources.
  IF v_perms IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Module gate. Absent key = allowed, so roles created before the
  -- module keys existed keep working (073 seeds them anyway).
  IF p_module IS NOT NULL
     AND v_perms ? ('module_' || p_module)
     AND COALESCE((v_perms->>('module_' || p_module))::boolean, false) IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN COALESCE((v_perms->>(p_resource || ':' || p_action))::boolean, false);
END
$fn$;

REVOKE ALL ON FUNCTION public.has_resource_permission(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_resource_permission(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 2. Built-in roles: Owner / Admin / Viewer, per workspace.
--    Owner+Admin get the full matrix (their bypass makes it
--    informational); Viewer is read-everything, no writes, and stays
--    editable so an admin can narrow which modules a viewer sees.
-- ---------------------------------------------------------------
INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Owner', 'Full access including billing and deleting the workspace.', '{"inbox:create":true,"inbox:read":true,"inbox:update":true,"inbox:delete":true,"contacts:create":true,"contacts:read":true,"contacts:update":true,"contacts:delete":true,"pipelines:create":true,"pipelines:read":true,"pipelines:update":true,"pipelines:delete":true,"deals:create":true,"deals:read":true,"deals:update":true,"deals:delete":true,"broadcasts:create":true,"broadcasts:read":true,"broadcasts:update":true,"broadcasts:delete":true,"automations:create":true,"automations:read":true,"automations:update":true,"automations:delete":true,"forms:create":true,"forms:read":true,"forms:update":true,"forms:delete":true,"quotations:create":true,"quotations:read":true,"quotations:update":true,"quotations:delete":true,"commercials:create":true,"commercials:read":true,"commercials:update":true,"commercials:delete":true,"invoices:create":true,"invoices:read":true,"invoices:update":true,"invoices:delete":true,"templates:create":true,"templates:read":true,"templates:update":true,"templates:delete":true,"tags:create":true,"tags:read":true,"tags:update":true,"tags:delete":true,"media:create":true,"media:read":true,"media:update":true,"media:delete":true,"chatbot:create":true,"chatbot:read":true,"chatbot:update":true,"chatbot:delete":true,"api_keys:create":true,"api_keys:read":true,"api_keys:update":true,"api_keys:delete":true,"employees:create":true,"employees:read":true,"employees:update":true,"employees:delete":true,"attendance:create":true,"attendance:read":true,"attendance:update":true,"attendance:delete":true,"leave:create":true,"leave:read":true,"leave:update":true,"leave:delete":true,"payroll:create":true,"payroll:read":true,"payroll:update":true,"payroll:delete":true,"hr_policies:create":true,"hr_policies:read":true,"hr_policies:update":true,"hr_policies:delete":true,"recruitment:create":true,"recruitment:read":true,"recruitment:update":true,"recruitment:delete":true,"performance:create":true,"performance:read":true,"performance:update":true,"performance:delete":true,"hr_approvals:create":true,"hr_approvals:read":true,"hr_approvals:update":true,"hr_approvals:delete":true,"products:create":true,"products:read":true,"products:update":true,"products:delete":true,"inventory:create":true,"inventory:read":true,"inventory:update":true,"inventory:delete":true,"sales:create":true,"sales:read":true,"sales:update":true,"sales:delete":true,"purchases:create":true,"purchases:read":true,"purchases:update":true,"purchases:delete":true,"pos:create":true,"pos:read":true,"pos:update":true,"pos:delete":true,"accounting:create":true,"accounting:read":true,"accounting:update":true,"accounting:delete":true,"pricing:create":true,"pricing:read":true,"pricing:update":true,"pricing:delete":true,"projects:create":true,"projects:read":true,"projects:update":true,"projects:delete":true,"tasks:create":true,"tasks:read":true,"tasks:update":true,"tasks:delete":true,"sprints:create":true,"sprints:read":true,"sprints:update":true,"sprints:delete":true,"project_invoices:create":true,"project_invoices:read":true,"project_invoices:update":true,"project_invoices:delete":true,"module_crm":true,"module_accounting":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Owner'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Admin', 'Manage the team, settings and every module.', '{"inbox:create":true,"inbox:read":true,"inbox:update":true,"inbox:delete":true,"contacts:create":true,"contacts:read":true,"contacts:update":true,"contacts:delete":true,"pipelines:create":true,"pipelines:read":true,"pipelines:update":true,"pipelines:delete":true,"deals:create":true,"deals:read":true,"deals:update":true,"deals:delete":true,"broadcasts:create":true,"broadcasts:read":true,"broadcasts:update":true,"broadcasts:delete":true,"automations:create":true,"automations:read":true,"automations:update":true,"automations:delete":true,"forms:create":true,"forms:read":true,"forms:update":true,"forms:delete":true,"quotations:create":true,"quotations:read":true,"quotations:update":true,"quotations:delete":true,"commercials:create":true,"commercials:read":true,"commercials:update":true,"commercials:delete":true,"invoices:create":true,"invoices:read":true,"invoices:update":true,"invoices:delete":true,"templates:create":true,"templates:read":true,"templates:update":true,"templates:delete":true,"tags:create":true,"tags:read":true,"tags:update":true,"tags:delete":true,"media:create":true,"media:read":true,"media:update":true,"media:delete":true,"chatbot:create":true,"chatbot:read":true,"chatbot:update":true,"chatbot:delete":true,"api_keys:create":true,"api_keys:read":true,"api_keys:update":true,"api_keys:delete":true,"employees:create":true,"employees:read":true,"employees:update":true,"employees:delete":true,"attendance:create":true,"attendance:read":true,"attendance:update":true,"attendance:delete":true,"leave:create":true,"leave:read":true,"leave:update":true,"leave:delete":true,"payroll:create":true,"payroll:read":true,"payroll:update":true,"payroll:delete":true,"hr_policies:create":true,"hr_policies:read":true,"hr_policies:update":true,"hr_policies:delete":true,"recruitment:create":true,"recruitment:read":true,"recruitment:update":true,"recruitment:delete":true,"performance:create":true,"performance:read":true,"performance:update":true,"performance:delete":true,"hr_approvals:create":true,"hr_approvals:read":true,"hr_approvals:update":true,"hr_approvals:delete":true,"products:create":true,"products:read":true,"products:update":true,"products:delete":true,"inventory:create":true,"inventory:read":true,"inventory:update":true,"inventory:delete":true,"sales:create":true,"sales:read":true,"sales:update":true,"sales:delete":true,"purchases:create":true,"purchases:read":true,"purchases:update":true,"purchases:delete":true,"pos:create":true,"pos:read":true,"pos:update":true,"pos:delete":true,"accounting:create":true,"accounting:read":true,"accounting:update":true,"accounting:delete":true,"pricing:create":true,"pricing:read":true,"pricing:update":true,"pricing:delete":true,"projects:create":true,"projects:read":true,"projects:update":true,"projects:delete":true,"tasks:create":true,"tasks:read":true,"tasks:update":true,"tasks:delete":true,"sprints:create":true,"sprints:read":true,"sprints:update":true,"sprints:delete":true,"project_invoices:create":true,"project_invoices:read":true,"project_invoices:update":true,"project_invoices:delete":true,"module_crm":true,"module_accounting":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Admin'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Viewer', 'Read-only across every module. Cannot create, edit or delete.', '{"inbox:create":false,"inbox:read":true,"inbox:update":false,"inbox:delete":false,"contacts:create":false,"contacts:read":true,"contacts:update":false,"contacts:delete":false,"pipelines:create":false,"pipelines:read":true,"pipelines:update":false,"pipelines:delete":false,"deals:create":false,"deals:read":true,"deals:update":false,"deals:delete":false,"broadcasts:create":false,"broadcasts:read":true,"broadcasts:update":false,"broadcasts:delete":false,"automations:create":false,"automations:read":true,"automations:update":false,"automations:delete":false,"forms:create":false,"forms:read":true,"forms:update":false,"forms:delete":false,"quotations:create":false,"quotations:read":true,"quotations:update":false,"quotations:delete":false,"commercials:create":false,"commercials:read":true,"commercials:update":false,"commercials:delete":false,"invoices:create":false,"invoices:read":true,"invoices:update":false,"invoices:delete":false,"templates:create":false,"templates:read":true,"templates:update":false,"templates:delete":false,"tags:create":false,"tags:read":true,"tags:update":false,"tags:delete":false,"media:create":false,"media:read":true,"media:update":false,"media:delete":false,"chatbot:create":false,"chatbot:read":true,"chatbot:update":false,"chatbot:delete":false,"api_keys:create":false,"api_keys:read":true,"api_keys:update":false,"api_keys:delete":false,"employees:create":false,"employees:read":true,"employees:update":false,"employees:delete":false,"attendance:create":false,"attendance:read":true,"attendance:update":false,"attendance:delete":false,"leave:create":false,"leave:read":true,"leave:update":false,"leave:delete":false,"payroll:create":false,"payroll:read":true,"payroll:update":false,"payroll:delete":false,"hr_policies:create":false,"hr_policies:read":true,"hr_policies:update":false,"hr_policies:delete":false,"recruitment:create":false,"recruitment:read":true,"recruitment:update":false,"recruitment:delete":false,"performance:create":false,"performance:read":true,"performance:update":false,"performance:delete":false,"hr_approvals:create":false,"hr_approvals:read":true,"hr_approvals:update":false,"hr_approvals:delete":false,"products:create":false,"products:read":true,"products:update":false,"products:delete":false,"inventory:create":false,"inventory:read":true,"inventory:update":false,"inventory:delete":false,"sales:create":false,"sales:read":true,"sales:update":false,"sales:delete":false,"purchases:create":false,"purchases:read":true,"purchases:update":false,"purchases:delete":false,"pos:create":false,"pos:read":true,"pos:update":false,"pos:delete":false,"accounting:create":false,"accounting:read":true,"accounting:update":false,"accounting:delete":false,"pricing:create":false,"pricing:read":true,"pricing:update":false,"pricing:delete":false,"projects:create":false,"projects:read":true,"projects:update":false,"projects:delete":false,"tasks:create":false,"tasks:read":true,"tasks:update":false,"tasks:delete":false,"sprints:create":false,"sprints:read":true,"sprints:update":false,"sprints:delete":false,"project_invoices:create":false,"project_invoices:read":true,"project_invoices:update":false,"project_invoices:delete":false,"module_crm":true,"module_accounting":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Viewer'
);

-- ---------------------------------------------------------------
-- 3. Non-disruptive seeding of EXISTING roles.
--
--    Any role missing CRUD keys is granted every action for the
--    modules it already had — i.e. exactly what its holders could do
--    before this migration. Existing keys are never overwritten, so a
--    re-run can't undo an admin's later choices.
-- ---------------------------------------------------------------
UPDATE public.workspace_roles wr
SET permissions = seed.perms || wr.permissions
FROM (
  SELECT r.id,
         jsonb_object_agg(k.key, true) AS perms
  FROM public.workspace_roles r
  CROSS JOIN (VALUES
    ('inbox:create', 'crm'),
    ('inbox:read', 'crm'),
    ('inbox:update', 'crm'),
    ('inbox:delete', 'crm'),
    ('contacts:create', 'crm'),
    ('contacts:read', 'crm'),
    ('contacts:update', 'crm'),
    ('contacts:delete', 'crm'),
    ('pipelines:create', 'crm'),
    ('pipelines:read', 'crm'),
    ('pipelines:update', 'crm'),
    ('pipelines:delete', 'crm'),
    ('deals:create', 'crm'),
    ('deals:read', 'crm'),
    ('deals:update', 'crm'),
    ('deals:delete', 'crm'),
    ('broadcasts:create', 'crm'),
    ('broadcasts:read', 'crm'),
    ('broadcasts:update', 'crm'),
    ('broadcasts:delete', 'crm'),
    ('automations:create', 'crm'),
    ('automations:read', 'crm'),
    ('automations:update', 'crm'),
    ('automations:delete', 'crm'),
    ('forms:create', 'crm'),
    ('forms:read', 'crm'),
    ('forms:update', 'crm'),
    ('forms:delete', 'crm'),
    ('quotations:create', 'crm'),
    ('quotations:read', 'crm'),
    ('quotations:update', 'crm'),
    ('quotations:delete', 'crm'),
    ('commercials:create', 'crm'),
    ('commercials:read', 'crm'),
    ('commercials:update', 'crm'),
    ('commercials:delete', 'crm'),
    ('invoices:create', 'crm'),
    ('invoices:read', 'crm'),
    ('invoices:update', 'crm'),
    ('invoices:delete', 'crm'),
    ('templates:create', 'crm'),
    ('templates:read', 'crm'),
    ('templates:update', 'crm'),
    ('templates:delete', 'crm'),
    ('tags:create', 'crm'),
    ('tags:read', 'crm'),
    ('tags:update', 'crm'),
    ('tags:delete', 'crm'),
    ('media:create', 'crm'),
    ('media:read', 'crm'),
    ('media:update', 'crm'),
    ('media:delete', 'crm'),
    ('chatbot:create', 'crm'),
    ('chatbot:read', 'crm'),
    ('chatbot:update', 'crm'),
    ('chatbot:delete', 'crm'),
    ('api_keys:create', 'crm'),
    ('api_keys:read', 'crm'),
    ('api_keys:update', 'crm'),
    ('api_keys:delete', 'crm'),
    ('employees:create', 'hr'),
    ('employees:read', 'hr'),
    ('employees:update', 'hr'),
    ('employees:delete', 'hr'),
    ('attendance:create', 'hr'),
    ('attendance:read', 'hr'),
    ('attendance:update', 'hr'),
    ('attendance:delete', 'hr'),
    ('leave:create', 'hr'),
    ('leave:read', 'hr'),
    ('leave:update', 'hr'),
    ('leave:delete', 'hr'),
    ('payroll:create', 'hr'),
    ('payroll:read', 'hr'),
    ('payroll:update', 'hr'),
    ('payroll:delete', 'hr'),
    ('hr_policies:create', 'hr'),
    ('hr_policies:read', 'hr'),
    ('hr_policies:update', 'hr'),
    ('hr_policies:delete', 'hr'),
    ('recruitment:create', 'hr'),
    ('recruitment:read', 'hr'),
    ('recruitment:update', 'hr'),
    ('recruitment:delete', 'hr'),
    ('performance:create', 'hr'),
    ('performance:read', 'hr'),
    ('performance:update', 'hr'),
    ('performance:delete', 'hr'),
    ('hr_approvals:create', 'hr'),
    ('hr_approvals:read', 'hr'),
    ('hr_approvals:update', 'hr'),
    ('hr_approvals:delete', 'hr'),
    ('products:create', 'retail'),
    ('products:read', 'retail'),
    ('products:update', 'retail'),
    ('products:delete', 'retail'),
    ('inventory:create', 'retail'),
    ('inventory:read', 'retail'),
    ('inventory:update', 'retail'),
    ('inventory:delete', 'retail'),
    ('sales:create', 'retail'),
    ('sales:read', 'retail'),
    ('sales:update', 'retail'),
    ('sales:delete', 'retail'),
    ('purchases:create', 'retail'),
    ('purchases:read', 'retail'),
    ('purchases:update', 'retail'),
    ('purchases:delete', 'retail'),
    ('pos:create', 'retail'),
    ('pos:read', 'retail'),
    ('pos:update', 'retail'),
    ('pos:delete', 'retail'),
    ('accounting:create', 'accounting'),
    ('accounting:read', 'accounting'),
    ('accounting:update', 'accounting'),
    ('accounting:delete', 'accounting'),
    ('pricing:create', 'retail'),
    ('pricing:read', 'retail'),
    ('pricing:update', 'retail'),
    ('pricing:delete', 'retail'),
    ('projects:create', 'projects'),
    ('projects:read', 'projects'),
    ('projects:update', 'projects'),
    ('projects:delete', 'projects'),
    ('tasks:create', 'projects'),
    ('tasks:read', 'projects'),
    ('tasks:update', 'projects'),
    ('tasks:delete', 'projects'),
    ('sprints:create', 'projects'),
    ('sprints:read', 'projects'),
    ('sprints:update', 'projects'),
    ('sprints:delete', 'projects'),
    ('project_invoices:create', 'projects'),
    ('project_invoices:read', 'projects'),
    ('project_invoices:update', 'projects'),
    ('project_invoices:delete', 'projects')
  ) AS k(key, module)
  WHERE NOT (r.permissions ? k.key)
    -- only grant modules the role already had (073 defaulted these to true)
    AND COALESCE((r.permissions->>('module_' || k.module))::boolean, true) IS TRUE
  GROUP BY r.id
) AS seed
WHERE wr.id = seed.id;

-- Viewers must never gain writes from the blanket seed above.
UPDATE public.workspace_roles
SET permissions = permissions || '{"inbox:create":false,"inbox:update":false,"inbox:delete":false,"contacts:create":false,"contacts:update":false,"contacts:delete":false,"pipelines:create":false,"pipelines:update":false,"pipelines:delete":false,"deals:create":false,"deals:update":false,"deals:delete":false,"broadcasts:create":false,"broadcasts:update":false,"broadcasts:delete":false,"automations:create":false,"automations:update":false,"automations:delete":false,"forms:create":false,"forms:update":false,"forms:delete":false,"quotations:create":false,"quotations:update":false,"quotations:delete":false,"commercials:create":false,"commercials:update":false,"commercials:delete":false,"invoices:create":false,"invoices:update":false,"invoices:delete":false,"templates:create":false,"templates:update":false,"templates:delete":false,"tags:create":false,"tags:update":false,"tags:delete":false,"media:create":false,"media:update":false,"media:delete":false,"chatbot:create":false,"chatbot:update":false,"chatbot:delete":false,"api_keys:create":false,"api_keys:update":false,"api_keys:delete":false,"employees:create":false,"employees:update":false,"employees:delete":false,"attendance:create":false,"attendance:update":false,"attendance:delete":false,"leave:create":false,"leave:update":false,"leave:delete":false,"payroll:create":false,"payroll:update":false,"payroll:delete":false,"hr_policies:create":false,"hr_policies:update":false,"hr_policies:delete":false,"recruitment:create":false,"recruitment:update":false,"recruitment:delete":false,"performance:create":false,"performance:update":false,"performance:delete":false,"hr_approvals:create":false,"hr_approvals:update":false,"hr_approvals:delete":false,"products:create":false,"products:update":false,"products:delete":false,"inventory:create":false,"inventory:update":false,"inventory:delete":false,"sales:create":false,"sales:update":false,"sales:delete":false,"purchases:create":false,"purchases:update":false,"purchases:delete":false,"pos:create":false,"pos:update":false,"pos:delete":false,"accounting:create":false,"accounting:update":false,"accounting:delete":false,"pricing:create":false,"pricing:update":false,"pricing:delete":false,"projects:create":false,"projects:update":false,"projects:delete":false,"tasks:create":false,"tasks:update":false,"tasks:delete":false,"sprints:create":false,"sprints:update":false,"sprints:delete":false,"project_invoices:create":false,"project_invoices:update":false,"project_invoices:delete":false}'::jsonb
WHERE is_system = true AND name = 'Viewer';

-- ---------------------------------------------------------------
-- 4. Backfill role_id for members that still have none, so the matrix
--    is actually consulted instead of failing closed.
-- ---------------------------------------------------------------
UPDATE public.workspace_members wm
SET role_id = wr.id
FROM public.workspace_roles wr
WHERE wm.role_id IS NULL
  AND wr.workspace_id = wm.workspace_id
  AND wr.is_system = true
  AND wr.name = CASE
        WHEN wm.role = 'owner'  THEN 'Owner'
        WHEN wm.role = 'admin'  THEN 'Admin'
        WHEN wm.role = 'viewer' THEN 'Viewer'
        ELSE 'Admin'   -- legacy 'member' rows keep today's full access
      END;

-- ---------------------------------------------------------------
-- 5. Per-operation RESTRICTIVE policies.
--
--    to_regclass guards mean a table from an unapplied module
--    migration is skipped rather than aborting the run.
--
--    CRITICAL: a RESTRICTIVE policy only ever subtracts. Postgres
--    grants nothing unless at least one PERMISSIVE policy matches, so
--    enabling RLS on a table that has none would return ZERO rows for
--    every non-service-role caller — including owners. Any table
--    without a permissive policy therefore gets a baseline
--    workspace-membership one first, preserving the access it has
--    today (and closing the tenant hole where RLS was simply off).
-- ---------------------------------------------------------------

DO $crud$
DECLARE
  r RECORD;
  act RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('conversations','inbox','crm'),
      ('contacts','contacts','crm'),
      ('pipelines','pipelines','crm'),
      ('deals','deals','crm'),
      ('broadcasts','broadcasts','crm'),
      ('automations','automations','crm'),
      ('custom_forms','forms','crm'),
      ('quotations','quotations','crm'),
      ('commercials','commercials','crm'),
      ('commercial_line_items','commercials','crm'),
      ('invoices','invoices','crm'),
      ('invoice_items','invoices','crm'),
      ('invoice_payments','invoices','crm'),
      ('message_templates','templates','crm'),
      ('tags','tags','crm'),
      ('custom_fields','tags','crm'),
      ('media_files','media','crm'),
      ('media_folders','media','crm'),
      ('chatbot_config','chatbot','crm'),
      ('api_keys','api_keys','crm'),
      ('employee_profiles','employees','hr'),
      ('employee_assets','employees','hr'),
      ('employee_documents','employees','hr'),
      ('hr_employees','employees','hr'),
      ('hr_employee_history','employees','hr'),
      ('hr_employee_promotions','employees','hr'),
      ('departments','employees','hr'),
      ('designations','employees','hr'),
      ('attendance','attendance','hr'),
      ('hr_attendance_breaks','attendance','hr'),
      ('hr_attendance_requests','attendance','hr'),
      ('time_logs','attendance','hr'),
      ('hr_shifts','attendance','hr'),
      ('hr_shift_assignments','attendance','hr'),
      ('leave_requests','leave','hr'),
      ('hr_holidays','leave','hr'),
      ('payroll_cycles','payroll','hr'),
      ('payslips','payroll','hr'),
      ('salary_advances','payroll','hr'),
      ('expense_claims','payroll','hr'),
      ('hr_salary_components','payroll','hr'),
      ('hr_salary_structures','payroll','hr'),
      ('hr_policies','hr_policies','hr'),
      ('hr_policy_versions','hr_policies','hr'),
      ('hr_policy_targets','hr_policies','hr'),
      ('hr_policy_acknowledgements','hr_policies','hr'),
      ('hr_policy_notifications','hr_policies','hr'),
      ('hr_operational_settings','hr_policies','hr'),
      ('hr_recruitment_jobs','recruitment','hr'),
      ('hr_candidates','recruitment','hr'),
      ('hr_job_applications','recruitment','hr'),
      ('hr_interviews','recruitment','hr'),
      ('hr_offer_letters','recruitment','hr'),
      ('hr_onboarding_tasks','recruitment','hr'),
      ('hr_onboarding_employee_tasks','recruitment','hr'),
      ('hr_performance_goals','performance','hr'),
      ('hr_performance_reviews','performance','hr'),
      ('hr_review_cycles','performance','hr'),
      ('hr_approval_workflows','hr_approvals','hr'),
      ('hr_approval_instances','hr_approvals','hr'),
      ('hr_employee_requests','hr_approvals','hr'),
      ('hr_audit_logs','hr_approvals','hr'),
      ('commerce_products','products','retail'),
      ('commerce_categories','products','retail'),
      ('commerce_product_attribute_definitions','products','retail'),
      ('master_brands','products','retail'),
      ('commerce_inventory_batches','inventory','retail'),
      ('commerce_inventory_movements','inventory','retail'),
      ('commerce_warehouses','inventory','retail'),
      ('commerce_stock_audits','inventory','retail'),
      ('commerce_stock_transfers','inventory','retail'),
      ('commerce_grn_receipts','inventory','retail'),
      ('commerce_sales_orders','sales','retail'),
      ('commerce_sales_returns','sales','retail'),
      ('commerce_rma_tickets','sales','retail'),
      ('commerce_loyalty_ledger','sales','retail'),
      ('commerce_purchase_orders','purchases','retail'),
      ('commerce_suppliers','purchases','retail'),
      ('commerce_cash_registers','pos','retail'),
      ('commerce_pos_held_bills','pos','retail'),
      ('commerce_chart_of_accounts','accounting','accounting'),
      ('commerce_journal_entries','accounting','accounting'),
      ('commerce_bank_accounts','accounting','accounting'),
      ('commerce_customer_khata','accounting','accounting'),
      ('commerce_gst_ledgers','accounting','accounting'),
      ('commerce_price_lists','pricing','retail'),
      ('master_cost_centers','pricing','retail'),
      ('commerce_workspace_settings','pricing','retail'),
      ('projects','projects','projects'),
      ('project_automations','projects','projects'),
      ('tasks','tasks','projects'),
      ('workspace_labels','tasks','projects'),
      ('project_invoices','project_invoices','projects')
    ) AS t(tbl, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);

    -- Guarantee a permissive baseline so enabling RLS can't black the
    -- table out. Only added when the table has no permissive policy of
    -- its own; existing ones are left exactly as they are.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND permissive = 'PERMISSIVE'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL '
        'USING (public.is_active_workspace_member(workspace_id, auth.uid())) '
        'WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()))',
        'members_baseline', r.tbl);
    END IF;

    FOR act IN
      SELECT * FROM (VALUES ('create','INSERT'), ('read','SELECT'), ('update','UPDATE'), ('delete','DELETE')) AS a(action, op)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'crud_'||act.action, r.tbl);
      IF act.op = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT '
          'WITH CHECK (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, r.resource, act.action, r.module);
      ELSIF act.op = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE '
          'USING (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L)) '
          'WITH CHECK (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, r.resource, act.action, r.module,
          r.resource, act.action, r.module);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s '
          'USING (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, act.op, r.resource, act.action, r.module);
      END IF;
    END LOOP;
  END LOOP;
END
$crud$;

DO $crudc$
DECLARE
  r RECORD;
  act RECORD;
  pred TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('messages','conversations','conversation_id','inbox','crm'),
      ('contact_tags','contacts','contact_id','contacts','crm'),
      ('contact_notes','contacts','contact_id','contacts','crm'),
      ('contact_custom_values','contacts','contact_id','contacts','crm'),
      ('pipeline_stages','pipelines','pipeline_id','pipelines','crm'),
      ('broadcast_recipients','broadcasts','broadcast_id','broadcasts','crm'),
      ('automation_steps','automations','automation_id','automations','crm'),
      ('automation_logs','automations','automation_id','automations','crm'),
      ('hr_salary_structure_components','hr_salary_structures','structure_id','payroll','hr'),
      ('hr_approval_steps','hr_approval_instances','instance_id','hr_approvals','hr'),
      ('commerce_product_variants','commerce_products','parent_product_id','products','retail'),
      ('commerce_warehouse_stock','commerce_warehouses','warehouse_id','inventory','retail'),
      ('commerce_stock_audit_items','commerce_stock_audits','audit_id','inventory','retail'),
      ('commerce_sales_items','commerce_sales_orders','sales_order_id','sales','retail'),
      ('commerce_purchase_items','commerce_purchase_orders','po_id','purchases','retail'),
      ('commerce_journal_lines','commerce_journal_entries','journal_entry_id','accounting','accounting'),
      ('commerce_price_list_items','commerce_price_lists','price_list_id','pricing','retail'),
      ('project_members','projects','project_id','projects','projects'),
      ('project_columns','projects','project_id','projects','projects'),
      ('project_statuses','projects','project_id','projects','projects'),
      ('project_workflows','projects','project_id','projects','projects'),
      ('project_components','projects','project_id','projects','projects'),
      ('project_activity','projects','project_id','projects','projects'),
      ('task_comments','tasks','task_id','tasks','projects'),
      ('task_files','tasks','task_id','tasks','projects'),
      ('task_activity','tasks','task_id','tasks','projects'),
      ('task_components','tasks','task_id','tasks','projects'),
      ('task_labels','tasks','task_id','tasks','projects'),
      ('task_watchers','tasks','task_id','tasks','projects'),
      ('epics','projects','project_id','sprints','projects'),
      ('sprints','projects','project_id','sprints','projects'),
      ('project_invoice_items','project_invoices','invoice_id','project_invoices','projects')
    ) AS t(tbl, parent, fk, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL OR to_regclass('public.'||r.parent) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND permissive = 'PERMISSIVE'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL '
        'USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.is_active_workspace_member(p.workspace_id, auth.uid()))) '
        'WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.is_active_workspace_member(p.workspace_id, auth.uid())))',
        'members_baseline', r.tbl, r.parent, r.tbl, r.fk, r.parent, r.tbl, r.fk);
    END IF;

    FOR act IN
      SELECT * FROM (VALUES ('create','INSERT'), ('read','SELECT'), ('update','UPDATE'), ('delete','DELETE')) AS a(action, op)
    LOOP
      -- workspace resolved through the parent row
      pred := format(
        'EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        'AND public.has_resource_permission(p.workspace_id, auth.uid(), %L, %L, %L))',
        r.parent, r.tbl, r.fk, r.resource, act.action, r.module);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'crud_'||act.action, r.tbl);
      IF act.op = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (%s)',
                       'crud_'||act.action, r.tbl, pred);
      ELSIF act.op = 'UPDATE' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)',
                       'crud_'||act.action, r.tbl, pred, pred);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s USING (%s)',
                       'crud_'||act.action, r.tbl, act.op, pred);
      END IF;
    END LOOP;
  END LOOP;
END
$crudc$;

-- ==================== END 076_crud_rbac_accounting_module ====================

-- ==================== BEGIN 077_employee_salary_fields ====================

-- ============================================================
-- 077 — salary fields on employee_profiles.
--
-- Payroll processing needs a per-employee salary source.
-- employee_profiles is the live employees table (keyed by
-- workspace_member_id) but carries no amounts — only a free-text
-- salary_grade. These monthly amounts mirror the payslips columns
-- so a payslip is generated by copying them and applying period
-- deductions (approved salary advances).
--
-- Additive and idempotent; safe to run before or after 075/076.
-- ============================================================

ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS basic_salary       NUMERIC NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  ADD COLUMN IF NOT EXISTS hra                NUMERIC NOT NULL DEFAULT 0 CHECK (hra >= 0),
  ADD COLUMN IF NOT EXISTS special_allowance  NUMERIC NOT NULL DEFAULT 0 CHECK (special_allowance >= 0),
  ADD COLUMN IF NOT EXISTS pf_deduction       NUMERIC NOT NULL DEFAULT 0 CHECK (pf_deduction >= 0),
  ADD COLUMN IF NOT EXISTS professional_tax   NUMERIC NOT NULL DEFAULT 0 CHECK (professional_tax >= 0),
  ADD COLUMN IF NOT EXISTS tds_deduction      NUMERIC NOT NULL DEFAULT 0 CHECK (tds_deduction >= 0);

COMMENT ON COLUMN public.employee_profiles.basic_salary IS
  'Monthly amounts consumed by payroll processing (payslip generation).';

-- ==================== END 077_employee_salary_fields ====================

