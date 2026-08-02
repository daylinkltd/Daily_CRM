-- ============================================================
-- 093 — Take payroll and employee-record write access away from the
--       ordinary member and viewer roles.
--
-- WHAT WAS ACTUALLY FOUND (checked against production, and it differs
-- from what the HR audit assumed):
--
--   * No member is on the Admin role. The two `member`-enum users sit on
--     "Agent", so the audit's "every legacy member became an Admin" is
--     not true here.
--   * But Agent grants 145 of 152 keys — including payroll:read/create/
--     update/delete and employees:create/update/delete. So an ordinary
--     employee could read and rewrite every colleague's basic_salary,
--     hra, ctc_annual, pf_deduction and tds_deduction straight through
--     PostgREST. The UI hides it; the database did not.
--   * Viewer grants payroll:read and employees:read — a read-only user
--     could still pull the whole payroll.
--
-- Salary lives in columns ON employee_profiles, and RLS is per-table, so
-- "read the employee directory" and "read everyone's pay" are currently
-- the same grant. Splitting them properly needs a directory view that
-- excludes the six salary columns; until then employees:read is left in
-- place for Agent (the directory, the assignee pickers and the org chart
-- all depend on it) and REVOKED for Viewer, who needs none of that.
--
-- Owners and admins are untouched: they short-circuit to full access in
-- has_workspace_permission and has_resource_permission.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Agent: keep the directory, lose payroll and employee mutation.
-- ------------------------------------------------------------
UPDATE public.workspace_roles
SET permissions = permissions || jsonb_build_object(
        'payroll:read',      false,
        'payroll:create',    false,
        'payroll:update',    false,
        'payroll:delete',    false,
        'employees:create',  false,
        'employees:update',  false,
        'employees:delete',  false
    )
WHERE lower(name) = 'agent'
  -- Only touch roles that actually grant one of these, so re-running is
  -- a no-op and a workspace that has already tightened Agent by hand is
  -- not disturbed.
  AND (
        (permissions->>'payroll:read')::boolean IS TRUE
     OR (permissions->>'payroll:create')::boolean IS TRUE
     OR (permissions->>'payroll:update')::boolean IS TRUE
     OR (permissions->>'payroll:delete')::boolean IS TRUE
     OR (permissions->>'employees:create')::boolean IS TRUE
     OR (permissions->>'employees:update')::boolean IS TRUE
     OR (permissions->>'employees:delete')::boolean IS TRUE
  );

-- ------------------------------------------------------------
-- Viewer: read-only should not mean "read the payroll".
-- ------------------------------------------------------------
UPDATE public.workspace_roles
SET permissions = permissions || jsonb_build_object(
        'payroll:read',   false,
        'employees:read', false
    )
WHERE lower(name) = 'viewer'
  AND (
        (permissions->>'payroll:read')::boolean IS TRUE
     OR (permissions->>'employees:read')::boolean IS TRUE
  );

-- ------------------------------------------------------------
-- A member with no role_id at all is denied every CRUD-gated resource by
-- has_resource_permission (074), which covers SELECT too — so those
-- screens render empty with no error. Give them their workspace's role
-- matching their enum, which is what the 074 backfill did for everyone
-- who existed at the time but never did for anyone added since.
-- ------------------------------------------------------------
UPDATE public.workspace_members wm
SET role_id = wr.id
FROM public.workspace_roles wr
WHERE wm.role_id IS NULL
  AND wr.workspace_id = wm.workspace_id
  AND lower(wr.name) = CASE wm.role
        WHEN 'owner'  THEN 'owner'
        WHEN 'admin'  THEN 'admin'
        WHEN 'viewer' THEN 'viewer'
        ELSE 'agent'
      END;
