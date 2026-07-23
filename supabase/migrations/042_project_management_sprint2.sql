-- supabase/migrations/042_project_management_sprint2.sql

-- ===========================================================================
-- Sprint 2 Architecture: Methodologies, Planning, Organization, and Audit
-- ===========================================================================

-- 1. Project Methodologies
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'BASIC' CHECK (project_type IN ('SCRUM', 'KANBAN', 'BASIC'));

-- 2. Sprints & Epics
CREATE TABLE IF NOT EXISTS public.sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage sprints" ON public.sprints
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = sprints.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE POLICY "Active members can manage epics" ON public.epics
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = epics.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;

-- 3. Labels & Components
CREATE TABLE IF NOT EXISTS public.workspace_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'slate',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);
CREATE POLICY "Active members can manage workspace_labels" ON public.workspace_labels
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.workspace_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.project_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);
CREATE POLICY "Active members can manage project_components" ON public.project_components
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_components.project_id
        AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    ));
ALTER TABLE public.project_components ENABLE ROW LEVEL SECURITY;

-- 4. Update Tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON public.tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_epic ON public.tasks(epic_id);

-- 5. Join Tables (Many to Many)
CREATE TABLE IF NOT EXISTS public.task_labels (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.workspace_labels(id) ON DELETE CASCADE,
    PRIMARY KEY(task_id, label_id)
);
CREATE POLICY "Active members can manage task_labels" ON public.task_labels
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_labels.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.task_components (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.project_components(id) ON DELETE CASCADE,
    PRIMARY KEY(task_id, component_id)
);
CREATE POLICY "Active members can manage task_components" ON public.task_components
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_components.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_components ENABLE ROW LEVEL SECURITY;

-- 6. Watchers
CREATE TABLE IF NOT EXISTS public.task_watchers (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(task_id, workspace_member_id)
);
CREATE POLICY "Active members can manage task_watchers" ON public.task_watchers
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_watchers.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

-- 7. Task Activity (Audit Log)
CREATE TABLE IF NOT EXISTS public.task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workspace_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL, -- Who did it
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity(task_id);
CREATE POLICY "Active members can read task_activity" ON public.task_activity
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = task_activity.task_id
        AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    ));
-- Allow service role or trigger to insert
CREATE POLICY "Allow trigger to insert task_activity" ON public.task_activity
    FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- 8. Activity Trigger
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
BEGIN
    -- Attempt to get the workspace_member_id of the person making the change.
    -- This relies on the client passing the member ID via a custom header or query if possible,
    -- but usually Supabase triggers run as postgres. We can extract user_id from auth.uid()
    -- and find their workspace_member_id for this task's workspace.
    IF auth.uid() IS NOT NULL THEN
        SELECT id INTO v_member_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND workspace_id = NEW.workspace_id
        LIMIT 1;
    END IF;

    -- Track Status Change
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'STATUS_CHANGED', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;

    -- Track Priority Change
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'PRIORITY_CHANGED', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
    END IF;

    -- Track Assignee Change
    IF (TG_OP = 'UPDATE' AND OLD.assigned_workspace_member_id IS DISTINCT FROM NEW.assigned_workspace_member_id) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'ASSIGNEE_CHANGED', jsonb_build_object('old', OLD.assigned_workspace_member_id, 'new', NEW.assigned_workspace_member_id));
    END IF;
    
    -- Track Column Change
    IF (TG_OP = 'UPDATE' AND OLD.column_id IS DISTINCT FROM NEW.column_id) THEN
        INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
        VALUES (NEW.id, v_member_id, 'COLUMN_CHANGED', jsonb_build_object('old', OLD.column_id, 'new', NEW.column_id));
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_activity_trigger ON public.tasks;
CREATE TRIGGER task_activity_trigger
    AFTER UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_activity();
