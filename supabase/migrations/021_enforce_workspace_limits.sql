-- ── 021: Enforce Workspace Limits ───────────────────────────────
-- Updates create_workspace_for_user to enforce max_workspaces limits
-- and copy the plan to the new workspace.

CREATE OR REPLACE FUNCTION public.create_workspace_for_user(p_name TEXT)
RETURNS TABLE (
    id          UUID,
    name        TEXT,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
    v_primary_ws   RECORD;
    v_ws_count     INT;
    v_max_ws       INT;
BEGIN
    -- Reject empty names at the database level
    IF trim(p_name) = '' THEN
        RAISE EXCEPTION 'Workspace name cannot be empty';
    END IF;

    -- 1. Get the user's primary workspace (oldest one they own) to read limits
    SELECT w.plan, w.plan_limits
    INTO v_primary_ws
    FROM public.workspaces w
    JOIN public.workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
    ORDER BY w.created_at ASC
    LIMIT 1;

    -- 2. If they have a primary workspace, check limits
    IF FOUND THEN
        -- Check max_workspaces from plan_limits JSONB
        v_max_ws := (v_primary_ws.plan_limits->>'max_workspaces')::int;
        
        IF v_max_ws IS NOT NULL THEN
            -- Count how many workspaces they already own
            SELECT COUNT(*) INTO v_ws_count
            FROM public.workspace_members
            WHERE user_id = auth.uid() AND role = 'owner';

            IF v_ws_count >= v_max_ws THEN
                RAISE EXCEPTION 'You have reached the maximum number of workspaces allowed on your % plan (Max: %)', UPPER(v_primary_ws.plan), v_max_ws;
            END IF;
        END IF;

        -- 3. Create the new workspace, copying the plan and limits
        INSERT INTO public.workspaces (name, plan, plan_limits)
        VALUES (trim(p_name), v_primary_ws.plan, v_primary_ws.plan_limits)
        RETURNING public.workspaces.id INTO v_workspace_id;
    ELSE
        -- Fallback if they don't own any workspaces yet
        -- (This shouldn't happen because create_owner_with_workspace makes the first one)
        INSERT INTO public.workspaces (name)
        VALUES (trim(p_name))
        RETURNING public.workspaces.id INTO v_workspace_id;
    END IF;

    -- 4. Add the calling user as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, auth.uid(), 'owner');

    -- 5. Seed system roles for the new workspace
    INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
    VALUES (v_workspace_id, 'Admin', 'Can manage team, settings, and all CRM features', true, '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
      "automations": true, "integrations": true, "settings_profile": true,
      "settings_workspace": true, "settings_templates": true, "settings_tags": true,
      "reports": true
    }'::jsonb);

    INSERT INTO public.workspace_roles (workspace_id, name, description, is_system, permissions)
    VALUES (v_workspace_id, 'Agent', 'Can view inbox and manage contacts', true, '{
      "inbox": true, "contacts": true, "pipelines": true, "broadcasts": false,
      "automations": false, "integrations": false, "settings_profile": true,
      "settings_workspace": false, "settings_templates": false, "settings_tags": false,
      "reports": false
    }'::jsonb);

    -- 6. Return the created row
    RETURN QUERY
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM public.workspaces w
        WHERE w.id = v_workspace_id;
END;
$$;

-- Grant execution to authenticated users only
REVOKE ALL ON FUNCTION public.create_workspace_for_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_for_user(TEXT) TO authenticated;
