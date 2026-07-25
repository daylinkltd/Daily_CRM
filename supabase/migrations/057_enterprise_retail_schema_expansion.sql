-- supabase/migrations/057_enterprise_retail_schema_expansion.sql
-- ===========================================================================
-- Enterprise Retail ERP: Missing Business Fields & Schema Expansion (Non-Breaking)
-- ===========================================================================

-- 1. POS Held Bills Queue (Hold & Recall Bill)
CREATE TABLE IF NOT EXISTS public.commerce_pos_held_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    hold_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    cashier_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    customer_type TEXT DEFAULT 'RETAIL',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC DEFAULT 0,
    tax_total NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage commerce_pos_held_bills" ON public.commerce_pos_held_bills
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_pos_held_bills ENABLE ROW LEVEL SECURITY;

-- 2. Extend Sales Orders with Enterprise Billing & Customer Fields
ALTER TABLE public.commerce_sales_orders
ADD COLUMN IF NOT EXISTS is_walkin_customer BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'RETAIL' CHECK (customer_type IN ('RETAIL', 'WHOLESALE', 'DISTRIBUTOR')),
ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS customer_mobile TEXT,
ADD COLUMN IF NOT EXISTS is_loyalty_member BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS loyalty_membership_id TEXT,
ADD COLUMN IF NOT EXISTS price_list_applied_id UUID,
ADD COLUMN IF NOT EXISTS salesman_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS counter_number TEXT DEFAULT 'COUNTER-1',
ADD COLUMN IF NOT EXISTS invoice_series TEXT DEFAULT 'INV/',
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'TAX_INVOICE' CHECK (invoice_type IN ('TAX_INVOICE', 'ESTIMATE', 'DELIVERY_CHALLAN')),
ADD COLUMN IF NOT EXISTS financial_year TEXT DEFAULT '2026-2027',
ADD COLUMN IF NOT EXISTS bill_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS coupon_discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_code_applied TEXT,
ADD COLUMN IF NOT EXISTS manual_discount_reason TEXT,
ADD COLUMN IF NOT EXISTS price_level TEXT DEFAULT 'RETAIL',
ADD COLUMN IF NOT EXISTS is_home_delivery BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_received NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_returned NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_machine_id TEXT,
ADD COLUMN IF NOT EXISTS card_type TEXT,
ADD COLUMN IF NOT EXISTS card_approval_number TEXT,
ADD COLUMN IF NOT EXISTS transaction_status TEXT DEFAULT 'SUCCESS',
ADD COLUMN IF NOT EXISTS bank_charges_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_reference_number TEXT,
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT NOW();

-- 3. Extend Sales Line Items
ALTER TABLE public.commerce_sales_items
ADD COLUMN IF NOT EXISTS warehouse_id UUID,
ADD COLUMN IF NOT EXISTS free_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'PCS',
ADD COLUMN IF NOT EXISTS alternate_unit TEXT,
ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS mrp NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS serial_numbers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS imei_numbers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS warranty_months INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_remarks TEXT;

-- 4. Extend Core Product Master (`commerce_products`)
ALTER TABLE public.commerce_products
ADD COLUMN IF NOT EXISTS product_code TEXT,
ADD COLUMN IF NOT EXISTS multiple_barcodes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
ADD COLUMN IF NOT EXISTS alias_name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sub_category_id UUID,
ADD COLUMN IF NOT EXISTS brand_id UUID,
ADD COLUMN IF NOT EXISTS manufacturer_name TEXT,
ADD COLUMN IF NOT EXISTS department_name TEXT,
ADD COLUMN IF NOT EXISTS product_group TEXT,
ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'PCS',
ADD COLUMN IF NOT EXISTS purchase_unit TEXT DEFAULT 'BOX',
ADD COLUMN IF NOT EXISTS sales_unit TEXT DEFAULT 'PCS',
ADD COLUMN IF NOT EXISTS unit_conversion_factor NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_purchase_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS selling_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS retail_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wholesale_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS distributor_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS online_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT DEFAULT '7113',
ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cess_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS opening_stock NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_stock_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_quantity NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_stock_level NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS shelf_number TEXT,
ADD COLUMN IF NOT EXISTS default_warehouse_id UUID,
ADD COLUMN IF NOT EXISTS bin_location TEXT,
ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_discount BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_batch BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_serial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_slug TEXT,
ADD COLUMN IF NOT EXISTS web_description TEXT;

