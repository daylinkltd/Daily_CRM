-- ============================================================
-- 092 — Bridge the two permission namespaces.
--
-- The app has a CRUD matrix (`employees:update`, 136 keys generated
-- from resources.ts) but the HR feature policies still ask for the older
-- coarse keys: people_manage, people_view, attendance_manage,
-- leave_approve. The roles seeded by 074 contain ONLY the CRUD keys.
--
-- Verified against production before writing this: all 12 workspace_roles
-- rows carry 136 CRUD keys and ZERO legacy keys.
--
-- Owners and admins short-circuit to TRUE inside has_workspace_permission,
-- so the split is invisible to them — which is why it went unnoticed. For
-- every other role the legacy keys resolve FALSE and cannot be enabled by
-- any configuration, so HR work cannot be delegated to a custom role at
-- all: the RLS policies in 050, 051, 052, 086, 089 and 090 all deny.
--
-- Rather than rewrite every policy (dozens, each a chance to widen access
-- by mistake), the legacy keys are DERIVED here from the CRUD keys that
-- already exist. Mirrors src/lib/auth/legacy-permissions.ts exactly, so
-- the UI and the database agree on who can do what.
--
-- Idempotent; safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_workspace_permission(
    p_workspace_id UUID,
    p_user_id UUID,
    p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permissions JSONB;
    v_sources     TEXT[];
    v_key         TEXT;
BEGIN
    -- Owners and admins keep full access, unchanged.
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND role IN ('owner', 'admin')
    ) THEN
        RETURN TRUE;
    END IF;

    SELECT wr.permissions INTO v_permissions
    FROM public.workspace_members wm
    JOIN public.workspace_roles wr ON wm.role_id = wr.id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_user_id;

    IF v_permissions IS NULL THEN
        RETURN FALSE;
    END IF;

    -- An explicit grant always wins, so a pre-CRUD workspace that still
    -- stores people_manage = true keeps working untouched.
    IF (v_permissions->>p_permission)::boolean IS TRUE THEN
        RETURN TRUE;
    END IF;

    -- Otherwise derive the coarse key from its CRUD equivalents. Any one
    -- of them suffices. Read alone never grants a "manage" key.
    v_sources := CASE p_permission
        WHEN 'people_manage'     THEN ARRAY['employees:update', 'employees:create', 'employees:delete']
        WHEN 'people_view'       THEN ARRAY['employees:read']
        WHEN 'attendance_manage' THEN ARRAY['attendance:update', 'attendance:delete']
        WHEN 'leave_approve'     THEN ARRAY['leave:update']
        ELSE NULL
    END;

    IF v_sources IS NULL THEN
        RETURN FALSE;
    END IF;

    FOREACH v_key IN ARRAY v_sources LOOP
        IF (v_permissions->>v_key)::boolean IS TRUE THEN
            RETURN TRUE;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_workspace_permission(UUID, UUID, TEXT)
    TO authenticated, service_role;

-- ------------------------------------------------------------
-- get_user_permissions feeds the UI. Same derivation, so a screen is
-- never shown a control the database will then refuse.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role    TEXT;
    v_role_id UUID;
    v_perms   JSONB;
BEGIN
    SELECT role, role_id INTO v_role, v_role_id
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    IF v_role IN ('owner', 'admin') THEN
        RETURN '{
          "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
          "automations": true, "integrations": true, "settings_profile": true,
          "settings_workspace": true, "settings_templates": true, "settings_tags": true,
          "reports": true, "manage_users": true, "manage_roles": true, "manage_workspaces": true,
          "people_view": true, "people_manage": true, "attendance_manage": true, "leave_approve": true,
          "projects_view": true, "projects_manage": true
        }'::jsonb;
    END IF;

    IF v_role_id IS NOT NULL THEN
        SELECT permissions INTO v_perms
        FROM public.workspace_roles
        WHERE id = v_role_id AND workspace_id = p_workspace_id;

        IF v_perms IS NOT NULL THEN
            -- Same rule as has_workspace_permission above: an explicit
            -- grant wins, otherwise derive from the CRUD keys.
            v_perms := v_perms || jsonb_build_object(
                'people_manage',
                    COALESCE((v_perms->>'people_manage')::boolean, false)
                    OR COALESCE((v_perms->>'employees:update')::boolean, false)
                    OR COALESCE((v_perms->>'employees:create')::boolean, false)
                    OR COALESCE((v_perms->>'employees:delete')::boolean, false),
                'people_view',
                    COALESCE((v_perms->>'people_view')::boolean, false)
                    OR COALESCE((v_perms->>'employees:read')::boolean, false),
                'attendance_manage',
                    COALESCE((v_perms->>'attendance_manage')::boolean, false)
                    OR COALESCE((v_perms->>'attendance:update')::boolean, false)
                    OR COALESCE((v_perms->>'attendance:delete')::boolean, false),
                'leave_approve',
                    COALESCE((v_perms->>'leave_approve')::boolean, false)
                    OR COALESCE((v_perms->>'leave:update')::boolean, false)
            );
            RETURN v_perms;
        END IF;
    END IF;

    -- No custom role: system defaults by enum role, copied VERBATIM from
    -- migration 039 so this replacement changes nothing but the
    -- derivation above. Note there is deliberately no 'viewer' branch —
    -- viewers fall through to the member default, as they always have.
    IF v_role = 'admin' THEN
        RETURN '{
          "inbox": true, "contacts": true, "pipelines": true, "broadcasts": true,
          "automations": true, "integrations": true, "settings_profile": true,
          "settings_workspace": true, "settings_templates": true, "settings_tags": true,
          "reports": true, "manage_users": true, "manage_roles": false, "manage_workspaces": false,
          "people_view": true, "people_manage": true, "attendance_manage": true, "leave_approve": true,
          "projects_view": true, "projects_manage": true
        }'::jsonb;
    END IF;

    RETURN '{
      "inbox": true, "contacts": true, "pipelines": false, "broadcasts": false,
      "automations": false, "integrations": false, "settings_profile": true,
      "settings_workspace": false, "settings_templates": false, "settings_tags": false,
      "reports": false, "manage_users": false, "manage_roles": false, "manage_workspaces": false,
      "people_view": true, "people_manage": false, "attendance_manage": false, "leave_approve": false,
      "projects_view": true, "projects_manage": false
    }'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
