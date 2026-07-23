-- supabase/migrations/043_project_management_sprint3.sql

-- ===========================================================================
-- Sprint 3 Architecture: Custom Workflows & Statuses
-- ===========================================================================

-- 1. Project Statuses
CREATE TABLE IF NOT EXISTS public.project_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    column_id UUID REFERENCES public.project_columns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TODO', 'IN_PROGRESS', 'DONE')),
    color TEXT DEFAULT 'slate',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);
CREATE POLICY "Active members can manage project_statuses" ON public.project_statuses
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_statuses.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- 2. Project Workflows (Transitions)
CREATE TABLE IF NOT EXISTS public.project_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    from_status_id UUID REFERENCES public.project_statuses(id) ON DELETE CASCADE, -- NULL means creation
    to_status_id UUID NOT NULL REFERENCES public.project_statuses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, from_status_id, to_status_id)
);
CREATE POLICY "Active members can manage project_workflows" ON public.project_workflows
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_workflows.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;

-- 3. Add status_id to tasks BEFORE dropping status text column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.project_statuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);

-- 4. Data Migration Script
-- We use an anonymous code block to execute the migration
DO $$
DECLARE
    v_project RECORD;
    v_todo_id UUID;
    v_in_progress_id UUID;
    v_review_id UUID;
    v_done_id UUID;
BEGIN
    -- Loop through all existing projects
    FOR v_project IN SELECT id FROM public.projects LOOP
        
        -- Create default statuses
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'To Do', 'TODO', 'slate', 1) RETURNING id INTO v_todo_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'In Progress', 'IN_PROGRESS', 'blue', 2) RETURNING id INTO v_in_progress_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'Review', 'IN_PROGRESS', 'orange', 3) RETURNING id INTO v_review_id;
            
        INSERT INTO public.project_statuses (project_id, name, category, color, sort_order)
        VALUES 
            (v_project.id, 'Done', 'DONE', 'emerald', 4) RETURNING id INTO v_done_id;

        -- Create default workflow transitions (Allow all to all for simplicity in default setup)
        -- In a real strict setup, you might only allow specific paths, but we leave it open.
        
        -- Migrate Tasks
        UPDATE public.tasks SET status_id = v_todo_id WHERE project_id = v_project.id AND status = 'todo';
        UPDATE public.tasks SET status_id = v_in_progress_id WHERE project_id = v_project.id AND status = 'in_progress';
        UPDATE public.tasks SET status_id = v_review_id WHERE project_id = v_project.id AND status = 'review';
        UPDATE public.tasks SET status_id = v_done_id WHERE project_id = v_project.id AND status = 'completed';
        
        -- Also handle any 'blocked' tasks or tasks not covered, default to To Do
        UPDATE public.tasks SET status_id = v_todo_id WHERE project_id = v_project.id AND status_id IS NULL;
        
    END LOOP;
END $$;

-- 5. Drop the old status text column
ALTER TABLE public.tasks DROP COLUMN IF EXISTS status;
