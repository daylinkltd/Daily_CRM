-- supabase/migrations/060_enterprise_promotions_engine.sql
-- ===========================================================================
-- Enterprise Retail ERP: Decoupled Promotions Engine, Coupon Codes, Target Scopes, 10 Offer Types & Customer Credit Risk
-- ===========================================================================

-- 1. Master Promotion Campaigns Header
CREATE TABLE IF NOT EXISTS public.commerce_promotion_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'Diwali Sale 2026', 'Happy Hours', 'VIP Customer Discount'
    code TEXT, -- e.g. 'DIWALI100', 'WELCOME10'
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    priority INT DEFAULT 10, -- Priority Precedence 1-100 (Product > Customer Group > Brand > Category > Price List > Global)
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED')),
    is_stackable BOOLEAN DEFAULT false,
    coupon_required BOOLEAN DEFAULT false,
    min_bill_amount NUMERIC DEFAULT 0,
    max_discount_amount NUMERIC DEFAULT 0,
    usage_limit_total INT DEFAULT 0, -- 0 = unlimited
    usage_limit_per_customer INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage promotion campaigns" ON public.commerce_promotion_campaigns
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_promotion_campaigns ENABLE ROW LEVEL SECURITY;

-- 2. Promotion Targeting Scopes
CREATE TABLE IF NOT EXISTS public.commerce_promotion_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.commerce_promotion_campaigns(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN (
        'PRODUCT', 'CATEGORY', 'BRAND', 'SUPPLIER', 'WAREHOUSE', 
        'BRANCH', 'CUSTOMER_GROUP', 'PRICE_LIST', 'PAYMENT_METHOD'
    )),
    target_id UUID NOT NULL, -- Reference ID of product, category, brand, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage promotion targets" ON public.commerce_promotion_targets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_promotion_campaigns
            WHERE commerce_promotion_campaigns.id = commerce_promotion_targets.campaign_id
            AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_promotion_targets ENABLE ROW LEVEL SECURITY;

-- 3. Promotion Benefit Rules (10 Offer Types)
CREATE TABLE IF NOT EXISTS public.commerce_promotion_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.commerce_promotion_campaigns(id) ON DELETE CASCADE,
    offer_type TEXT NOT NULL CHECK (offer_type IN (
        'PERCENTAGE_DISCOUNT', 'FLAT_AMOUNT_DISCOUNT', 'BUY_X_GET_Y', 
        'FIXED_SELLING_PRICE', 'COMBO_PACKAGE', 'BUNDLE_DISCOUNT', 
        'QUANTITY_SLAB', 'BILL_SLAB', 'HAPPY_HOURS', 'WEEKEND_FESTIVAL'
    )),
    discount_percent NUMERIC DEFAULT 0,
    flat_discount_amount NUMERIC DEFAULT 0,
    fixed_price NUMERIC DEFAULT 0,
    buy_quantity NUMERIC DEFAULT 0,
    get_quantity NUMERIC DEFAULT 0,
    get_product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
    min_slab_quantity NUMERIC DEFAULT 0,
    min_slab_amount NUMERIC DEFAULT 0,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage promotion benefits" ON public.commerce_promotion_benefits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_promotion_campaigns
            WHERE commerce_promotion_campaigns.id = commerce_promotion_benefits.campaign_id
            AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_promotion_benefits ENABLE ROW LEVEL SECURITY;

-- 4. Promotion Redemptions Audit Log
CREATE TABLE IF NOT EXISTS public.commerce_promotion_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.commerce_promotion_campaigns(id) ON DELETE CASCADE,
    sales_order_id UUID REFERENCES public.commerce_sales_orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    discount_applied_amount NUMERIC NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage promotion usage" ON public.commerce_promotion_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.commerce_promotion_campaigns
            WHERE commerce_promotion_campaigns.id = commerce_promotion_usage.campaign_id
            AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
        )
    );
ALTER TABLE public.commerce_promotion_usage ENABLE ROW LEVEL SECURITY;

-- 5. Customer Credit Risk & Automated Blocking Table
CREATE TABLE IF NOT EXISTS public.commerce_customer_credit_risk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    credit_rating TEXT DEFAULT 'A' CHECK (credit_rating IN ('A+', 'A', 'B', 'C', 'BLOCKED')),
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    outstanding_amount NUMERIC DEFAULT 0,
    overdue_amount NUMERIC DEFAULT 0,
    last_payment_date DATE,
    average_payment_delay_days INT DEFAULT 0,
    is_credit_blocked BOOLEAN DEFAULT false,
    blocking_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, contact_id)
);
CREATE POLICY "Active members can manage credit risk" ON public.commerce_customer_credit_risk
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.commerce_customer_credit_risk ENABLE ROW LEVEL SECURITY;
