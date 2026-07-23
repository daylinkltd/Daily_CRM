-- supabase/migrations/050_hr_policies_and_agreements.sql

-- ===========================================================================
-- HR Policies, Terms & Conditions, and Legal Compliance Engine Schema
-- ===========================================================================

-- 1. Core HR Policies Header
CREATE TABLE IF NOT EXISTS public.hr_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'CODE_OF_CONDUCT', 'LEAVE', 'REMOTE_WORK', 'CONFIDENTIALITY', 
        'IT_SECURITY', 'POSH', 'TRAVEL', 'ATTENDANCE', 'TERMS_AND_CONDITIONS', 'CUSTOM'
    )),
    
    owner_workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    linked_module TEXT CHECK (linked_module IN ('ATTENDANCE', 'LEAVE', 'PAYROLL', 'EXPENSES', 'NONE')),
    linked_entity_id TEXT,
    
    review_frequency_months INTEGER DEFAULT 12,
    next_review_date DATE,
    
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_policies_workspace ON public.hr_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_policies_category ON public.hr_policies(category);

-- 2. Immutable Policy Versions
CREATE TABLE IF NOT EXISTS public.hr_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    change_summary TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    mandatory BOOLEAN DEFAULT false,
    language TEXT DEFAULT 'en',
    content_hash VARCHAR(64), -- SHA-256 Hash of exact content
    
    published_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approval_comments TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(policy_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_versions_policy ON public.hr_policy_versions(policy_id);

-- 3. Normalized Target Audience
CREATE TABLE IF NOT EXISTS public.hr_policy_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    
    target_type TEXT NOT NULL CHECK (target_type IN ('DEPARTMENT', 'DESIGNATION', 'EMPLOYMENT_TYPE', 'ROLE')),
    target_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_targets_lookup ON public.hr_policy_targets(policy_id, target_type, target_id);

-- 4. Employee Policy Acknowledgements (Legal Evidence)
CREATE TABLE IF NOT EXISTS public.hr_policy_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.hr_policy_versions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 Hash at time of signing
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'REVOKED')),
    revocation_reason TEXT,
    
    signature_type TEXT DEFAULT 'TYPED_NAME' CHECK (signature_type IN ('TYPED_NAME', 'DRAWN_SIGNATURE')),
    signature_value TEXT NOT NULL,
    read_time_seconds INTEGER DEFAULT 0,
    read_till_bottom BOOLEAN DEFAULT true,
    
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    
    UNIQUE(version_id, workspace_member_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_acknowledgements_member ON public.hr_policy_acknowledgements(workspace_member_id);
CREATE INDEX IF NOT EXISTS idx_hr_policy_acknowledgements_policy ON public.hr_policy_acknowledgements(policy_id);

-- 5. Audit Notification Log
CREATE TABLE IF NOT EXISTS public.hr_policy_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.hr_policy_versions(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'OPENED'))
);

-- RLS Policies
ALTER TABLE public.hr_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view hr_policies" ON public.hr_policies
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policies" ON public.hr_policies
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_versions" ON public.hr_policy_versions
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policy_versions" ON public.hr_policy_versions
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_targets" ON public.hr_policy_targets
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage hr_policy_targets" ON public.hr_policy_targets
    FOR ALL USING (
        public.is_active_workspace_member(workspace_id, auth.uid()) AND
        public.has_workspace_permission(workspace_id, auth.uid(), 'people_manage'::text)
    );

CREATE POLICY "Active members can view hr_policy_acknowledgements" ON public.hr_policy_acknowledgements
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can insert own hr_policy_acknowledgements" ON public.hr_policy_acknowledgements
    FOR INSERT WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Active members can view hr_policy_notifications" ON public.hr_policy_notifications
    FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
