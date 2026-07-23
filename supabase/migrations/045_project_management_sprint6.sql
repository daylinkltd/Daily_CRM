-- supabase/migrations/045_project_management_sprint6.sql

-- ===========================================================================
-- Sprint 6 Architecture: Automations & Rules Engine
-- ===========================================================================

-- 1. Automations Table
CREATE TABLE IF NOT EXISTS public.project_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Trigger
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('STATUS_CHANGED')),
    trigger_condition JSONB NOT NULL, -- e.g., {"status_id": "uuid"}
    
    -- Action
    action_type TEXT NOT NULL CHECK (action_type IN ('ASSIGN_MEMBER', 'SET_PRIORITY')),
    action_payload JSONB NOT NULL, -- e.g., {"member_id": "uuid"} or {"priority": "high"}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL
);

CREATE INDEX idx_project_automations_project ON public.project_automations(project_id);

-- RLS
CREATE POLICY "Active members can manage project_automations" ON public.project_automations
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));
ALTER TABLE public.project_automations ENABLE ROW LEVEL SECURITY;


-- 2. Rules Engine Function
CREATE OR REPLACE FUNCTION public.evaluate_project_automations()
RETURNS TRIGGER AS $$
DECLARE
    rule RECORD;
BEGIN
    -- Evaluate rules only if this is an update and the status has changed
    IF TG_OP = 'UPDATE' AND OLD.status_id IS DISTINCT FROM NEW.status_id AND NEW.status_id IS NOT NULL THEN
        
        -- Loop through all active STATUS_CHANGED rules for this project that match the NEW status
        FOR rule IN 
            SELECT * FROM public.project_automations 
            WHERE project_id = NEW.project_id 
            AND is_active = true 
            AND trigger_type = 'STATUS_CHANGED'
            AND (trigger_condition->>'status_id')::TEXT = NEW.status_id::TEXT
        LOOP
            
            -- Action: Assign Member
            IF rule.action_type = 'ASSIGN_MEMBER' THEN
                -- payload: {"member_id": "uuid" or "none"}
                IF (rule.action_payload->>'member_id') = 'none' THEN
                    NEW.assigned_workspace_member_id = NULL;
                ELSE
                    NEW.assigned_workspace_member_id = (rule.action_payload->>'member_id')::UUID;
                END IF;
            END IF;
            
            -- Action: Set Priority
            IF rule.action_type = 'SET_PRIORITY' THEN
                -- payload: {"priority": "high"}
                NEW.priority = (rule.action_payload->>'priority')::TEXT;
            END IF;
            
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to Tasks
DROP TRIGGER IF EXISTS trigger_evaluate_automations ON public.tasks;
CREATE TRIGGER trigger_evaluate_automations
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.evaluate_project_automations();
