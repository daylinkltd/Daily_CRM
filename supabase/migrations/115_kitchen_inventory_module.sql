-- ============================================================
-- 115_kitchen_inventory_module.sql
-- Petpooja-Style Kitchen Inventory & Raw Material Tracking System
-- Features: Raw Material Master, Stock Balances per Station,
--           Stock Movements (GRN, Transfer, Consumption, Wastage),
--           Prep Wastage Logging, Reorder Thresholds & Variance.
-- ============================================================

BEGIN;

-- 1. Raw Materials Master Catalog
CREATE TABLE IF NOT EXISTS public.kitchen_raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Basmati Rice", "Cottage Cheese (Paneer)", "Cooking Oil", "Chicken Breast"
    category TEXT DEFAULT 'GROCERY', -- GROCERY, POULTRY, MEAT, DAIRY, PRODUCE, SPICES, BEVERAGE_RAW, PACKAGING
    unit_of_measure TEXT DEFAULT 'KG', -- KG, GRAMS, LITERS, ML, UNITS, PACKETS
    cost_per_unit NUMERIC NOT NULL DEFAULT 0, -- Average purchase cost per base unit
    reorder_threshold NUMERIC DEFAULT 10, -- Trigger reorder alert when total stock <= this limit
    ideal_yield_percentage NUMERIC DEFAULT 100, -- e.g. 85% for vegetables after peeling/trimming
    preferred_supplier TEXT, -- e.g. "Metro Cash & Carry"
    shelf_life_days INT DEFAULT 30, -- e.g. 3 days for Dairy/Meat, 60 days for Groceries
    gst_rate NUMERIC DEFAULT 5, -- GST tax % (0, 5, 12, 18)
    hsn_code TEXT, -- Tax HSN/SAC code
    barcode TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_raw_materials_workspace ON public.kitchen_raw_materials(workspace_id);

-- 2. Kitchen Stock Balances (by Storage Location / Station)
CREATE TABLE IF NOT EXISTS public.kitchen_stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.kitchen_raw_materials(id) ON DELETE CASCADE,
    location TEXT NOT NULL DEFAULT 'STORE_ROOM', -- STORE_ROOM, MAIN_KITCHEN, TANDOOR, PANTRY, BAKERY, BAR_STATION
    current_stock NUMERIC NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_kitchen_stock_location UNIQUE(raw_material_id, location)
);
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_balances_workspace ON public.kitchen_stock_balances(workspace_id);

-- 3. Stock Movements Audit Ledger
CREATE TABLE IF NOT EXISTS public.kitchen_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.kitchen_raw_materials(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('INWARD_GRN', 'STATION_TRANSFER', 'DISH_RECIPE_CONSUMPTION', 'SPOILAGE_WASTAGE', 'ADJUSTMENT')),
    source_location TEXT, -- e.g. SUPPLIER or STORE_ROOM
    destination_location TEXT, -- e.g. STORE_ROOM or TANDOOR
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    reference_id TEXT, -- Invoice No, KOT Order No, or Transfer Slip No
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_movements_workspace ON public.kitchen_stock_movements(workspace_id);

-- 4. Prep Spoilage & Wastage Log
CREATE TABLE IF NOT EXISTS public.kitchen_wastage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.kitchen_raw_materials(id) ON DELETE CASCADE,
    location TEXT DEFAULT 'MAIN_KITCHEN',
    quantity_lost NUMERIC NOT NULL,
    unit_of_measure TEXT DEFAULT 'KG',
    reason TEXT NOT NULL, -- EXPIRED, SPOILED, PREP_TRIMMING, OVERCOOKED_BURNT, STORAGE_DAMAGE
    cost_impact NUMERIC NOT NULL DEFAULT 0,
    reported_by_name TEXT DEFAULT 'Head Chef',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_wastage_logs_workspace ON public.kitchen_wastage_logs(workspace_id);

-- 5. Kitchen Storage Locations Master
CREATE TABLE IF NOT EXISTS public.kitchen_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_locations_workspace ON public.kitchen_locations(workspace_id);

-- 6. Kitchen Suppliers / Vendors Master
CREATE TABLE IF NOT EXISTS public.kitchen_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    payment_terms TEXT DEFAULT 'NET_30',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_suppliers_workspace ON public.kitchen_suppliers(workspace_id);

-- Row Level Security (RLS)
ALTER TABLE public.kitchen_raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_wastage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active workspace members can manage kitchen_raw_materials" ON public.kitchen_raw_materials FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage kitchen_stock_balances" ON public.kitchen_stock_balances FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage kitchen_stock_movements" ON public.kitchen_stock_movements FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage kitchen_wastage_logs" ON public.kitchen_wastage_logs FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage kitchen_locations" ON public.kitchen_locations FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage kitchen_suppliers" ON public.kitchen_suppliers FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

COMMIT;
