-- ============================================================
-- 113_bar_management_module.sql
-- Bar Management ERP Module for Daily CRM
-- Features: KSBCL Excise Compliance, Bottle-to-Litre Packaging Ratios,
--           Atomic Stock Depletion RPCs, KDS, Shifts, & Guest Loyalty.
-- ============================================================

BEGIN;

-- 1. Bar Branches / Locations
CREATE TABLE IF NOT EXISTS public.bar_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_branches_workspace ON public.bar_branches(workspace_id);

-- 2. Floor Layout & Bar Tables
CREATE TABLE IF NOT EXISTS public.bar_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.bar_branches(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    section_name TEXT DEFAULT 'Main Floor', -- Main Floor, Rooftop, Bar Counter, VIP Booth
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT DEFAULT 'VACANT' CHECK (status IN ('VACANT', 'OCCUPIED', 'RESERVED', 'BILLING')),
    pos_x NUMERIC DEFAULT 0,
    pos_y NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_tables_workspace ON public.bar_tables(workspace_id);

CREATE TABLE IF NOT EXISTS public.bar_table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.bar_tables(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    party_size INTEGER NOT NULL DEFAULT 2,
    reservation_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bottle-to-Litre Packaging Templates
CREATE TABLE IF NOT EXISTS public.bar_packaging_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Quart Case (12x750ml)", "Nip Case (48x180ml)"
    bottle_size_ml NUMERIC NOT NULL, -- 750, 375, 180, 500, 650
    bottles_per_case INTEGER NOT NULL, -- 12, 24, 48
    total_litres_per_case NUMERIC NOT NULL, -- 9.00, 8.64, 12.00
    tare_weight_grams NUMERIC DEFAULT 450, -- Empty bottle tare weight on scale
    liquid_density NUMERIC DEFAULT 0.98, -- Grams per ml
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bar Brands & Liquor Categories
CREATE TABLE IF NOT EXISTS public.bar_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Whisky, Rum, Vodka, Gin, Craft Beer, Wine, Cocktails
    excise_category TEXT DEFAULT 'IMFL', -- IMFL, IFL, Beer, Wine, Craft Draft
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.bar_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Glenfiddich, Jack Daniel's, Old Monk, Heineken
    manufacturer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cocktail Recipes (Bill of Materials)
CREATE TABLE IF NOT EXISTS public.bar_cocktail_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    cocktail_product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    ingredient_product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    volume_ml NUMERIC NOT NULL, -- e.g. 30ml
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Alcohol Inventory Stock
CREATE TABLE IF NOT EXISTS public.bar_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.bar_branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    sealed_bottles INTEGER DEFAULT 0,
    open_bottles_ml NUMERIC DEFAULT 0,
    total_volume_ml NUMERIC NOT NULL DEFAULT 0,
    wac_cost_per_ml NUMERIC DEFAULT 0, -- Weighted Average Cost per ML
    reorder_level_ml NUMERIC DEFAULT 5000,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_bar_inventory_product UNIQUE(workspace_id, branch_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_bar_inventory_product ON public.bar_inventory(product_id);

-- 7. KSBCL Inward Stock Entry (GRN)
CREATE TABLE IF NOT EXISTS public.bar_inward_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.bar_branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    ksbcl_permit_no TEXT NOT NULL,
    indent_no TEXT,
    eal_serial_start TEXT, -- Excise Adhesive Label serial start
    eal_serial_end TEXT,
    batch_number TEXT,
    mfd_date DATE,
    cases_received INTEGER NOT NULL,
    bottles_received INTEGER NOT NULL,
    total_volume_ml NUMERIC NOT NULL,
    case_purchase_price NUMERIC NOT NULL,
    unit_cost_per_ml NUMERIC NOT NULL,
    excise_duty_amount NUMERIC DEFAULT 0,
    received_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Damage & Breakage Logs
CREATE TABLE IF NOT EXISTS public.bar_damage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.bar_branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    damage_type TEXT NOT NULL CHECK (damage_type IN ('TRANSIT_DAMAGE', 'COUNTER_BREAKAGE', 'EXPIRED_BEER', 'CORKAGE_SPOILAGE')),
    bottles_damaged INTEGER NOT NULL DEFAULT 0,
    volume_ml_damaged NUMERIC NOT NULL DEFAULT 0,
    ksbcl_permit_no TEXT, -- Mandatory for TRANSIT_DAMAGE GRN claims
    photo_url TEXT,
    reason TEXT,
    authorized_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Open Bottle Scale Audits
CREATE TABLE IF NOT EXISTS public.bar_bottle_weight_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    gross_weight_grams NUMERIC NOT NULL,
    tare_weight_grams NUMERIC NOT NULL,
    calculated_ml NUMERIC NOT NULL,
    audited_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    audited_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Keg Taps & Craft Beer Aging
CREATE TABLE IF NOT EXISTS public.bar_keg_taps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    tap_number INTEGER NOT NULL,
    product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
    keg_capacity_ml NUMERIC DEFAULT 50000,
    remaining_ml NUMERIC DEFAULT 50000,
    line_loss_allowance_percent NUMERIC DEFAULT 3.0,
    tapped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_beer_aging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    barrel_identifier TEXT NOT NULL,
    barrel_type TEXT DEFAULT 'Oak Barrel',
    batch_number TEXT,
    aging_start_date DATE NOT NULL,
    target_maturation_date DATE NOT NULL,
    abv_percent NUMERIC,
    tasting_notes TEXT,
    status TEXT DEFAULT 'AGING' CHECK (status IN ('AGING', 'READY_FOR_BOTTLING', 'TAPPED', 'DISCARDED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. POS Orders & Payments
CREATE TABLE IF NOT EXISTS public.bar_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.bar_branches(id) ON DELETE SET NULL,
    table_id UUID REFERENCES public.bar_tables(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    server_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    order_status TEXT DEFAULT 'OPEN' CHECK (order_status IN ('OPEN', 'SENT_TO_KITCHEN', 'SERVED', 'BILLED', 'CLOSED', 'CANCELLED')),
    payment_status TEXT DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_orders_workspace ON public.bar_orders(workspace_id);

CREATE TABLE IF NOT EXISTS public.bar_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.bar_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    portion_type TEXT DEFAULT '30ML' CHECK (portion_type IN ('30ML', '60ML', 'PEG', 'BOTTLE', 'PINT', 'CAN', 'COCKTAIL', 'FOOD')),
    quantity INTEGER NOT NULL DEFAULT 1,
    volume_ml_per_unit NUMERIC NOT NULL DEFAULT 30,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    kds_status TEXT DEFAULT 'PENDING' CHECK (kds_status IN ('PENDING', 'PREPARING', 'READY', 'SERVED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.bar_orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'ROOM_BILL', 'MANAGER_COMP')),
    amount NUMERIC NOT NULL,
    transaction_reference TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Bartender Shifts & Cash Registers
CREATE TABLE IF NOT EXISTS public.bar_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    bartender_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    starting_cash_float NUMERIC NOT NULL DEFAULT 0,
    ending_cash_actual NUMERIC,
    expected_cash NUMERIC,
    cash_difference NUMERIC,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.bar_cash_drawer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.bar_shifts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('FLOAT', 'SALE_CASH', 'CASH_DROP', 'PAID_OUT')),
    amount NUMERIC NOT NULL,
    notes TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Guest Loyalty Extension (links to contacts.id)
CREATE TABLE IF NOT EXISTS public.bar_loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Bronze, Silver, Gold, Platinum
    min_total_spend NUMERIC NOT NULL DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bar_loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL DEFAULT 0,
    points_redeemed INTEGER NOT NULL DEFAULT 0,
    current_balance INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_bar_loyalty_contact UNIQUE(workspace_id, contact_id)
);

-- ============================================================
-- ATOMIC STOCK DEPLETION RPC (WITH FOR UPDATE ROW LOCKING)
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_deplete_bar_stock(
  p_workspace_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_volume_ml NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_stock NUMERIC;
BEGIN
  -- Perform Row-Level Lock on target inventory row to prevent concurrent race conditions
  SELECT total_volume_ml INTO v_current_stock
  FROM public.bar_inventory
  WHERE workspace_id = p_workspace_id
    AND product_id = p_product_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bar inventory record not found for product %', p_product_id;
  END IF;

  IF v_current_stock < p_volume_ml THEN
    RAISE EXCEPTION 'Insufficient stock for product %. Available: % ml, Requested: % ml', p_product_id, v_current_stock, p_volume_ml;
  END IF;

  UPDATE public.bar_inventory
  SET total_volume_ml = total_volume_ml - p_volume_ml,
      updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND product_id = p_product_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.bar_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_table_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_packaging_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_cocktail_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_inward_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_damage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_bottle_weight_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_keg_taps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_beer_aging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_cash_drawer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_loyalty_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active workspace members can manage bar_branches" ON public.bar_branches;
CREATE POLICY "Active workspace members can manage bar_branches" ON public.bar_branches FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_tables" ON public.bar_tables;
CREATE POLICY "Active workspace members can manage bar_tables" ON public.bar_tables FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_table_reservations" ON public.bar_table_reservations;
CREATE POLICY "Active workspace members can manage bar_table_reservations" ON public.bar_table_reservations FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_packaging_templates" ON public.bar_packaging_templates;
CREATE POLICY "Active workspace members can manage bar_packaging_templates" ON public.bar_packaging_templates FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_categories" ON public.bar_categories;
CREATE POLICY "Active workspace members can manage bar_categories" ON public.bar_categories FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_brands" ON public.bar_brands;
CREATE POLICY "Active workspace members can manage bar_brands" ON public.bar_brands FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_cocktail_recipes" ON public.bar_cocktail_recipes;
CREATE POLICY "Active workspace members can manage bar_cocktail_recipes" ON public.bar_cocktail_recipes FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_inventory" ON public.bar_inventory;
CREATE POLICY "Active workspace members can manage bar_inventory" ON public.bar_inventory FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_inward_stock" ON public.bar_inward_stock;
CREATE POLICY "Active workspace members can manage bar_inward_stock" ON public.bar_inward_stock FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_damage_logs" ON public.bar_damage_logs;
CREATE POLICY "Active workspace members can manage bar_damage_logs" ON public.bar_damage_logs FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_bottle_weight_audits" ON public.bar_bottle_weight_audits;
CREATE POLICY "Active workspace members can manage bar_bottle_weight_audits" ON public.bar_bottle_weight_audits FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_keg_taps" ON public.bar_keg_taps;
CREATE POLICY "Active workspace members can manage bar_keg_taps" ON public.bar_keg_taps FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_beer_aging" ON public.bar_beer_aging;
CREATE POLICY "Active workspace members can manage bar_beer_aging" ON public.bar_beer_aging FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_orders" ON public.bar_orders;
CREATE POLICY "Active workspace members can manage bar_orders" ON public.bar_orders FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_shifts" ON public.bar_shifts;
CREATE POLICY "Active workspace members can manage bar_shifts" ON public.bar_shifts FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_loyalty_tiers" ON public.bar_loyalty_tiers;
CREATE POLICY "Active workspace members can manage bar_loyalty_tiers" ON public.bar_loyalty_tiers FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active workspace members can manage bar_loyalty_ledger" ON public.bar_loyalty_ledger;
CREATE POLICY "Active workspace members can manage bar_loyalty_ledger" ON public.bar_loyalty_ledger FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

COMMIT;
