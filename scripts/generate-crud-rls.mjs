/**
 * Generates the per-operation CRUD RLS migration from the resource
 * catalog in src/lib/auth/resources.ts.
 *
 * Run:  node --experimental-strip-types scripts/generate-crud-rls.mjs > supabase/migrations/074_crud_rbac.sql
 *
 * Why generated: 32 resources x 120 tables x 4 operations is ~480
 * policies. Hand-writing them guarantees typos and, worse, guarantees
 * the UI matrix and the database drift apart. Both now come from one
 * catalog.
 */

const { RESOURCES, ACTIONS, ACTION_SQL, MODULE_KEYS, RESOURCES: _r } = await import(
  "../src/lib/auth/resources.ts"
);

const out = [];
const w = (s = "") => out.push(s);

w(`-- ============================================================
-- 074_crud_rbac.sql   *** GENERATED — DO NOT EDIT BY HAND ***
--
-- Source: src/lib/auth/resources.ts
-- Regenerate: node --experimental-strip-types scripts/generate-crud-rls.mjs \\
--               > supabase/migrations/074_crud_rbac.sql
--
-- Per-resource, per-operation CRUD permissions enforced in the
-- database. Every permission is '<resource>:<action>' (e.g.
-- 'payroll:read', 'contacts:delete') stored in
-- workspace_roles.permissions, and each table gets four RESTRICTIVE
-- policies — one per SQL operation — so "read but never delete" is a
-- real boundary even against direct API calls.
--
-- RESTRICTIVE policies only narrow: existing permissive policies keep
-- their per-row logic and now additionally require the matching CRUD
-- permission. Owners/admins short-circuit inside the helper.
-- service_role bypasses RLS entirely, so webhooks and system jobs are
-- unaffected.
--
-- Rollout is non-disruptive — see the seeding section: existing roles
-- are granted every action they could already perform, and the three
-- built-in roles (Owner / Admin / Viewer) are created per workspace.
-- Nobody loses access on deploy; admins then untick what they want to
-- restrict.
--
-- Idempotent.
-- ============================================================
`);

// ── helper function ────────────────────────────────────────────────
w(`-- ---------------------------------------------------------------
-- 1. Permission helper: '<resource>:<action>' lookup.
--
-- Mirrors has_workspace_permission (migration 049) but is written for
-- the CRUD keys, and ALSO requires the row's module to be granted, so
-- a role can be shut out of a whole module without unticking 4x32
-- boxes. STABLE + SECURITY DEFINER so RLS can call it cheaply.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_resource_permission(
  p_workspace_id UUID,
  p_user_id      UUID,
  p_resource     TEXT,
  p_action       TEXT,
  p_module       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_perms JSONB;
BEGIN
  IF p_user_id IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owners and admins bypass the matrix entirely.
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT wr.permissions INTO v_perms
  FROM public.workspace_members wm
  JOIN public.workspace_roles wr ON wr.id = wm.role_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = p_user_id;

  -- No role assigned → no access to gated resources.
  IF v_perms IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Module gate. Absent key = allowed, so roles created before the
  -- module keys existed keep working (073 seeds them anyway).
  IF p_module IS NOT NULL
     AND v_perms ? ('module_' || p_module)
     AND COALESCE((v_perms->>('module_' || p_module))::boolean, false) IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN COALESCE((v_perms->>(p_resource || ':' || p_action))::boolean, false);
END
$fn$;

REVOKE ALL ON FUNCTION public.has_resource_permission(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_resource_permission(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
`);

// ── seeding ────────────────────────────────────────────────────────
const allKeys = RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r.key}:${a}`));
const viewerKeys = RESOURCES.map((r) => `${r.key}:read`);
const moduleKeys = MODULE_KEYS.map((m) => `module_${m}`);

const jsonAll = JSON.stringify(
  Object.fromEntries([
    ...allKeys.map((k) => [k, true]),
    ...moduleKeys.map((k) => [k, true]),
  ]),
);
const jsonViewer = JSON.stringify(
  Object.fromEntries([
    ...allKeys.map((k) => [k, viewerKeys.includes(k)]),
    ...moduleKeys.map((k) => [k, true]),
  ]),
);

w(`-- ---------------------------------------------------------------
-- 2. Built-in roles: Owner / Admin / Viewer, per workspace.
--    Owner+Admin get the full matrix (their bypass makes it
--    informational); Viewer is read-everything, no writes, and stays
--    editable so an admin can narrow which modules a viewer sees.
-- ---------------------------------------------------------------
INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Owner', 'Full access including billing and deleting the workspace.', '${jsonAll}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Owner'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Admin', 'Manage the team, settings and every module.', '${jsonAll}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Admin'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Viewer', 'Read-only across every module. Cannot create, edit or delete.', '${jsonViewer}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Viewer'
);

