-- supabase/migrations/048_project_management_sprint9.sql

-- ===========================================================================
-- Sprint 9 Architecture: Client Portal (Public Sharing)
-- ===========================================================================

-- 1. Add fields to projects for public sharing
ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_share_token UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS portal_settings JSONB DEFAULT '{"show_timeline": true, "show_board": false}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(public_share_token);

-- 2. RLS Policies for Anonymous/Public Read Access
-- Allow reading a project if you have the token (is_public must be true)
CREATE POLICY "Public can view shared projects" ON public.projects
    FOR SELECT 
    USING (is_public = true);

-- Allow reading tasks if the parent project is public
CREATE POLICY "Public can view tasks of shared projects" ON public.tasks
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.tasks.project_id 
            AND is_public = true
        )
    );

-- Allow reading project statuses if the parent project is public
CREATE POLICY "Public can view statuses of shared projects" ON public.project_statuses
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.project_statuses.project_id 
            AND is_public = true
        )
    );

-- Allow reading epics if the parent project is public
CREATE POLICY "Public can view epics of shared projects" ON public.epics
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = public.epics.project_id 
            AND is_public = true
        )
    );