-- 5. Extend Inventory Batches & Stock Movement Audit
ALTER TABLE public.commerce_inventory_batches
ADD COLUMN IF NOT EXISTS best_before_date DATE,
ADD COLUMN IF NOT EXISTS batch_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS batch_mrp NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_id UUID,
ADD COLUMN IF NOT EXISTS purchase_invoice_number TEXT;

ALTER TABLE public.commerce_inventory_movements
ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'AVAILABLE' CHECK (stock_status IN ('AVAILABLE', 'RESERVED', 'DAMAGED', 'IN_TRANSIT', 'QC_HOLD', 'EXPIRED')),
ADD COLUMN IF NOT EXISTS adjustment_reason TEXT CHECK (adjustment_reason IS NULL OR adjustment_reason IN ('DAMAGE', 'THEFT', 'EXPIRED', 'STOCK_COUNT_AUDIT', 'OPENING_BALANCE', 'PRODUCTION_CONSUMPTION', 'OTHER'));

-- 6. Extend Customer Khata & CRM Contact Master
ALTER TABLE public.commerce_customer_khata
ADD COLUMN IF NOT EXISTS customer_category TEXT DEFAULT 'RETAIL' CHECK (customer_category IN ('RETAIL', 'WHOLESALE', 'CORPORATE')),
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
ADD COLUMN IF NOT EXISTS gstin TEXT,
ADD COLUMN IF NOT EXISTS reward_points_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- 7. Extend Chart of Accounts & General Ledger Vouchers
ALTER TABLE public.commerce_chart_of_accounts
ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES public.commerce_chart_of_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ledger_group TEXT DEFAULT 'CURRENT_ASSETS' CHECK (ledger_group IN ('CURRENT_ASSETS', 'SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'DUTIES_AND_TAXES', 'DIRECT_EXPENSES', 'INDIRECT_EXPENSES', 'SALES_ACCOUNTS', 'PURCHASE_ACCOUNTS', 'BANK_ACCOUNTS')),
ADD COLUMN IF NOT EXISTS nature TEXT DEFAULT 'ASSET' CHECK (nature IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_balance NUMERIC DEFAULT 0;

ALTER TABLE public.commerce_journal_entries
ADD COLUMN IF NOT EXISTS voucher_type TEXT DEFAULT 'JOURNAL' CHECK (voucher_type IN ('JOURNAL', 'CONTRA', 'RECEIPT', 'PAYMENT', 'SALES', 'PURCHASE', 'DEBIT_NOTE', 'CREDIT_NOTE')),
ADD COLUMN IF NOT EXISTS approved_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS cost_center_id UUID,
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS financial_year TEXT DEFAULT '2026-2027';

-- 8. Extend GST Tax Audit Ledgers
ALTER TABLE public.commerce_gst_ledgers
ADD COLUMN IF NOT EXISTS place_of_supply_state_code TEXT DEFAULT '27',
ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_lut_export BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_import BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_sez BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_composition_dealer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS eway_bill_number TEXT,
ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
ADD COLUMN IF NOT EXISTS transporter_name TEXT,
ADD COLUMN IF NOT EXISTS transporter_id TEXT,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;

-- 9. Extend Suppliers & Purchase Module
ALTER TABLE public.commerce_suppliers
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS payment_terms_days INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS credit_days INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS contact_person_name TEXT;

ALTER TABLE public.commerce_purchase_orders
ADD COLUMN IF NOT EXISTS purchase_series TEXT DEFAULT 'PO/',
ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS freight_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loading_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tcs_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC DEFAULT 0;

-- 10. Extend Cash Register Operations
ALTER TABLE public.commerce_cash_registers
ADD COLUMN IF NOT EXISTS opening_denomination_count JSONB DEFAULT '{"2000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20": 0, "10": 0, "coins": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS closing_cash_count NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_cash_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS manager_approval_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closing_remarks TEXT;
