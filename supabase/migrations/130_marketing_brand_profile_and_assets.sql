-- ============================================================
-- 130 — Marketing Brand Profiles & Brand Asset Library Schema
--
-- Adds multi-tenant tables for:
-- 1. `marketing_brand_profiles` (Company details, voice, colors, target audience)
-- 2. `marketing_brand_assets` (Logos, Product Images, UI Screenshots, Team Photos, Backgrounds)
--
-- Strict Row-Level Security (RLS) is applied so Tenant A can never access Tenant B assets.
-- ============================================================

-- 1. Marketing Brand Profiles
CREATE TABLE IF NOT EXISTS public.marketing_brand_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  company_name          TEXT NOT NULL,
  website               TEXT,
  business_description  TEXT,
  industry              TEXT,
  target_audience       TEXT,
  brand_voice           TEXT,
  brand_personality     TEXT,
  primary_color         TEXT,
  secondary_color       TEXT,
  brand_guidelines      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_profiles_workspace
  ON public.marketing_brand_profiles (workspace_id);

ALTER TABLE public.marketing_brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_brand_profiles_select ON public.marketing_brand_profiles;
CREATE POLICY marketing_brand_profiles_select ON public.marketing_brand_profiles
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_brand_profiles_modify ON public.marketing_brand_profiles;
CREATE POLICY marketing_brand_profiles_modify ON public.marketing_brand_profiles
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_marketing_brand_profiles_updated_at ON public.marketing_brand_profiles;
CREATE TRIGGER set_marketing_brand_profiles_updated_at
  BEFORE UPDATE ON public.marketing_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Marketing Brand Asset Library
CREATE TABLE IF NOT EXISTS public.marketing_brand_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('LOGOS', 'PRODUCTS', 'UI_DIGITAL', 'PEOPLE', 'OTHER')),
  sub_category      TEXT,
  description       TEXT,
  storage_path      TEXT NOT NULL,
  public_url        TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  file_size_bytes   BIGINT,
  dimensions        TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_assets_workspace
  ON public.marketing_brand_assets (workspace_id);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_assets_category
  ON public.marketing_brand_assets (workspace_id, category);

ALTER TABLE public.marketing_brand_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_brand_assets_select ON public.marketing_brand_assets;
CREATE POLICY marketing_brand_assets_select ON public.marketing_brand_assets
  FOR SELECT
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS marketing_brand_assets_modify ON public.marketing_brand_assets;
CREATE POLICY marketing_brand_assets_modify ON public.marketing_brand_assets
  FOR ALL
  USING (public.is_active_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS set_marketing_brand_assets_updated_at ON public.marketing_brand_assets;
CREATE TRIGGER set_marketing_brand_assets_updated_at
  BEFORE UPDATE ON public.marketing_brand_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Verify
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('marketing_brand_profiles', 'marketing_brand_assets')
-- ORDER BY table_name, ordinal_position;
