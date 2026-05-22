-- supabase/migrations/013_create_workspace_rpc.sql
--
-- Replaces the two-step client-side INSERT (workspaces + workspace_members)
-- with a single SECURITY DEFINER RPC. This solves the RLS bootstrapping
-- problem where the client can't read back the newly created workspace row
-- because the SELECT policy requires membership — which doesn't exist yet.
-- ---------------------------------------------------------------------------

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
BEGIN
    -- Reject empty names at the database level
    IF trim(p_name) = '' THEN
        RAISE EXCEPTION 'Workspace name cannot be empty';
    END IF;

    -- 1. Create the workspace (bypasses RLS — SECURITY DEFINER)
    INSERT INTO public.workspaces (name)
    VALUES (trim(p_name))
    RETURNING public.workspaces.id INTO v_workspace_id;

    -- 2. Add the calling user as owner immediately, in the same transaction
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, auth.uid(), 'owner');

    -- 3. Return the created row — readable because we now have membership
    RETURN QUERY
        SELECT w.id, w.name, w.created_at, w.updated_at
        FROM public.workspaces w
        WHERE w.id = v_workspace_id;
END;
$$;

-- Grant execution to authenticated users only
REVOKE ALL ON FUNCTION public.create_workspace_for_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_for_user(TEXT) TO authenticated;
