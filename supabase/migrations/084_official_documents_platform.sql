-- ============================================================
-- Migration 084: Enterprise SaaS Document Platform (Phase 1)
-- ============================================================

-- 1. Master Document Categories (Dynamic)
CREATE TABLE IF NOT EXISTS public.document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    icon TEXT DEFAULT 'FileText',
    color TEXT DEFAULT '#0284c7',
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view document categories" ON public.document_categories;
CREATE POLICY "Active members can view document categories" ON public.document_categories
    FOR SELECT USING (workspace_id IS NULL OR public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can insert custom document categories" ON public.document_categories;
CREATE POLICY "Active members can insert custom document categories" ON public.document_categories
    FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can update custom document categories" ON public.document_categories;
CREATE POLICY "Active members can update custom document categories" ON public.document_categories
    FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id, auth.uid()));

-- 2. Master Document Types
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    default_prefix TEXT DEFAULT 'DOC-',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can manage document types" ON public.document_types;
CREATE POLICY "Active members can manage document types" ON public.document_types
    FOR ALL USING (workspace_id IS NULL OR public.is_active_workspace_member(workspace_id, auth.uid()));

-- 3. Letterhead & Brand Themes Configs
CREATE TABLE IF NOT EXISTS public.company_letterhead_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    logo_url TEXT,
    watermark_logo_url TEXT,
    company_name TEXT,
    tagline TEXT,
    primary_color TEXT DEFAULT '#0284c7',
    secondary_color TEXT DEFAULT '#64748b',
    brand_theme TEXT CHECK (brand_theme IN ('minimal', 'corporate', 'government', 'education', 'medical')) DEFAULT 'corporate',
    paper_size TEXT CHECK (paper_size IN ('A4', 'Letter')) DEFAULT 'A4',
    page_margin TEXT CHECK (page_margin IN ('compact', 'normal', 'wide')) DEFAULT 'normal',
    font_family TEXT DEFAULT 'Inter',
    font_size NUMERIC DEFAULT 12,
    show_page_numbers BOOLEAN DEFAULT true,
    show_watermark BOOLEAN DEFAULT false,
    watermark_opacity NUMERIC DEFAULT 0.05,
    default_signatory_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(workspace_id)
);

ALTER TABLE public.company_letterhead_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view letterhead config" ON public.company_letterhead_configs;
CREATE POLICY "Active members can view letterhead config" ON public.company_letterhead_configs
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage letterhead config" ON public.company_letterhead_configs;
CREATE POLICY "Active members can manage letterhead config" ON public.company_letterhead_configs
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- 4. Corporate Signatories & Stamps
CREATE TABLE IF NOT EXISTS public.company_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT,
    email TEXT,
    priority INTEGER DEFAULT 1,
    signature_url TEXT,
    stamp_url TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.company_signatories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view signatories" ON public.company_signatories;
CREATE POLICY "Active members can view signatories" ON public.company_signatories
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage signatories" ON public.company_signatories;
CREATE POLICY "Active members can manage signatories" ON public.company_signatories
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- 5. Template Studio & Versions
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
    document_type_id UUID REFERENCES public.document_types(id) ON DELETE SET NULL,
    folder_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    body_html TEXT NOT NULL,
    body_json JSONB,
    variables JSONB DEFAULT '[]'::jsonb,
    status TEXT CHECK (status IN ('Active', 'Draft', 'Archived')) DEFAULT 'Active',
    is_default BOOLEAN DEFAULT false,
    current_version INTEGER DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view document templates" ON public.document_templates;
CREATE POLICY "Active members can view document templates" ON public.document_templates
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage document templates" ON public.document_templates;
CREATE POLICY "Active members can manage document templates" ON public.document_templates
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    body_html TEXT NOT NULL,
    body_json JSONB,
    created_by UUID,
    published_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view template versions" ON public.template_versions;
CREATE POLICY "Active members can view template versions" ON public.template_versions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.document_templates t 
        WHERE t.id = template_id AND public.is_active_workspace_member(t.workspace_id, auth.uid())
    ));

-- 6. Generated Official Documents & Immutable Snapshots
CREATE TABLE IF NOT EXISTS public.official_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
    document_type_id UUID REFERENCES public.document_types(id) ON DELETE SET NULL,
    document_number TEXT NOT NULL,
    title TEXT NOT NULL,
    linked_entity_type TEXT CHECK (linked_entity_type IN ('Employee', 'Contact', 'Deal', 'Supplier', 'Invoice', 'Project', 'Custom')) DEFAULT 'Employee',
    linked_entity_id UUID,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    status TEXT CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Issued', 'Cancelled', 'Archived')) DEFAULT 'Draft',
    body_html TEXT NOT NULL,
    body_json JSONB,
    pdf_path TEXT,
    template_snapshot_json JSONB,
    letterhead_snapshot_json JSONB,
    signatory_snapshot_json JSONB,
    issued_by UUID,
    issued_date DATE DEFAULT CURRENT_DATE,
    signatory_id UUID REFERENCES public.company_signatories(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.official_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view official documents" ON public.official_documents;
CREATE POLICY "Active members can view official documents" ON public.official_documents
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage official documents" ON public.official_documents;
CREATE POLICY "Active members can manage official documents" ON public.official_documents
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- 7. Document Audit Log
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.official_documents(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    action TEXT CHECK (action IN ('Created', 'Edited', 'Approved', 'Issued', 'Downloaded', 'Printed', 'Emailed', 'WhatsApp Shared', 'Cancelled', 'Deleted')) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active members can view audit logs" ON public.document_audit_logs;
CREATE POLICY "Active members can view audit logs" ON public.document_audit_logs
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Seed System Default Categories
INSERT INTO public.document_categories (id, name, code, icon, color, sort_order, is_system) VALUES
    ('11111111-1111-1111-1111-111111111111', 'HR & People', 'HR', 'Users', '#0284c7', 1, true),
    ('22222222-2222-2222-2222-222222222222', 'Legal & Compliance', 'LEGAL', 'ShieldCheck', '#7c3aed', 2, true),
    ('33333333-3333-3333-3333-333333333333', 'Finance & Billing', 'FINANCE', 'Landmark', '#059669', 3, true),
    ('44444444-4444-4444-4444-444444444444', 'Sales & Commercials', 'SALES', 'PlugZap', '#ea580c', 4, true),
    ('55555555-5555-5555-5555-555555555555', 'General Admin', 'ADMIN', 'Briefcase', '#475569', 5, true)
ON CONFLICT (id) DO NOTHING;