-- ---------------------------------------------------------------
-- 3. Non-disruptive seeding of EXISTING roles.
--
--    Any role missing CRUD keys is granted every action for the
--    modules it already had — i.e. exactly what its holders could do
--    before this migration. Existing keys are never overwritten, so a
--    re-run can't undo an admin's later choices.
-- ---------------------------------------------------------------
UPDATE public.workspace_roles wr
SET permissions = seed.perms || wr.permissions
FROM (
  SELECT r.id,
         jsonb_object_agg(k.key, true) AS perms
  FROM public.workspace_roles r
  CROSS JOIN (VALUES`);

const seedRows = RESOURCES.flatMap((r) =>
  ACTIONS.map((a) => `    ('${r.key}:${a}', '${r.module}')`),
);
w(seedRows.join(",\n"));
w(`  ) AS k(key, module)
  WHERE NOT (r.permissions ? k.key)
    -- only grant modules the role already had (073 defaulted these to true)
    AND COALESCE((r.permissions->>('module_' || k.module))::boolean, true) IS TRUE
  GROUP BY r.id
) AS seed
WHERE wr.id = seed.id;

-- Viewers must never gain writes from the blanket seed above.
UPDATE public.workspace_roles
SET permissions = permissions || '${JSON.stringify(
    Object.fromEntries(
      RESOURCES.flatMap((r) =>
        ACTIONS.filter((a) => a !== "read").map((a) => [`${r.key}:${a}`, false]),
      ),
    ),
  )}'::jsonb
WHERE is_system = true AND name = 'Viewer';

-- ---------------------------------------------------------------
-- 4. Backfill role_id for members that still have none, so the matrix
--    is actually consulted instead of failing closed.
-- ---------------------------------------------------------------
UPDATE public.workspace_members wm
SET role_id = wr.id
FROM public.workspace_roles wr
WHERE wm.role_id IS NULL
  AND wr.workspace_id = wm.workspace_id
  AND wr.is_system = true
  AND wr.name = CASE
        WHEN wm.role = 'owner'  THEN 'Owner'
        WHEN wm.role = 'admin'  THEN 'Admin'
        WHEN wm.role = 'viewer' THEN 'Viewer'
        ELSE 'Admin'   -- legacy 'member' rows keep today's full access
      END;
`);

// ── policies ───────────────────────────────────────────────────────
w(`-- ---------------------------------------------------------------
-- 5. Per-operation RESTRICTIVE policies.
--
--    to_regclass guards mean a table from an unapplied module
--    migration is skipped rather than aborting the run.
-- ---------------------------------------------------------------`);

const direct = [];
const children = [];
for (const r of RESOURCES) {
  for (const t of r.tables) {
    if (t.scope === "workspace") direct.push([t.name, r.key, r.module]);
    else children.push([t.name, t.scope.parent, t.scope.fk, r.key, r.module]);
  }
}

w(`
DO $crud$
DECLARE
  r RECORD;
  act RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES`);
w(direct.map(([t, res, mod]) => `      ('${t}','${res}','${mod}')`).join(",\n"));
w(`    ) AS t(tbl, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    FOR act IN
      SELECT * FROM (VALUES ${ACTIONS.map(
        (a) => `('${a}','${ACTION_SQL[a]}')`,
      ).join(", ")}) AS a(action, op)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'crud_'||act.action, r.tbl);
      IF act.op = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT '
          'WITH CHECK (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, r.resource, act.action, r.module);
      ELSIF act.op = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE '
          'USING (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L)) '
          'WITH CHECK (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, r.resource, act.action, r.module,
          r.resource, act.action, r.module);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s '
          'USING (public.has_resource_permission(workspace_id, auth.uid(), %L, %L, %L))',
          'crud_'||act.action, r.tbl, act.op, r.resource, act.action, r.module);
      END IF;
    END LOOP;
  END LOOP;
END
$crud$;

DO $crudc$
DECLARE
  r RECORD;
  act RECORD;
  pred TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES`);
w(
  children
    .map(([t, p, fk, res, mod]) => `      ('${t}','${p}','${fk}','${res}','${mod}')`)
    .join(",\n"),
);
w(`    ) AS t(tbl, parent, fk, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL OR to_regclass('public.'||r.parent) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    FOR act IN
      SELECT * FROM (VALUES ${ACTIONS.map(
        (a) => `('${a}','${ACTION_SQL[a]}')`,
      ).join(", ")}) AS a(action, op)
    LOOP
      -- workspace resolved through the parent row
      pred := format(
        'EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        'AND public.has_resource_permission(p.workspace_id, auth.uid(), %L, %L, %L))',
        r.parent, r.tbl, r.fk, r.resource, act.action, r.module);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     'crud_'||act.action, r.tbl);
      IF act.op = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (%s)',
                       'crud_'||act.action, r.tbl, pred);
      ELSIF act.op = 'UPDATE' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)',
                       'crud_'||act.action, r.tbl, pred, pred);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s USING (%s)',
                       'crud_'||act.action, r.tbl, act.op, pred);
      END IF;
    END LOOP;
  END LOOP;
END
$crudc$;`);

process.stdout.write(out.join("\n") + "\n");
