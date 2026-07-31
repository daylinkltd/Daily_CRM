-- supabase/migrations/080_fix_task_activity_trigger.sql

-- Fix log_task_activity() function to safely inspect JSON representation of OLD/NEW records
-- avoiding Postgres error 42703 (record "old" has no field "status") when status column is not present on tasks.

CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_member_id UUID;
    v_old_json JSONB;
    v_new_json JSONB;
    v_old_val TEXT;
    v_new_val TEXT;
BEGIN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    IF auth.uid() IS NOT NULL THEN
        SELECT id INTO v_member_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND workspace_id = NEW.workspace_id
        LIMIT 1;
    END IF;

    -- Track Status / Status_ID Change
    IF v_old_json ? 'status_id' THEN
        v_old_val := v_old_json->>'status_id';
        v_new_val := v_new_json->>'status_id';
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
            VALUES (NEW.id, v_member_id, 'STATUS_CHANGED', jsonb_build_object('old', v_old_val, 'new', v_new_val));
        END IF;
    ELSIF v_old_json ? 'status' THEN
        v_old_val := v_old_json->>'status';
        v_new_val := v_new_json->>'status';
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
            VALUES (NEW.id, v_member_id, 'STATUS_CHANGED', jsonb_build_object('old', v_old_val, 'new', v_new_val));
        END IF;
    END IF;

    -- Track Priority Change
    IF v_old_json ? 'priority' THEN
        v_old_val := v_old_json->>'priority';
        v_new_val := v_new_json->>'priority';
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
            VALUES (NEW.id, v_member_id, 'PRIORITY_CHANGED', jsonb_build_object('old', v_old_val, 'new', v_new_val));
        END IF;
    END IF;

    -- Track Assignee Change
    IF v_old_json ? 'assigned_workspace_member_id' THEN
        v_old_val := v_old_json->>'assigned_workspace_member_id';
        v_new_val := v_new_json->>'assigned_workspace_member_id';
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
            VALUES (NEW.id, v_member_id, 'ASSIGNEE_CHANGED', jsonb_build_object('old', v_old_val, 'new', v_new_val));
        END IF;
    END IF;

    -- Track Column Change
    IF v_old_json ? 'column_id' THEN
        v_old_val := v_old_json->>'column_id';
        v_new_val := v_new_json->>'column_id';
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.task_activity (task_id, workspace_member_id, action, details)
            VALUES (NEW.id, v_member_id, 'COLUMN_CHANGED', jsonb_build_object('old', v_old_val, 'new', v_new_val));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
