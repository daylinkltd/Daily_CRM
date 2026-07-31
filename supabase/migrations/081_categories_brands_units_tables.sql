-- Migration 081: Categories, Brands, and Units Tables for Commerce Module

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_workspace_unit_code UNIQUE (workspace_id, code)
);

-- RLS Policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view categories" ON public.categories
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage categories" ON public.categories
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view brands" ON public.brands
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage brands" ON public.brands
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view units" ON public.units
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage units" ON public.units
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
