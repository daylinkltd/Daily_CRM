-- ============================================================
-- 097 — workspace_members.role_id must never be NULL.
--
-- WHY THIS IS A LOCKOUT, not a cosmetic gap: the CRUD policies generated
-- by 074 are RESTRICTIVE, and has_resource_permission (074:75) returns
-- FALSE when the workspace_members → workspace_roles JOIN finds nothing.
-- RESTRICTIVE policies only narrow, so a member with role_id IS NULL is
-- denied INSERT, SELECT, UPDATE and DELETE on every table in the resource
-- catalog. Meanwhile get_user_permissions (092:172) still returns the
-- coarse member defaults, so the UI renders pages — inbox, contacts,
-- people — that the database then refuses row by row. The user sees empty
-- screens, not permission errors.
--
-- 073 already backfilled the column with the mapping reproduced below, so
-- nobody is in this state today (verified: 0 of 6 members across all
-- workspaces have a NULL role_id). This closes the door for new writes.
--
-- Belt and braces with the API layer: /api/workspace/users and
-- /api/account/members/[userId] now resolve the fallback themselves and
-- treat an explicit null as "reset to default". The trigger covers the
-- paths they don't — the service-role client, SQL run by hand, and any
-- future insert path.
--
-- Mapping matches migration 073 and src/lib/auth/roles.ts
-- defaultSystemRoleName() exactly. All three must stay in agreement.
--
-- Idempotent; safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.workspace_members_fill_role_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_name TEXT;
    v_role_id   UUID;
BEGIN
    IF NEW.role_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_role_name := CASE
        WHEN NEW.role IN ('owner', 'admin') THEN 'Admin'
        ELSE 'Agent'
    END;

    SELECT id INTO v_role_id
    FROM public.workspace_roles
    WHERE workspace_id = NEW.workspace_id
      AND is_system = true
      AND name = v_role_name
    LIMIT 1;

    -- Seeded per workspace at creation by 015/021. If it is genuinely
    -- missing, leave role_id NULL rather than block the write: refusing
    -- here would break workspace creation itself, where the owner row can
    -- be inserted before the system roles exist. The member is then
    -- role-less and fails closed, which is the safe direction, and 073's
    -- backfill (repeated at the bottom of this file) will catch them.
    IF v_role_id IS NOT NULL THEN
        NEW.role_id := v_role_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_members_fill_role_id ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_fill_role_id
    BEFORE INSERT OR UPDATE OF role_id, role ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.workspace_members_fill_role_id();

-- Safety net: re-run 073's backfill for anyone who slipped through
-- between 073 and this migration (expected to affect 0 rows).
UPDATE public.workspace_members wm
SET role_id = wr.id
FROM public.workspace_roles wr
WHERE wm.role_id IS NULL
  AND wr.workspace_id = wm.workspace_id
  AND wr.is_system = true
  AND wr.name = CASE
        WHEN wm.role IN ('owner', 'admin') THEN 'Admin'
        ELSE 'Agent'
      END;

COMMENT ON FUNCTION public.workspace_members_fill_role_id() IS
    'Fills workspace_members.role_id with the workspace built-in role (Admin for owner/admin, else Agent) when a write leaves it NULL. A NULL role_id is denied every operation by the RESTRICTIVE CRUD policies from 074.';
