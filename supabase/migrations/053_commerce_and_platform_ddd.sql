-- supabase/migrations/053_commerce_and_platform_ddd.sql
-- ===========================================================================
-- Commerce Bounded Context & Platform Shared Services Schema
-- ===========================================================================

-- 1. Extend Workspaces table for Capabilities & Business Profile
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'GENERAL_RETAIL',
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{
  "inventory": true,
  "pos": true,
  "weight_pricing": false,
  "batch_expiry": false,
  "metal_rates": false,
  "tables_kot": false,
  "appointments": false
}'::jsonb;

-- 2. Master Product Categories
CREATE TABLE IF NOT EXISTS public.commerce_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage commerce_categories" ON public.commerce_categories
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_categories ENABLE ROW LEVEL SECURITY;

-- 3. Core Product Master
CREATE TABLE IF NOT EXISTS public.commerce_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.commerce_categories(id) ON DELETE SET NULL,
    brand TEXT,
    unit TEXT DEFAULT 'PCS',
    tax_rate NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    mrp NUMERIC DEFAULT 0,
    reorder_level NUMERIC DEFAULT 10,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),
    attributes JSONB DEFAULT '{}'::jsonb, -- Flexible vertical extensions (Size/Color, Karats, Rx flags)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_commerce_products_barcode ON public.commerce_products(workspace_id, barcode);
CREATE POLICY "Active members can manage commerce_products" ON public.commerce_products
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;

-- 4. Inventory Batches (Pharmacy & Grocery FEFO Tracking)
CREATE TABLE IF NOT EXISTS public.commerce_inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    mfg_date DATE,
    expiry_date DATE,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    stock_quantity NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.commerce_inventory_batches(workspace_id, expiry_date);
CREATE POLICY "Active members can manage commerce_inventory_batches" ON public.commerce_inventory_batches
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_inventory_batches ENABLE ROW LEVEL SECURITY;

-- 5. Inventory Stock Movements & Adjustments
CREATE TABLE IF NOT EXISTS public.commerce_inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.commerce_inventory_batches(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('INWARD', 'OUTWARD_SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN')),
    quantity NUMERIC NOT NULL,
    reference_id TEXT, -- Order ID or Invoice ID
    notes TEXT,
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage commerce_inventory_movements" ON public.commerce_inventory_movements
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_inventory_movements ENABLE ROW LEVEL SECURITY;

-- 6. Suppliers / Vendor Master Data
CREATE TABLE IF NOT EXISTS public.commerce_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    outstanding_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage commerce_suppliers" ON public.commerce_suppliers
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_suppliers ENABLE ROW LEVEL SECURITY;

-- 7. Purchase Orders & Inward Stock
CREATE TABLE IF NOT EXISTS public.commerce_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    supplier_id UUID REFERENCES public.commerce_suppliers(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED')),
    total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage commerce_purchase_orders" ON public.commerce_purchase_orders
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.commerce_purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL
);
CREATE POLICY "Active members can manage commerce_purchase_items" ON public.commerce_purchase_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_purchase_orders
            WHERE commerce_purchase_orders.id = commerce_purchase_items.po_id
            AND public.is_active_workspace_member(commerce_purchase_orders.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_purchase_items ENABLE ROW LEVEL SECURITY;

-- 8. Commerce Sales Orders & POS Checkout Invoices
CREATE TABLE IF NOT EXISTS public.commerce_sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL, -- Reused CRM Contact Master
    channel TEXT DEFAULT 'POS' CHECK (channel IN ('POS', 'DIRECT_SALE', 'WHOLESALE', 'ONLINE')),
    payment_status TEXT DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID', 'KHATA_CREDIT')),
    payment_method TEXT DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'KHATA', 'SPLIT')),
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_total NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    cashier_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_workspace ON public.commerce_sales_orders(workspace_id, created_at DESC);
CREATE POLICY "Active members can manage commerce_sales_orders" ON public.commerce_sales_orders
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_sales_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_sales_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES public.commerce_sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.commerce_inventory_batches(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    total_price NUMERIC NOT NULL
);
CREATE POLICY "Active members can manage commerce_sales_items" ON public.commerce_sales_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_sales_orders
            WHERE commerce_sales_orders.id = commerce_sales_items.sales_order_id
            AND public.is_active_workspace_member(commerce_sales_orders.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_sales_items ENABLE ROW LEVEL SECURITY;

-- 9. Cash Register & Day-End Z-Reports
CREATE TABLE IF NOT EXISTS public.commerce_cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    cashier_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    opening_cash NUMERIC NOT NULL DEFAULT 0,
    closing_cash NUMERIC,
    total_sales_cash NUMERIC DEFAULT 0,
    total_sales_upi NUMERIC DEFAULT 0,
    total_sales_card NUMERIC DEFAULT 0,
    total_sales_khata NUMERIC DEFAULT 0,
    discrepancy NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE POLICY "Active members can manage commerce_cash_registers" ON public.commerce_cash_registers
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_cash_registers ENABLE ROW LEVEL SECURITY;

-- 10. Platform Pragmatic Domain Event Transaction Log
CREATE TABLE IF NOT EXISTS public.platform_domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'SaleCompleted', 'StockDepleted', 'InvoicePaid'
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage platform_domain_events" ON public.platform_domain_events
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.platform_domain_events ENABLE ROW LEVEL SECURITY;
