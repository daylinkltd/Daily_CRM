-- supabase/migrations/010_workspace_schema.sql

-- Helper function to get or create a default workspace for a user
CREATE OR REPLACE FUNCTION public.get_or_create_user_workspace(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_workspace_id UUID;
    v_email TEXT;
BEGIN
    -- Check if user already has a workspace
    SELECT workspace_id INTO v_workspace_id
    FROM public.workspace_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_workspace_id IS NOT NULL THEN
        RETURN v_workspace_id;
    END IF;

    -- Get user email from profiles or fallback
    SELECT email INTO v_email FROM public.profiles WHERE user_id = p_user_id;
    IF v_email IS NULL THEN
        SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    END IF;
    IF v_email IS NULL THEN
        v_email := 'Unknown User';
    END IF;

    -- Create new workspace
    INSERT INTO public.workspaces (name)
    VALUES (v_email || '''s Workspace')
    RETURNING id INTO v_workspace_id;

    -- Add user as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'owner');

    RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. Add workspace_id column to tables
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.custom_fields ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;


-- 2. Backfill existing records with default workspace IDs based on creator user_id
UPDATE public.contacts SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.tags SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.custom_fields SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.conversations SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.whatsapp_config SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.message_templates SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.pipelines SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.deals SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.broadcasts SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;
UPDATE public.automations SET workspace_id = public.get_or_create_user_workspace(user_id) WHERE workspace_id IS NULL;


-- 3. Make workspace_id NOT NULL on primary tables
ALTER TABLE public.contacts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tags ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.custom_fields ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.whatsapp_config ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.message_templates ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.pipelines ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.broadcasts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.automations ALTER COLUMN workspace_id SET NOT NULL;


-- 4. Update row-level security (RLS) policies

-- Helper function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Contacts RLS
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
CREATE POLICY "Users can manage workspace contacts" ON public.contacts
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Tags RLS
DROP POLICY IF EXISTS "Users can manage own tags" ON public.tags;
CREATE POLICY "Users can manage workspace tags" ON public.tags
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Custom Fields RLS
DROP POLICY IF EXISTS "Users can manage own custom fields" ON public.custom_fields;
CREATE POLICY "Users can manage workspace custom fields" ON public.custom_fields
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Conversations RLS
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
CREATE POLICY "Users can manage workspace conversations" ON public.conversations
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Whatsapp Config RLS
DROP POLICY IF EXISTS "Users can manage own config" ON public.whatsapp_config;
CREATE POLICY "Users can manage workspace config" ON public.whatsapp_config
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Message Templates RLS
DROP POLICY IF EXISTS "Users can manage own templates" ON public.message_templates;
CREATE POLICY "Users can manage workspace templates" ON public.message_templates
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Pipelines RLS
DROP POLICY IF EXISTS "Users can manage own pipelines" ON public.pipelines;
CREATE POLICY "Users can manage workspace pipelines" ON public.pipelines
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Pipeline Stages RLS
DROP POLICY IF EXISTS "Users can manage stages of own pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can manage workspace pipeline stages" ON public.pipeline_stages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND public.is_workspace_member(pipelines.workspace_id, auth.uid())
        )
    );

-- Deals RLS
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
CREATE POLICY "Users can manage workspace deals" ON public.deals
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Broadcasts RLS
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON public.broadcasts;
CREATE POLICY "Users can manage workspace broadcasts" ON public.broadcasts
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Automations RLS
DROP POLICY IF EXISTS "Users can manage own automations" ON public.automations;
CREATE POLICY "Users can manage workspace automations" ON public.automations
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Automation Steps RLS
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON public.automation_steps;
CREATE POLICY "Users can manage workspace automation steps" ON public.automation_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automations
            WHERE automations.id = automation_steps.automation_id
            AND public.is_workspace_member(automations.workspace_id, auth.uid())
        )
    );

-- Automation Logs RLS
DROP POLICY IF EXISTS "Users can view own automation logs" ON public.automation_logs;
CREATE POLICY "Users can view workspace automation logs" ON public.automation_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automations
            WHERE automations.id = automation_logs.automation_id
            AND public.is_workspace_member(automations.workspace_id, auth.uid())
        )
    );

-- Fix recursive RLS policy on workspace_members by replacing it with a clean one using public.is_workspace_member
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
CREATE POLICY "Users can view members of their workspaces" ON public.workspace_members
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

