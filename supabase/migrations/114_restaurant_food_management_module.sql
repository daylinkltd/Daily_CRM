-- ============================================================
-- 114_restaurant_food_management_module.sql
-- Restaurant & Food Management Module extending commerce_products
-- Features: Food Items, Relational Variants, Modifiers with Inventory Linkage,
--           Recipe BOM, Multi-Branch Menu Configuration & Overrides.
-- ============================================================

BEGIN;

-- 1. Master Food Extension Table
CREATE TABLE IF NOT EXISTS public.restaurant_food_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE UNIQUE,
    dietary_type TEXT CHECK (dietary_type IN ('VEG', 'NON_VEG', 'EGG', 'VEGAN')) DEFAULT 'VEG',
    kitchen_station TEXT DEFAULT 'MAIN_KITCHEN', -- MAIN_KITCHEN, TANDOOR, PANTRY, CHINESE, BAKERY
    prep_time_minutes INTEGER DEFAULT 15,
    spiciness_level INTEGER DEFAULT 1, -- 0: Mild, 1: Medium, 2: Spicy, 3: Extra Hot
    allergens TEXT[] DEFAULT '{}', -- Dairy, Nuts, Gluten, Soy, Shellfish
    photo_url TEXT,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_restaurant_food_items_workspace ON public.restaurant_food_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_food_items_product ON public.restaurant_food_items(product_id);

-- 2. Normalized Food Portion Variants
CREATE TABLE IF NOT EXISTS public.food_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_item_id UUID NOT NULL REFERENCES public.restaurant_food_items(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL, -- e.g. "Half Plate", "Full Plate", "Small 8-inch", "Large 12-inch"
    price_offset NUMERIC NOT NULL DEFAULT 0, -- Price override or delta from base selling_price
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_variants_item ON public.food_variants(food_item_id);

-- 3. Normalized Modifiers & Add-ons
CREATE TABLE IF NOT EXISTS public.food_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_item_id UUID NOT NULL REFERENCES public.restaurant_food_items(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL, -- e.g. "Choice of Crust", "Extra Toppings", "Spice Level"
    min_selection INTEGER DEFAULT 0,
    max_selection INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_modifier_groups_item ON public.food_modifier_groups(food_item_id);

CREATE TABLE IF NOT EXISTS public.food_modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.food_modifier_groups(id) ON DELETE CASCADE,
    option_name TEXT NOT NULL, -- e.g. "Extra Cheese", "Extra Patty", "No Onions"
    price NUMERIC NOT NULL DEFAULT 0,
    ingredient_product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL, -- Optional ingredient consumed
    ingredient_quantity NUMERIC DEFAULT 0, -- e.g. 50g Cheese consumed
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_modifier_options_group ON public.food_modifier_options(group_id);

-- 4. Recipe Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS public.restaurant_recipe_bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    food_item_id UUID NOT NULL REFERENCES public.restaurant_food_items(id) ON DELETE CASCADE,
    ingredient_product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
    quantity_required NUMERIC NOT NULL, -- e.g. 200 (Grams/Ml/Units)
    unit_of_measure TEXT DEFAULT 'GRAMS',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_recipe_bom_item_ingredient UNIQUE(food_item_id, ingredient_product_id)
);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipe_bom_workspace ON public.restaurant_recipe_bom(workspace_id);

-- 5. Multi-Branch Menu Configuration & Overrides
CREATE TABLE IF NOT EXISTS public.restaurant_branch_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.bar_branches(id) ON DELETE CASCADE,
    food_item_id UUID NOT NULL REFERENCES public.restaurant_food_items(id) ON DELETE CASCADE,
    selling_price NUMERIC NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    display_online BOOLEAN DEFAULT TRUE,
    availability_schedule JSONB DEFAULT '{"breakfast": true, "lunch": true, "dinner": true}'::jsonb,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_branch_food_item UNIQUE(branch_id, food_item_id)
);
CREATE INDEX IF NOT EXISTS idx_restaurant_branch_menu_branch ON public.restaurant_branch_menu(branch_id);

-- Row Level Security (RLS)
ALTER TABLE public.restaurant_food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_recipe_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branch_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active workspace members can manage restaurant_food_items" ON public.restaurant_food_items FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage food_variants" ON public.food_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurant_food_items f WHERE f.id = food_item_id AND public.is_active_workspace_member(f.workspace_id, auth.uid())));
CREATE POLICY "Active workspace members can manage food_modifier_groups" ON public.food_modifier_groups FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurant_food_items f WHERE f.id = food_item_id AND public.is_active_workspace_member(f.workspace_id, auth.uid())));
CREATE POLICY "Active workspace members can manage food_modifier_options" ON public.food_modifier_options FOR ALL USING (EXISTS (SELECT 1 FROM public.food_modifier_groups g JOIN public.restaurant_food_items f ON f.id = g.food_item_id WHERE g.id = group_id AND public.is_active_workspace_member(f.workspace_id, auth.uid())));
CREATE POLICY "Active workspace members can manage restaurant_recipe_bom" ON public.restaurant_recipe_bom FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Active workspace members can manage restaurant_branch_menu" ON public.restaurant_branch_menu FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

COMMIT;
