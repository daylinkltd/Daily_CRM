-- ── 037_quotation_builder.sql — Add tables for Service Catalog and Quotations
--

-- 1. Add default_quotation_terms column to public.workspaces table
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS default_quotation_terms TEXT NOT NULL DEFAULT '1. CRM access begins with a 2-week free trial before any monthly billing starts.
2. Any custom feature requested beyond core scope will be scoped and quoted separately.
3. Prices are exclusive of applicable taxes.
4. Payment terms: 50% advance to commence work, balance on delivery.';

-- 2. Service Catalog table
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_description TEXT,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_pricing_type TEXT NOT NULL CHECK (default_pricing_type IN ('one_time', 'monthly', 'yearly')),
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workspace service catalog" ON public.service_catalog
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 3. Quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quotation_id TEXT NOT NULL, -- display slug (e.g. QT-2026-001)
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  document_title TEXT NOT NULL DEFAULT 'COMMERCIAL PROPOSAL',
  document_subtitle TEXT,
  date_created DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired')),
  notes_terms TEXT,
  payment_terms TEXT,
  total_one_time NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_recurring NUMERIC(12,2) NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensures unique combination of display ID and version inside a tenant workspace
  CONSTRAINT uk_quotation_version UNIQUE (workspace_id, quotation_id, version)
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workspace quotations" ON public.quotations
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 4. Quotation Sections table
CREATE TABLE IF NOT EXISTS public.quotation_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotation_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workspace quotation sections" ON public.quotation_sections
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 5. Quotation Line Items table
CREATE TABLE IF NOT EXISTS public.quotation_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.quotation_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('one_time', 'monthly', 'yearly')),
  qty INTEGER NOT NULL DEFAULT 1,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  free_condition_note TEXT,
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('catalog', 'custom')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotation_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workspace quotation line items" ON public.quotation_line_items
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 6. Setup auto updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotation_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotation_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
