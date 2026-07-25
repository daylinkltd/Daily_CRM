-- supabase/migrations/059_enterprise_retail_configuration_engine.sql
-- ===========================================================================
-- Enterprise Retail ERP: Master Configuration Engine, 12 Industry Presets, Master Data Layer & SaaS Feature Flags
-- ===========================================================================

-- 1. Master Workspace Settings & 20 Configuration Domains
CREATE TABLE IF NOT EXISTS public.commerce_workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    industry_template TEXT DEFAULT 'GENERAL_RETAIL' CHECK (industry_template IN (
        'GENERAL_RETAIL', 'GROCERY', 'PHARMACY', 'GARMENT', 'FOOTWEAR', 
        'ELECTRONICS', 'JEWELLERY', 'HARDWARE', 'FURNITURE', 'AUTOMOBILE', 
        'BOOKS_STATIONERY', 'RESTAURANT', 'MANUFACTURING'
    )),
    retail_settings JSONB NOT NULL DEFAULT '{
        "product_identification": {
            "sku": true, "barcode": true, "multi_barcode": true, "qr_code": true,
            "alias_name": true, "serial_number": false, "imei_number": false
        },
        "inventory": {
            "track_inventory": true, "allow_negative_stock": false, "batch_tracking": true,
            "expiry_tracking": true, "fefo_selling": true, "warehouse_management": true, "rack_bin": true
        },
        "pricing": {
            "mrp": true, "purchase_price": true, "selling_price": true,
            "wholesale_price": true, "distributor_price": true, "online_price": false
        },
        "discount": {
            "line_discount": true, "bill_discount": true, "coupon_discount": true,
            "max_discount_percent": 25.0, "approval_required_above": 15.0
        },
        "tax": {
            "gst_enabled": true, "cess_enabled": false, "tax_inclusive_pricing": true, "hsn_mandatory": true
        },
        "units": {
            "multi_units": true, "alternate_units": true, "decimal_quantity": true, "conversion_factor": true
        },
        "batch_expiry": {
            "batch_mandatory": true, "fefo_selling": true, "expiry_warning": true, "expiry_blocking": true
        },
        "sales": {
            "allow_returns": true, "home_delivery": true, "free_quantity": true, "reward_points": true
        },
        "purchase": {
            "purchase_orders": true, "grn_enabled": true, "landed_cost": true, "freight": true
        },
        "approvals": {
            "new_product": false, "price_change": true, "stock_adjustment": true, "product_deletion": true
        },
        "visibility": {
            "pos_visible": true, "purchase_visible": true, "online_visible": false
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id)
);
CREATE POLICY "Active members can manage workspace settings" ON public.commerce_workspace_settings
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_workspace_settings ENABLE ROW LEVEL SECURITY;

-- 2. Dynamic Product Attribute Definitions
CREATE TABLE IF NOT EXISTS public.commerce_product_attribute_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. Color, Size, RAM, Storage, Gold Purity, OEM Number
    data_type TEXT DEFAULT 'TEXT' CHECK (data_type IN ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN')),
    options JSONB DEFAULT '[]'::jsonb, -- Enum options e.g. ["Red", "Blue", "Black"]
    is_required BOOLEAN DEFAULT false,
    is_searchable BOOLEAN DEFAULT true,
    is_variant_attribute BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);
CREATE POLICY "Active members can manage attribute definitions" ON public.commerce_product_attribute_definitions
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_product_attribute_definitions ENABLE ROW LEVEL SECURITY;

-- 3. Product Variant Matrix Generator Table
CREATE TABLE IF NOT EXISTS public.commerce_product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    variant_sku TEXT NOT NULL,
    variant_barcode TEXT,
    attribute_values JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"Color": "Red", "Size": "XL"}
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    stock_quantity NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_product_id, variant_sku)
);
CREATE POLICY "Active members can manage product variants" ON public.commerce_product_variants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_products
            WHERE commerce_products.id = commerce_product_variants.parent_product_id
            AND public.is_active_workspace_member(commerce_products.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_product_variants ENABLE ROW LEVEL SECURITY;

-- 4. Centralized Master Data Layer Tables
CREATE TABLE IF NOT EXISTS public.master_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);
CREATE POLICY "Active members can manage master_brands" ON public.master_brands
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.master_brands ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.master_cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, code)
);
CREATE POLICY "Active members can manage master_cost_centers" ON public.master_cost_centers
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.master_cost_centers ENABLE ROW LEVEL SECURITY;

-- 5. SaaS Workspace Feature Flags
CREATE TABLE IF NOT EXISTS public.saas_workspace_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    enable_retail BOOLEAN DEFAULT true,
    enable_crm BOOLEAN DEFAULT true,
    enable_hr BOOLEAN DEFAULT true,
    enable_projects BOOLEAN DEFAULT true,
    enable_manufacturing BOOLEAN DEFAULT false,
    enable_wms BOOLEAN DEFAULT false,
    enable_services BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id)
);
CREATE POLICY "Active members can manage feature flags" ON public.saas_workspace_feature_flags
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.saas_workspace_feature_flags ENABLE ROW LEVEL SECURITY;
