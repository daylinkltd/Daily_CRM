-- ============================================================
-- 119 — Team & Access permission, "Agent" → "Team Member",
--       and (again) co-member profile visibility
--
-- Three related fixes in one paste, because they are all needed
-- before Settings → Members and the HR directory behave correctly:
--
--   1. PROFILE VISIBILITY. This repeats migration 108, which has not
--      been applied. Without it every page that resolves a teammate's
--      name from the browser shows a placeholder — "Unknown User" in
--      the HR directory, "Team Member" on timesheets — because RLS
--      answers a `profiles` query with the caller's own row and
--      nothing else. Repeating it here is deliberate: it is idempotent
--      and this is the one paste that must not be missed.
--
--   2. ROLE RENAME. The built-in staff role is displayed as
--      "Team Member" now; "Agent" described a support-desk seat that
--      most of these people are not. Only the ROW NAME changes. The
--      `workspace_members.role` enum value stays 'agent' — it appears
--      in a CHECK constraint, in triggers, and in every existing row,
--      and renaming it would be a data migration with no visible
--      benefit. The application accepts both names while workspaces
--      are mid-upgrade.
--
--   3. TEAM & ACCESS PERMISSION. `team_members:create|read|update|
--      delete` becomes a real key in every role's permission map, so
--      an owner can decide which roles may add, re-role and remove
--      people instead of that being hardcoded to owner/admin.
--      Seeded to match today's behaviour exactly: Owner and Admin get
--      all four, everyone else gets read only. Nothing changes for
--      anyone until someone edits a role.
--
-- Safe to run more than once.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Co-member profile reads (see migration 108 for the full
--    diagnosis). A user may read the profile of anyone who shares a
--    workspace with them — name, email, avatar. Nothing broader:
--    strangers on other tenants stay invisible, and only SELECT is
--    granted.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view profiles of their workspace members" ON public.profiles;

CREATE POLICY "Users can view profiles of their workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm1
        JOIN public.workspace_members wm2
          ON wm2.workspace_id = wm1.workspace_id
       WHERE wm1.user_id = auth.uid()
         AND wm2.user_id = public.profiles.user_id
    )
);

-- ------------------------------------------------------------
-- 2. Rename the built-in staff role, per workspace.
--    Guarded so a workspace that already has a "Team Member" row
--    (from a partial run, or one created by hand) is left alone
--    rather than colliding on the per-workspace name.
-- ------------------------------------------------------------
UPDATE public.workspace_roles wr
   SET name = 'Team Member',
       description = COALESCE(NULLIF(wr.description, 'Can view inbox and manage contacts'),
                              wr.description)
 WHERE wr.name = 'Agent'
   AND wr.is_system = true
   AND NOT EXISTS (
       SELECT 1 FROM public.workspace_roles other
        WHERE other.workspace_id = wr.workspace_id
          AND other.name = 'Team Member'
   );

-- ------------------------------------------------------------
-- 3. Seed `team_members:*` into every role's permission map.
--
--    jsonb || only overwrites the keys it names, so a role's other
--    152 permissions are untouched. `NOT ?` guards mean a role whose
--    Team & Access has already been edited keeps the operator's
--    choice on a re-run.
-- ------------------------------------------------------------

-- Owner / Admin: full control (matches the pre-existing hardcode).
UPDATE public.workspace_roles
   SET permissions = permissions || jsonb_build_object(
         'team_members:create', true,
         'team_members:read',   true,
         'team_members:update', true,
         'team_members:delete', true
       )
 WHERE is_system = true
   AND name IN ('Owner', 'Admin')
   AND NOT (permissions ? 'team_members:create');

-- Everyone else — built-in Viewer/Team Member and every custom role:
-- can see the roster, cannot change it. This is what a non-admin
-- could do before, stated explicitly.
UPDATE public.workspace_roles
   SET permissions = permissions || jsonb_build_object(
         'team_members:create', false,
         'team_members:read',   true,
         'team_members:update', false,
         'team_members:delete', false
       )
 WHERE (is_system = false OR name NOT IN ('Owner', 'Admin'))
   AND NOT (permissions ? 'team_members:create');

-- ------------------------------------------------------------
-- 4. Pin the Marketing and Bar module keys for existing roles.
--
--    Those two modules were read as opt-OUT in the application
--    (`!== false`), so a role that had never heard of them still
--    granted access. That is now read like every other module —
--    explicitly true or nothing — and these writes record the access
--    each role has TODAY so the correction takes nothing away.
--
--    A role that already carries the key keeps its setting.
-- ------------------------------------------------------------
UPDATE public.workspace_roles
   SET permissions = permissions || jsonb_build_object('module_marketing', true)
 WHERE NOT (permissions ? 'module_marketing');

UPDATE public.workspace_roles
   SET permissions = permissions || jsonb_build_object('module_bar', true)
 WHERE NOT (permissions ? 'module_bar');

COMMIT;

-- ============================================================
-- Verify — run these after the paste
-- ============================================================
-- 0. Module keys pinned (expect both counts = total roles):
--
-- SELECT count(*) FILTER (WHERE permissions ? 'module_marketing') AS marketing,
--        count(*) FILTER (WHERE permissions ? 'module_bar')       AS bar,
--        count(*)                                                 AS roles
--   FROM public.workspace_roles;
--
-- 1. Profile policy present (expect BOTH rows):
--
-- SELECT policyname FROM pg_policies
--  WHERE tablename = 'profiles' AND cmd = 'SELECT';
--   -- "Users can view own profile"
--   -- "Users can view profiles of their workspace members"
--
-- 2. No "Agent" rows left, and every workspace has a staff role:
--
-- SELECT name, count(*) FROM public.workspace_roles
--  WHERE is_system = true GROUP BY name ORDER BY name;
--   -- expect: Admin, Owner, Team Member, Viewer   (no "Agent")
--
-- 3. Team & Access seeded everywhere:
--
-- SELECT count(*) FILTER (WHERE permissions ? 'team_members:create') AS seeded,
--        count(*)                                                    AS roles
--   FROM public.workspace_roles;
--   -- expect: seeded = roles
--
-- 4. Names now resolve for a signed-in member (the "Unknown User"
--    check). As that member, not the service role:
--
-- SELECT count(*) FROM public.profiles;
--   -- expect: the number of people sharing a workspace with them,
--   --         not 1.
-- ============================================================
