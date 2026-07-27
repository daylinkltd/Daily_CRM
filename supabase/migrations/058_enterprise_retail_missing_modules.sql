-- supabase/migrations/058_enterprise_retail_missing_modules.sql
-- ===========================================================================
-- Enterprise Retail ERP: Missing Modules Schema (Multi-Warehouse, Price Lists, GRN, Stock Audit, RMA, Loyalty, WMS, Service)
-- ===========================================================================

-- 1. Multi-Warehouse & Location Management
CREATE TABLE IF NOT EXISTS public.commerce_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, code)
);
CREATE POLICY "Active members can manage commerce_warehouses" ON public.commerce_warehouses
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_warehouses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES public.commerce_warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    bin_location TEXT,
    rack_number TEXT,
    shelf_number TEXT,
    current_stock NUMERIC DEFAULT 0,
    reserved_stock NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id)
);
CREATE POLICY "Active members can manage warehouse stock" ON public.commerce_warehouse_stock
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_warehouses
            WHERE commerce_warehouses.id = commerce_warehouse_stock.warehouse_id
            AND public.is_active_workspace_member(commerce_warehouses.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_warehouse_stock ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    from_warehouse_id UUID NOT NULL REFERENCES public.commerce_warehouses(id) ON DELETE CASCADE,
    to_warehouse_id UUID NOT NULL REFERENCES public.commerce_warehouses(id) ON DELETE CASCADE,
    approved_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    transfer_status TEXT DEFAULT 'DRAFT' CHECK (transfer_status IN ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage stock transfers" ON public.commerce_stock_transfers
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_stock_transfers ENABLE ROW LEVEL SECURITY;

-- 2. Price List Master & Tiered Items
CREATE TABLE IF NOT EXISTS public.commerce_price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Retail, Wholesale, Distributor, Dealer, VIP, Corporate, Online, Branch Price
    code TEXT NOT NULL,
    currency TEXT DEFAULT 'INR',
    priority INT DEFAULT 1,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_tax_inclusive BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, code)
);
CREATE POLICY "Active members can manage price lists" ON public.commerce_price_lists
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_price_lists ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES public.commerce_price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    pricing_mode TEXT DEFAULT 'FIXED_PRICE' CHECK (pricing_mode IN ('FIXED_PRICE', 'DISCOUNT_PERCENT', 'MARKUP_PERCENT')),
    fixed_price NUMERIC DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    markup_percent NUMERIC DEFAULT 0,
    min_quantity NUMERIC DEFAULT 1,
    max_quantity NUMERIC DEFAULT 999999,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, product_id, min_quantity)
);
CREATE POLICY "Active members can manage price list items" ON public.commerce_price_list_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_price_lists
            WHERE commerce_price_lists.id = commerce_price_list_items.price_list_id
            AND public.is_active_workspace_member(commerce_price_lists.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_price_list_items ENABLE ROW LEVEL SECURITY;

-- 3. Physical Stock Audit & Discrepancy Reconciliation
CREATE TABLE IF NOT EXISTS public.commerce_stock_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    audit_number TEXT NOT NULL,
    warehouse_id UUID REFERENCES public.commerce_warehouses(id) ON DELETE SET NULL,
    audited_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    audit_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'RECONCILED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage stock audits" ON public.commerce_stock_audits
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_stock_audits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commerce_stock_audit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.commerce_stock_audits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    system_qty NUMERIC DEFAULT 0,
    physical_qty NUMERIC DEFAULT 0,
    variance_qty NUMERIC DEFAULT 0,
    variance_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage audit items" ON public.commerce_stock_audit_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_stock_audits
            WHERE commerce_stock_audits.id = commerce_stock_audit_items.audit_id
            AND public.is_active_workspace_member(commerce_stock_audits.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_stock_audit_items ENABLE ROW LEVEL SECURITY;

-- 4. Goods Receipt Note (GRN) & QC Inspection
CREATE TABLE IF NOT EXISTS public.commerce_grn_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    grn_number TEXT NOT NULL,
    po_id UUID REFERENCES public.commerce_purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.commerce_suppliers(id) ON DELETE SET NULL,
    challan_number TEXT,
    received_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    qc_status TEXT DEFAULT 'PASSED' CHECK (qc_status IN ('PENDING', 'PASSED', 'REJECTED', 'PARTIAL_REJECT')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage grn receipts" ON public.commerce_grn_receipts
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_grn_receipts ENABLE ROW LEVEL SECURITY;

-- 5. Sales Returns & Restocking
CREATE TABLE IF NOT EXISTS public.commerce_sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    return_number TEXT NOT NULL,
    sales_order_id UUID REFERENCES public.commerce_sales_orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    approved_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    return_reason TEXT CHECK (return_reason IN ('DEFECTIVE', 'EXPIRED', 'WRONG_ITEM', 'CUSTOMER_MIND_CHANGE', 'OTHER')),
    refund_mode TEXT DEFAULT 'CASH' CHECK (refund_mode IN ('CASH', 'BANK', 'KHATA_CREDIT', 'STORE_CREDIT_VOUCHER')),
    total_refund_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage sales returns" ON public.commerce_sales_returns
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_sales_returns ENABLE ROW LEVEL SECURITY;

-- 6. Return Merchandise Authorization (RMA) Tickets
CREATE TABLE IF NOT EXISTS public.commerce_rma_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
    serial_number TEXT,
    complaint_description TEXT,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INSPECTION', 'REPAIR', 'REPLACED', 'REFUNDED', 'CLOSED')),
    assigned_technician_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage rma tickets" ON public.commerce_rma_tickets
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_rma_tickets ENABLE ROW LEVEL SECURITY;

-- 7. Loyalty & Rewards Engine
CREATE TABLE IF NOT EXISTS public.commerce_loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    points_earned NUMERIC DEFAULT 0,
    points_redeemed NUMERIC DEFAULT 0,
    balance_points NUMERIC DEFAULT 0,
    transaction_type TEXT CHECK (transaction_type IN ('EARNED_SALE', 'REDEEMED_CHECKOUT', 'EXPIRED_POINTS', 'MANUAL_ADJUSTMENT')),
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage loyalty ledger" ON public.commerce_loyalty_ledger
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_loyalty_ledger ENABLE ROW LEVEL SECURITY;
