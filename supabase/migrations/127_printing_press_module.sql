-- ============================================================
-- 127 — Printing Press module: job orders from enquiry to delivery.
--
-- The one piece of the printing-press flow the platform doesn't already
-- have. Customers are CRM contacts, catalog/units/inventory/suppliers/
-- purchases/returns live in Retail (commerce_*), quick walk-in billing
-- is the POS, and invoices/payments are the existing `invoices` chain.
-- What was missing is the JOB: enquiry → quotation → approval → advance
-- → production (design/print/finishing) → invoice → final payment →
-- delivered — with the printing-specific item attributes (size, paper,
-- GSM, print type 1/0–4/4, colour mode, finishing, design file).
--
-- Same conventions as the bar module (113): workspace-scoped tables,
-- member ALL policy via is_active_workspace_member, module gated by
-- `module_printing` in role permissions (owner/admin bypass in code and
-- in has_workspace_permission).
-- ============================================================

-- 1. The job header. Status is the business flow from the flow chart;
--    production_stage sub-divides IN_PRODUCTION exactly as the chart
--    does (Design → Print → Finishing).
CREATE TABLE IF NOT EXISTS public.printing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_no TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    -- Walk-ins and enquiries that never become contacts still need a name.
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'ENQUIRY' CHECK (status IN (
        'ENQUIRY', 'QUOTED', 'APPROVED', 'IN_PRODUCTION',
        'COMPLETED', 'INVOICED', 'DELIVERED', 'CANCELLED'
    )),
    production_stage TEXT CHECK (production_stage IN ('DESIGN', 'PRINT', 'FINISHING')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    advance_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- Set when "Generate invoice" hands the job to the billing chain.
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, order_no)
);

-- 2. Job lines with the printing-specific attributes from the flow
--    chart. product_id is optional — a bespoke job ("wedding card,
--    client's own design") needs no catalog row.
CREATE TABLE IF NOT EXISTS public.printing_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.printing_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit TEXT,
    rate NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    size TEXT,                 -- e.g. 3.5 x 2 inch
    paper_type TEXT,           -- e.g. Art Card
    gsm TEXT,                  -- e.g. 300
    print_type TEXT,           -- 1/0, 4/4, …
    color_mode TEXT,           -- B/W, Colour
    finishing TEXT,            -- lamination, binding, cutting…
    design_file TEXT,          -- URL/path of the artwork
    special_instructions TEXT,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printing_orders_workspace
    ON public.printing_orders (workspace_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_printing_order_items_order
    ON public.printing_order_items (order_id);

-- 3. RLS — bar-module pattern: any active member of the workspace may
--    act; the module switch + role matrix gate the UI, and
--    has_workspace_permission gates privileged API paths.
ALTER TABLE public.printing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printing_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active workspace members can manage printing_orders" ON public.printing_orders;
CREATE POLICY "Active workspace members can manage printing_orders" ON public.printing_orders
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage printing_order_items" ON public.printing_order_items;
CREATE POLICY "Active workspace members can manage printing_order_items" ON public.printing_order_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.printing_orders o
        WHERE o.id = order_id
          AND public.is_active_workspace_member(o.workspace_id, auth.uid())
    ));

-- 4. Job numbers: PJ-000001… per workspace through the atomic
--    generate_next_document_number() RPC. Since migration 123 the RPC
--    auto-creates a series row on first use, but its defaults would be
--    'PRI/' + yearly reset — this seed row is the TEMPLATE it copies
--    instead: PJ- prefix, never resets. 123 also made `period_key`
--    NOT NULL (the reset period a counter belongs to); for reset_rule
--    NEVER the period is 'ALL' (see document_series_period_key).
INSERT INTO public.platform_number_series
    (workspace_id, document_type, prefix, suffix, running_number, reset_rule, period_key, financial_year)
SELECT w.id, 'PRINTING_ORDER', 'PJ-', '', 1, 'NEVER', 'ALL', 'ALL'
FROM public.workspaces w
ON CONFLICT (workspace_id, document_type, period_key) DO NOTHING;

-- Workspaces created after this migration need the same template, or
-- their first job numbers as the generator's generic 'PRI/000001'.
CREATE OR REPLACE FUNCTION public.seed_printing_number_series()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.platform_number_series
        (workspace_id, document_type, prefix, suffix, running_number, reset_rule, period_key, financial_year)
    VALUES (NEW.id, 'PRINTING_ORDER', 'PJ-', '', 1, 'NEVER', 'ALL', 'ALL')
    ON CONFLICT (workspace_id, document_type, period_key) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_printing_number_series ON public.workspaces;
CREATE TRIGGER trg_seed_printing_number_series
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.seed_printing_number_series();

-- 5. Invoices generated from printing jobs carry their own source tag.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_source_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_source_check
    CHECK (source IN ('crm', 'project', 'retail', 'printing'));

-- ============================================================
-- Verify (run after pasting):
--
-- SELECT to_regclass('public.printing_orders');        -- not null
-- SELECT to_regclass('public.printing_order_items');   -- not null
-- SELECT count(*) FROM public.platform_number_series
--   WHERE document_type = 'PRINTING_ORDER';            -- = workspace count
-- SELECT tgname FROM pg_trigger
--   WHERE tgname = 'trg_seed_printing_number_series';  -- exists
-- SELECT conname FROM pg_constraint
--   WHERE conname = 'invoices_source_check';           -- exists
-- ============================================================
