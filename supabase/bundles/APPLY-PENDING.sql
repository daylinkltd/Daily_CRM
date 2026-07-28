
-- ==================== BEGIN 071_message_reactions_repair ====================

-- ============================================================
-- 071_message_reactions_repair.sql
--
-- Emoji reactions failed with:
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification"
--
-- Why: message_reactions exists in production but WITHOUT the
-- UNIQUE (message_id, actor_type, actor_id) constraint that
-- migration 028 declares. The table was created by the ad-hoc DDL in
-- /api/admin/setup-db, whose CREATE TABLE omitted the constraint —
-- so 028's `CREATE TABLE IF NOT EXISTS` then found the table already
-- present and skipped it, constraint included. The route's SQL is
-- corrected in the same commit as this migration.
--
-- Also replaces 028's per-user RLS policies with workspace-scoped
-- ones, matching migrations 066/068: a reaction belongs to the
-- workspace's conversation, not to whoever happens to have created
-- the conversation row, so teammates must be able to see it.
--
-- Idempotent.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. De-duplicate before adding the constraint.
--    Keeps the most recent reaction per (message, actor).
-- ---------------------------------------------------------------
DELETE FROM public.message_reactions r
USING public.message_reactions keep
WHERE r.message_id = keep.message_id
  AND r.actor_type = keep.actor_type
  AND r.actor_id IS NOT DISTINCT FROM keep.actor_id
  AND (
    r.created_at < keep.created_at
    OR (r.created_at = keep.created_at AND r.id < keep.id)
  );

-- ---------------------------------------------------------------
-- 2. The constraint the upsert needs.
-- ---------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.message_reactions
    ADD CONSTRAINT message_reactions_message_actor_key
    UNIQUE (message_id, actor_type, actor_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;   -- constraint/index already present
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------
-- 3. Workspace-scoped RLS.
--
-- 028 gated on conversations.user_id = auth.uid(), which hides a
-- teammate's reactions (and blocks writing to a conversation someone
-- else opened). Scope through the conversation's workspace instead.
-- ---------------------------------------------------------------
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see reactions on their conversations" ON public.message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON public.message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Members view workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers manage workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers update workspace reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Writers delete own agent reactions" ON public.message_reactions;

CREATE POLICY "Members view workspace reactions" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_member(c.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Writers manage workspace reactions" ON public.message_reactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Writers update workspace reactions" ON public.message_reactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );

-- Agents remove only their own reactions; customer reactions are
-- managed by the webhook with the service role.
CREATE POLICY "Writers delete own agent reactions" ON public.message_reactions
  FOR DELETE USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_reactions.conversation_id
        AND public.is_active_workspace_writer(c.workspace_id, auth.uid())
    )
  );

-- ==================== END 071_message_reactions_repair ====================


-- ==================== BEGIN 072_message_templates_columns_and_status ====================

-- ============================================================
-- 072_message_templates_columns_and_status.sql
--
-- Two independent template failures reported in production:
--
--   1. Submitting a template:
--      "Could not find the 'header_media_url' column of
--       'message_templates' in the schema cache"
--      The submit route writes four columns that were never added to
--      the table: header_media_url, submission_error, rejection_reason,
--      last_submitted_at. The template WAS created on Meta, but the
--      local row insert failed.
--
--   2. "Sync from Meta" reporting every template as failed:
--      "violates check constraint message_templates_status_check"
--      Migration 001 defined status as
--        CHECK (status IN ('Draft','Pending','Approved','Rejected'))
--      but the app standardised on Meta's uppercase vocabulary
--      (DRAFT/PENDING/APPROVED/REJECTED/PAUSED/DISABLED/IN_APPEAL/
--       PENDING_DELETION — see template-status-normalize.ts). Every
--      synced row therefore violated the old constraint.
--
-- Idempotent.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Missing columns the submit route writes.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS header_media_url TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS submission_error TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------
-- 2. Bring the status CHECK in line with the app's vocabulary.
--
--    Order matters: DROP the old constraint FIRST, otherwise the
--    normalizing UPDATE ('Draft' -> 'DRAFT') violates the very
--    title-case constraint we're trying to replace.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_status_check;

UPDATE public.message_templates
SET status = upper(status)
WHERE status IS NOT NULL
  AND status <> upper(status);

-- Map the one legacy value that isn't just a case change.
UPDATE public.message_templates
SET status = 'PENDING'
WHERE status = 'PENDING_REVIEW';

-- Anything still outside the allowed set becomes PENDING rather than
-- blocking the constraint swap (keeps the row visible).
UPDATE public.message_templates
SET status = 'PENDING'
WHERE status IS NULL
   OR status NOT IN (
     'DRAFT', 'PENDING', 'APPROVED', 'REJECTED',
     'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION'
   );

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_status_check
  CHECK (status IN (
    'DRAFT', 'PENDING', 'APPROVED', 'REJECTED',
    'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION'
  ));

ALTER TABLE public.message_templates
  ALTER COLUMN status SET DEFAULT 'DRAFT';

-- ---------------------------------------------------------------
-- 3. header_type also standardised to uppercase (TEXT/IMAGE/VIDEO/
--    DOCUMENT) in the builder, while 001 constrained it to lowercase.
--    Relax it to accept both so a synced media-header template can't
--    trip the same wall as status.
-- ---------------------------------------------------------------
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_header_type_check;

UPDATE public.message_templates
SET header_type = lower(header_type)
WHERE header_type IS NOT NULL
  AND header_type <> lower(header_type);

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_header_type_check
  CHECK (
    header_type IS NULL
    OR lower(header_type) IN ('text', 'image', 'video', 'document')
  );

-- ==================== END 072_message_templates_columns_and_status ====================


-- ==================== BEGIN 073_module_access_rbac ====================

-- ============================================================
-- 073_module_access_rbac.sql
--
-- Per-module access control (CRM / HR / Retail / Projects) built on
-- the existing custom-role system (workspace_roles.permissions JSONB +
-- workspace_members.role_id + has_workspace_permission()).
--
-- Adds four module keys to every role's permission map and enforces
-- them at the database layer with ADDITIVE RESTRICTIVE policies — so a
-- member can only touch a module's tables when their role grants that
-- module (owners/admins bypass via has_workspace_permission). Existing
-- permissive policies are left untouched; the restrictive layer only
-- narrows, it never widens, so per-row rules (e.g. "see own record")
-- still apply AND now also require module access.
--
-- Rollout is non-disruptive: existing roles are seeded with ALL modules
-- = true (nobody loses access on deploy) and every member's role_id is
-- backfilled to their workspace's matching system role so the JSONB is
-- actually consulted. Admins then untick modules per role in
-- Settings -> Roles to restrict (e.g. take HR away from agents).
--
-- Idempotent. service_role bypasses RLS, so webhooks/system writes are
-- unaffected.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Seed module keys into existing roles (default true = preserve
--    current access). jsonb || only sets keys that are absent via
--    COALESCE so we never overwrite an admin's later choice.
-- ---------------------------------------------------------------
UPDATE public.workspace_roles
SET permissions = permissions
  || jsonb_build_object('module_crm',      COALESCE((permissions->>'module_crm')::boolean, true))
  || jsonb_build_object('module_hr',       COALESCE((permissions->>'module_hr')::boolean, true))
  || jsonb_build_object('module_retail',   COALESCE((permissions->>'module_retail')::boolean, true))
  || jsonb_build_object('module_projects', COALESCE((permissions->>'module_projects')::boolean, true));

-- ---------------------------------------------------------------
-- 2. Backfill role_id so non-owner/admin members are evaluated against
--    a role's JSONB instead of failing closed. Map each member's enum
--    role to the workspace's same-named system role.
-- ---------------------------------------------------------------
UPDATE public.workspace_members wm
SET role_id = wr.id
FROM public.workspace_roles wr
WHERE wm.role_id IS NULL
  AND wr.workspace_id = wm.workspace_id
  AND wr.is_system = true
  AND wr.name = CASE
        WHEN wm.role IN ('owner','admin') THEN 'Admin'
        ELSE 'Agent'
      END;

-- ---------------------------------------------------------------
-- 3. Module-gate the tables. A helper DO block installs one
--    RESTRICTIVE "module_gate" policy per table, guarded by
--    to_regclass so a table from an unapplied module migration is
--    simply skipped.
-- ---------------------------------------------------------------
DO $mod$
DECLARE
  r RECORD;
BEGIN
  -- direct tables: workspace_id lives on the row
  FOR r IN
    SELECT * FROM (VALUES
      ('departments','module_hr'),
      ('designations','module_hr'),
      ('employee_profiles','module_hr'),
      ('employee_assets','module_hr'),
      ('employee_documents','module_hr'),
      ('attendance','module_hr'),
      ('leave_requests','module_hr'),
      ('time_logs','module_hr'),
      ('expense_claims','module_hr'),
      ('payroll_cycles','module_hr'),
      ('payslips','module_hr'),
      ('salary_advances','module_hr'),
      ('hr_policies','module_hr'),
      ('hr_policy_acknowledgements','module_hr'),
      ('hr_policy_notifications','module_hr'),
      ('hr_policy_targets','module_hr'),
      ('hr_policy_versions','module_hr'),
      ('hr_operational_settings','module_hr'),
      ('hr_approval_instances','module_hr'),
      ('hr_approval_workflows','module_hr'),
      ('hr_audit_logs','module_hr'),
      ('hr_candidates','module_hr'),
      ('hr_employee_history','module_hr'),
      ('hr_employee_promotions','module_hr'),
      ('hr_employee_requests','module_hr'),
      ('hr_employees','module_hr'),
      ('hr_holidays','module_hr'),
      ('hr_interviews','module_hr'),
      ('hr_job_applications','module_hr'),
      ('hr_offer_letters','module_hr'),
      ('hr_onboarding_employee_tasks','module_hr'),
      ('hr_onboarding_tasks','module_hr'),
      ('hr_performance_goals','module_hr'),
      ('hr_performance_reviews','module_hr'),
      ('hr_recruitment_jobs','module_hr'),
      ('hr_review_cycles','module_hr'),
      ('hr_salary_components','module_hr'),
      ('hr_salary_structures','module_hr'),
      ('hr_shift_assignments','module_hr'),
      ('hr_shifts','module_hr'),
      ('hr_attendance_breaks','module_hr'),
      ('hr_attendance_requests','module_hr'),
      ('projects','module_projects'),
      ('project_automations','module_projects'),
      ('project_invoice_items','module_projects'),
      ('project_invoices','module_projects'),
      ('tasks','module_projects'),
      ('workspace_labels','module_projects'),
      ('commerce_cash_registers','module_retail'),
      ('commerce_categories','module_retail'),
      ('commerce_inventory_batches','module_retail'),
      ('commerce_inventory_movements','module_retail'),
      ('commerce_products','module_retail'),
      ('commerce_purchase_orders','module_retail'),
      ('commerce_sales_orders','module_retail'),
      ('commerce_suppliers','module_retail'),
      ('commerce_bank_accounts','module_retail'),
      ('commerce_chart_of_accounts','module_retail'),
      ('commerce_customer_khata','module_retail'),
      ('commerce_journal_entries','module_retail'),
      ('commerce_gst_ledgers','module_retail'),
      ('commerce_pos_held_bills','module_retail'),
      ('commerce_grn_receipts','module_retail'),
      ('commerce_loyalty_ledger','module_retail'),
      ('commerce_price_lists','module_retail'),
      ('commerce_rma_tickets','module_retail'),
      ('commerce_sales_returns','module_retail'),
      ('commerce_stock_audits','module_retail'),
      ('commerce_stock_transfers','module_retail'),
      ('commerce_warehouses','module_retail'),
      ('commerce_product_attribute_definitions','module_retail'),
      ('commerce_workspace_settings','module_retail'),
      ('master_brands','module_retail'),
      ('master_cost_centers','module_retail')
    ) AS t(tbl, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
      EXECUTE format('DROP POLICY IF EXISTS module_gate ON public.%I', r.tbl);
      EXECUTE format(
        'CREATE POLICY module_gate ON public.%I AS RESTRICTIVE FOR ALL '
        'USING (public.has_workspace_permission(workspace_id, auth.uid(), %L)) '
        'WITH CHECK (public.has_workspace_permission(workspace_id, auth.uid(), %L))',
        r.tbl, r.module, r.module);
    END IF;
  END LOOP;
END
$mod$;

DO $modc$
DECLARE
  r RECORD;
BEGIN
  -- child tables: workspace resolved through the parent FK
  FOR r IN
    SELECT * FROM (VALUES
      ('hr_approval_steps','hr_approval_instances','instance_id','module_hr'),
      ('hr_salary_structure_components','hr_salary_structures','structure_id','module_hr'),
      ('project_activity','projects','project_id','module_projects'),
      ('project_columns','projects','project_id','module_projects'),
      ('project_members','projects','project_id','module_projects'),
      ('project_components','projects','project_id','module_projects'),
      ('project_statuses','projects','project_id','module_projects'),
      ('project_workflows','projects','project_id','module_projects'),
      ('task_comments','tasks','task_id','module_projects'),
      ('task_files','tasks','task_id','module_projects'),
      ('task_activity','tasks','task_id','module_projects'),
      ('task_components','tasks','task_id','module_projects'),
      ('task_labels','tasks','task_id','module_projects'),
      ('task_watchers','tasks','task_id','module_projects'),
      ('epics','projects','project_id','module_projects'),
      ('sprints','projects','project_id','module_projects'),
      ('commerce_purchase_items','commerce_purchase_orders','po_id','module_retail'),
      ('commerce_sales_items','commerce_sales_orders','sales_order_id','module_retail'),
      ('commerce_journal_lines','commerce_journal_entries','journal_entry_id','module_retail'),
      ('commerce_price_list_items','commerce_price_lists','price_list_id','module_retail'),
      ('commerce_stock_audit_items','commerce_stock_audits','audit_id','module_retail'),
      ('commerce_warehouse_stock','commerce_warehouses','warehouse_id','module_retail'),
      ('commerce_product_variants','commerce_products','parent_product_id','module_retail')
    ) AS t(tbl, parent, fk, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NOT NULL AND to_regclass('public.'||r.parent) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
      EXECUTE format('DROP POLICY IF EXISTS module_gate ON public.%I', r.tbl);
      EXECUTE format(
        'CREATE POLICY module_gate ON public.%I AS RESTRICTIVE FOR ALL '
        'USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.has_workspace_permission(p.workspace_id, auth.uid(), %L))) '
        'WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.has_workspace_permission(p.workspace_id, auth.uid(), %L)))',
        r.tbl, r.parent, r.tbl, r.fk, r.module, r.parent, r.tbl, r.fk, r.module);
    END IF;
  END LOOP;
END
$modc$;

-- ==================== END 073_module_access_rbac ====================


-- ==================== BEGIN 074_crud_rbac ====================

-- ============================================================
-- 074_crud_rbac.sql   *** GENERATED — DO NOT EDIT BY HAND ***
--
-- Source: src/lib/auth/resources.ts
-- Regenerate: node --experimental-strip-types scripts/generate-crud-rls.mjs \
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

-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- 2. Built-in roles: Owner / Admin / Viewer, per workspace.
--    Owner+Admin get the full matrix (their bypass makes it
--    informational); Viewer is read-everything, no writes, and stays
--    editable so an admin can narrow which modules a viewer sees.
-- ---------------------------------------------------------------
INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Owner', 'Full access including billing and deleting the workspace.', '{"inbox:create":true,"inbox:read":true,"inbox:update":true,"inbox:delete":true,"contacts:create":true,"contacts:read":true,"contacts:update":true,"contacts:delete":true,"pipelines:create":true,"pipelines:read":true,"pipelines:update":true,"pipelines:delete":true,"deals:create":true,"deals:read":true,"deals:update":true,"deals:delete":true,"broadcasts:create":true,"broadcasts:read":true,"broadcasts:update":true,"broadcasts:delete":true,"automations:create":true,"automations:read":true,"automations:update":true,"automations:delete":true,"forms:create":true,"forms:read":true,"forms:update":true,"forms:delete":true,"quotations:create":true,"quotations:read":true,"quotations:update":true,"quotations:delete":true,"templates:create":true,"templates:read":true,"templates:update":true,"templates:delete":true,"tags:create":true,"tags:read":true,"tags:update":true,"tags:delete":true,"media:create":true,"media:read":true,"media:update":true,"media:delete":true,"chatbot:create":true,"chatbot:read":true,"chatbot:update":true,"chatbot:delete":true,"api_keys:create":true,"api_keys:read":true,"api_keys:update":true,"api_keys:delete":true,"employees:create":true,"employees:read":true,"employees:update":true,"employees:delete":true,"attendance:create":true,"attendance:read":true,"attendance:update":true,"attendance:delete":true,"leave:create":true,"leave:read":true,"leave:update":true,"leave:delete":true,"payroll:create":true,"payroll:read":true,"payroll:update":true,"payroll:delete":true,"hr_policies:create":true,"hr_policies:read":true,"hr_policies:update":true,"hr_policies:delete":true,"recruitment:create":true,"recruitment:read":true,"recruitment:update":true,"recruitment:delete":true,"performance:create":true,"performance:read":true,"performance:update":true,"performance:delete":true,"hr_approvals:create":true,"hr_approvals:read":true,"hr_approvals:update":true,"hr_approvals:delete":true,"products:create":true,"products:read":true,"products:update":true,"products:delete":true,"inventory:create":true,"inventory:read":true,"inventory:update":true,"inventory:delete":true,"sales:create":true,"sales:read":true,"sales:update":true,"sales:delete":true,"purchases:create":true,"purchases:read":true,"purchases:update":true,"purchases:delete":true,"pos:create":true,"pos:read":true,"pos:update":true,"pos:delete":true,"accounting:create":true,"accounting:read":true,"accounting:update":true,"accounting:delete":true,"pricing:create":true,"pricing:read":true,"pricing:update":true,"pricing:delete":true,"projects:create":true,"projects:read":true,"projects:update":true,"projects:delete":true,"tasks:create":true,"tasks:read":true,"tasks:update":true,"tasks:delete":true,"sprints:create":true,"sprints:read":true,"sprints:update":true,"sprints:delete":true,"project_invoices:create":true,"project_invoices:read":true,"project_invoices:update":true,"project_invoices:delete":true,"module_crm":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Owner'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Admin', 'Manage the team, settings and every module.', '{"inbox:create":true,"inbox:read":true,"inbox:update":true,"inbox:delete":true,"contacts:create":true,"contacts:read":true,"contacts:update":true,"contacts:delete":true,"pipelines:create":true,"pipelines:read":true,"pipelines:update":true,"pipelines:delete":true,"deals:create":true,"deals:read":true,"deals:update":true,"deals:delete":true,"broadcasts:create":true,"broadcasts:read":true,"broadcasts:update":true,"broadcasts:delete":true,"automations:create":true,"automations:read":true,"automations:update":true,"automations:delete":true,"forms:create":true,"forms:read":true,"forms:update":true,"forms:delete":true,"quotations:create":true,"quotations:read":true,"quotations:update":true,"quotations:delete":true,"templates:create":true,"templates:read":true,"templates:update":true,"templates:delete":true,"tags:create":true,"tags:read":true,"tags:update":true,"tags:delete":true,"media:create":true,"media:read":true,"media:update":true,"media:delete":true,"chatbot:create":true,"chatbot:read":true,"chatbot:update":true,"chatbot:delete":true,"api_keys:create":true,"api_keys:read":true,"api_keys:update":true,"api_keys:delete":true,"employees:create":true,"employees:read":true,"employees:update":true,"employees:delete":true,"attendance:create":true,"attendance:read":true,"attendance:update":true,"attendance:delete":true,"leave:create":true,"leave:read":true,"leave:update":true,"leave:delete":true,"payroll:create":true,"payroll:read":true,"payroll:update":true,"payroll:delete":true,"hr_policies:create":true,"hr_policies:read":true,"hr_policies:update":true,"hr_policies:delete":true,"recruitment:create":true,"recruitment:read":true,"recruitment:update":true,"recruitment:delete":true,"performance:create":true,"performance:read":true,"performance:update":true,"performance:delete":true,"hr_approvals:create":true,"hr_approvals:read":true,"hr_approvals:update":true,"hr_approvals:delete":true,"products:create":true,"products:read":true,"products:update":true,"products:delete":true,"inventory:create":true,"inventory:read":true,"inventory:update":true,"inventory:delete":true,"sales:create":true,"sales:read":true,"sales:update":true,"sales:delete":true,"purchases:create":true,"purchases:read":true,"purchases:update":true,"purchases:delete":true,"pos:create":true,"pos:read":true,"pos:update":true,"pos:delete":true,"accounting:create":true,"accounting:read":true,"accounting:update":true,"accounting:delete":true,"pricing:create":true,"pricing:read":true,"pricing:update":true,"pricing:delete":true,"projects:create":true,"projects:read":true,"projects:update":true,"projects:delete":true,"tasks:create":true,"tasks:read":true,"tasks:update":true,"tasks:delete":true,"sprints:create":true,"sprints:read":true,"sprints:update":true,"sprints:delete":true,"project_invoices:create":true,"project_invoices:read":true,"project_invoices:update":true,"project_invoices:delete":true,"module_crm":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_roles r WHERE r.workspace_id = w.id AND r.name = 'Admin'
);

INSERT INTO public.workspace_roles (workspace_id, name, description, permissions, is_system)
SELECT w.id, 'Viewer', 'Read-only across every module. Cannot create, edit or delete.', '{"inbox:create":false,"inbox:read":true,"inbox:update":false,"inbox:delete":false,"contacts:create":false,"contacts:read":true,"contacts:update":false,"contacts:delete":false,"pipelines:create":false,"pipelines:read":true,"pipelines:update":false,"pipelines:delete":false,"deals:create":false,"deals:read":true,"deals:update":false,"deals:delete":false,"broadcasts:create":false,"broadcasts:read":true,"broadcasts:update":false,"broadcasts:delete":false,"automations:create":false,"automations:read":true,"automations:update":false,"automations:delete":false,"forms:create":false,"forms:read":true,"forms:update":false,"forms:delete":false,"quotations:create":false,"quotations:read":true,"quotations:update":false,"quotations:delete":false,"templates:create":false,"templates:read":true,"templates:update":false,"templates:delete":false,"tags:create":false,"tags:read":true,"tags:update":false,"tags:delete":false,"media:create":false,"media:read":true,"media:update":false,"media:delete":false,"chatbot:create":false,"chatbot:read":true,"chatbot:update":false,"chatbot:delete":false,"api_keys:create":false,"api_keys:read":true,"api_keys:update":false,"api_keys:delete":false,"employees:create":false,"employees:read":true,"employees:update":false,"employees:delete":false,"attendance:create":false,"attendance:read":true,"attendance:update":false,"attendance:delete":false,"leave:create":false,"leave:read":true,"leave:update":false,"leave:delete":false,"payroll:create":false,"payroll:read":true,"payroll:update":false,"payroll:delete":false,"hr_policies:create":false,"hr_policies:read":true,"hr_policies:update":false,"hr_policies:delete":false,"recruitment:create":false,"recruitment:read":true,"recruitment:update":false,"recruitment:delete":false,"performance:create":false,"performance:read":true,"performance:update":false,"performance:delete":false,"hr_approvals:create":false,"hr_approvals:read":true,"hr_approvals:update":false,"hr_approvals:delete":false,"products:create":false,"products:read":true,"products:update":false,"products:delete":false,"inventory:create":false,"inventory:read":true,"inventory:update":false,"inventory:delete":false,"sales:create":false,"sales:read":true,"sales:update":false,"sales:delete":false,"purchases:create":false,"purchases:read":true,"purchases:update":false,"purchases:delete":false,"pos:create":false,"pos:read":true,"pos:update":false,"pos:delete":false,"accounting:create":false,"accounting:read":true,"accounting:update":false,"accounting:delete":false,"pricing:create":false,"pricing:read":true,"pricing:update":false,"pricing:delete":false,"projects:create":false,"projects:read":true,"projects:update":false,"projects:delete":false,"tasks:create":false,"tasks:read":true,"tasks:update":false,"tasks:delete":false,"sprints:create":false,"sprints:read":true,"sprints:update":false,"sprints:delete":false,"project_invoices:create":false,"project_invoices:read":true,"project_invoices:update":false,"project_invoices:delete":false,"module_crm":true,"module_hr":true,"module_retail":true,"module_projects":true}'::jsonb, true
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
  CROSS JOIN (VALUES
    ('inbox:create', 'crm'),
    ('inbox:read', 'crm'),
    ('inbox:update', 'crm'),
    ('inbox:delete', 'crm'),
    ('contacts:create', 'crm'),
    ('contacts:read', 'crm'),
    ('contacts:update', 'crm'),
    ('contacts:delete', 'crm'),
    ('pipelines:create', 'crm'),
    ('pipelines:read', 'crm'),
    ('pipelines:update', 'crm'),
    ('pipelines:delete', 'crm'),
    ('deals:create', 'crm'),
    ('deals:read', 'crm'),
    ('deals:update', 'crm'),
    ('deals:delete', 'crm'),
    ('broadcasts:create', 'crm'),
    ('broadcasts:read', 'crm'),
    ('broadcasts:update', 'crm'),
    ('broadcasts:delete', 'crm'),
    ('automations:create', 'crm'),
    ('automations:read', 'crm'),
    ('automations:update', 'crm'),
    ('automations:delete', 'crm'),
    ('forms:create', 'crm'),
    ('forms:read', 'crm'),
    ('forms:update', 'crm'),
    ('forms:delete', 'crm'),
    ('quotations:create', 'crm'),
    ('quotations:read', 'crm'),
    ('quotations:update', 'crm'),
    ('quotations:delete', 'crm'),
    ('templates:create', 'crm'),
    ('templates:read', 'crm'),
    ('templates:update', 'crm'),
    ('templates:delete', 'crm'),
    ('tags:create', 'crm'),
    ('tags:read', 'crm'),
    ('tags:update', 'crm'),
    ('tags:delete', 'crm'),
    ('media:create', 'crm'),
    ('media:read', 'crm'),
    ('media:update', 'crm'),
    ('media:delete', 'crm'),
    ('chatbot:create', 'crm'),
    ('chatbot:read', 'crm'),
    ('chatbot:update', 'crm'),
    ('chatbot:delete', 'crm'),
    ('api_keys:create', 'crm'),
    ('api_keys:read', 'crm'),
    ('api_keys:update', 'crm'),
    ('api_keys:delete', 'crm'),
    ('employees:create', 'hr'),
    ('employees:read', 'hr'),
    ('employees:update', 'hr'),
    ('employees:delete', 'hr'),
    ('attendance:create', 'hr'),
    ('attendance:read', 'hr'),
    ('attendance:update', 'hr'),
    ('attendance:delete', 'hr'),
    ('leave:create', 'hr'),
    ('leave:read', 'hr'),
    ('leave:update', 'hr'),
    ('leave:delete', 'hr'),
    ('payroll:create', 'hr'),
    ('payroll:read', 'hr'),
    ('payroll:update', 'hr'),
    ('payroll:delete', 'hr'),
    ('hr_policies:create', 'hr'),
    ('hr_policies:read', 'hr'),
    ('hr_policies:update', 'hr'),
    ('hr_policies:delete', 'hr'),
    ('recruitment:create', 'hr'),
    ('recruitment:read', 'hr'),
    ('recruitment:update', 'hr'),
    ('recruitment:delete', 'hr'),
    ('performance:create', 'hr'),
    ('performance:read', 'hr'),
    ('performance:update', 'hr'),
    ('performance:delete', 'hr'),
    ('hr_approvals:create', 'hr'),
    ('hr_approvals:read', 'hr'),
    ('hr_approvals:update', 'hr'),
    ('hr_approvals:delete', 'hr'),
    ('products:create', 'retail'),
    ('products:read', 'retail'),
    ('products:update', 'retail'),
    ('products:delete', 'retail'),
    ('inventory:create', 'retail'),
    ('inventory:read', 'retail'),
    ('inventory:update', 'retail'),
    ('inventory:delete', 'retail'),
    ('sales:create', 'retail'),
    ('sales:read', 'retail'),
    ('sales:update', 'retail'),
    ('sales:delete', 'retail'),
    ('purchases:create', 'retail'),
    ('purchases:read', 'retail'),
    ('purchases:update', 'retail'),
    ('purchases:delete', 'retail'),
    ('pos:create', 'retail'),
    ('pos:read', 'retail'),
    ('pos:update', 'retail'),
    ('pos:delete', 'retail'),
    ('accounting:create', 'retail'),
    ('accounting:read', 'retail'),
    ('accounting:update', 'retail'),
    ('accounting:delete', 'retail'),
    ('pricing:create', 'retail'),
    ('pricing:read', 'retail'),
    ('pricing:update', 'retail'),
    ('pricing:delete', 'retail'),
    ('projects:create', 'projects'),
    ('projects:read', 'projects'),
    ('projects:update', 'projects'),
    ('projects:delete', 'projects'),
    ('tasks:create', 'projects'),
    ('tasks:read', 'projects'),
    ('tasks:update', 'projects'),
    ('tasks:delete', 'projects'),
    ('sprints:create', 'projects'),
    ('sprints:read', 'projects'),
    ('sprints:update', 'projects'),
    ('sprints:delete', 'projects'),
    ('project_invoices:create', 'projects'),
    ('project_invoices:read', 'projects'),
    ('project_invoices:update', 'projects'),
    ('project_invoices:delete', 'projects')
  ) AS k(key, module)
  WHERE NOT (r.permissions ? k.key)
    -- only grant modules the role already had (073 defaulted these to true)
    AND COALESCE((r.permissions->>('module_' || k.module))::boolean, true) IS TRUE
  GROUP BY r.id
) AS seed
WHERE wr.id = seed.id;

-- Viewers must never gain writes from the blanket seed above.
UPDATE public.workspace_roles
SET permissions = permissions || '{"inbox:create":false,"inbox:update":false,"inbox:delete":false,"contacts:create":false,"contacts:update":false,"contacts:delete":false,"pipelines:create":false,"pipelines:update":false,"pipelines:delete":false,"deals:create":false,"deals:update":false,"deals:delete":false,"broadcasts:create":false,"broadcasts:update":false,"broadcasts:delete":false,"automations:create":false,"automations:update":false,"automations:delete":false,"forms:create":false,"forms:update":false,"forms:delete":false,"quotations:create":false,"quotations:update":false,"quotations:delete":false,"templates:create":false,"templates:update":false,"templates:delete":false,"tags:create":false,"tags:update":false,"tags:delete":false,"media:create":false,"media:update":false,"media:delete":false,"chatbot:create":false,"chatbot:update":false,"chatbot:delete":false,"api_keys:create":false,"api_keys:update":false,"api_keys:delete":false,"employees:create":false,"employees:update":false,"employees:delete":false,"attendance:create":false,"attendance:update":false,"attendance:delete":false,"leave:create":false,"leave:update":false,"leave:delete":false,"payroll:create":false,"payroll:update":false,"payroll:delete":false,"hr_policies:create":false,"hr_policies:update":false,"hr_policies:delete":false,"recruitment:create":false,"recruitment:update":false,"recruitment:delete":false,"performance:create":false,"performance:update":false,"performance:delete":false,"hr_approvals:create":false,"hr_approvals:update":false,"hr_approvals:delete":false,"products:create":false,"products:update":false,"products:delete":false,"inventory:create":false,"inventory:update":false,"inventory:delete":false,"sales:create":false,"sales:update":false,"sales:delete":false,"purchases:create":false,"purchases:update":false,"purchases:delete":false,"pos:create":false,"pos:update":false,"pos:delete":false,"accounting:create":false,"accounting:update":false,"accounting:delete":false,"pricing:create":false,"pricing:update":false,"pricing:delete":false,"projects:create":false,"projects:update":false,"projects:delete":false,"tasks:create":false,"tasks:update":false,"tasks:delete":false,"sprints:create":false,"sprints:update":false,"sprints:delete":false,"project_invoices:create":false,"project_invoices:update":false,"project_invoices:delete":false}'::jsonb
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

-- ---------------------------------------------------------------
-- 5. Per-operation RESTRICTIVE policies.
--
--    to_regclass guards mean a table from an unapplied module
--    migration is skipped rather than aborting the run.
--
--    CRITICAL: a RESTRICTIVE policy only ever subtracts. Postgres
--    grants nothing unless at least one PERMISSIVE policy matches, so
--    enabling RLS on a table that has none would return ZERO rows for
--    every non-service-role caller — including owners. Any table
--    without a permissive policy therefore gets a baseline
--    workspace-membership one first, preserving the access it has
--    today (and closing the tenant hole where RLS was simply off).
-- ---------------------------------------------------------------

DO $crud$
DECLARE
  r RECORD;
  act RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('conversations','inbox','crm'),
      ('contacts','contacts','crm'),
      ('pipelines','pipelines','crm'),
      ('deals','deals','crm'),
      ('broadcasts','broadcasts','crm'),
      ('automations','automations','crm'),
      ('custom_forms','forms','crm'),
      ('quotations','quotations','crm'),
      ('message_templates','templates','crm'),
      ('tags','tags','crm'),
      ('custom_fields','tags','crm'),
      ('media_files','media','crm'),
      ('media_folders','media','crm'),
      ('chatbot_config','chatbot','crm'),
      ('api_keys','api_keys','crm'),
      ('employee_profiles','employees','hr'),
      ('employee_assets','employees','hr'),
      ('employee_documents','employees','hr'),
      ('hr_employees','employees','hr'),
      ('hr_employee_history','employees','hr'),
      ('hr_employee_promotions','employees','hr'),
      ('departments','employees','hr'),
      ('designations','employees','hr'),
      ('attendance','attendance','hr'),
      ('hr_attendance_breaks','attendance','hr'),
      ('hr_attendance_requests','attendance','hr'),
      ('time_logs','attendance','hr'),
      ('hr_shifts','attendance','hr'),
      ('hr_shift_assignments','attendance','hr'),
      ('leave_requests','leave','hr'),
      ('hr_holidays','leave','hr'),
      ('payroll_cycles','payroll','hr'),
      ('payslips','payroll','hr'),
      ('salary_advances','payroll','hr'),
      ('expense_claims','payroll','hr'),
      ('hr_salary_components','payroll','hr'),
      ('hr_salary_structures','payroll','hr'),
      ('hr_policies','hr_policies','hr'),
      ('hr_policy_versions','hr_policies','hr'),
      ('hr_policy_targets','hr_policies','hr'),
      ('hr_policy_acknowledgements','hr_policies','hr'),
      ('hr_policy_notifications','hr_policies','hr'),
      ('hr_operational_settings','hr_policies','hr'),
      ('hr_recruitment_jobs','recruitment','hr'),
      ('hr_candidates','recruitment','hr'),
      ('hr_job_applications','recruitment','hr'),
      ('hr_interviews','recruitment','hr'),
      ('hr_offer_letters','recruitment','hr'),
      ('hr_onboarding_tasks','recruitment','hr'),
      ('hr_onboarding_employee_tasks','recruitment','hr'),
      ('hr_performance_goals','performance','hr'),
      ('hr_performance_reviews','performance','hr'),
      ('hr_review_cycles','performance','hr'),
      ('hr_approval_workflows','hr_approvals','hr'),
      ('hr_approval_instances','hr_approvals','hr'),
      ('hr_employee_requests','hr_approvals','hr'),
      ('hr_audit_logs','hr_approvals','hr'),
      ('commerce_products','products','retail'),
      ('commerce_categories','products','retail'),
      ('commerce_product_attribute_definitions','products','retail'),
      ('master_brands','products','retail'),
      ('commerce_inventory_batches','inventory','retail'),
      ('commerce_inventory_movements','inventory','retail'),
      ('commerce_warehouses','inventory','retail'),
      ('commerce_stock_audits','inventory','retail'),
      ('commerce_stock_transfers','inventory','retail'),
      ('commerce_grn_receipts','inventory','retail'),
      ('commerce_sales_orders','sales','retail'),
      ('commerce_sales_returns','sales','retail'),
      ('commerce_rma_tickets','sales','retail'),
      ('commerce_loyalty_ledger','sales','retail'),
      ('commerce_purchase_orders','purchases','retail'),
      ('commerce_suppliers','purchases','retail'),
      ('commerce_cash_registers','pos','retail'),
      ('commerce_pos_held_bills','pos','retail'),
      ('commerce_chart_of_accounts','accounting','retail'),
      ('commerce_journal_entries','accounting','retail'),
      ('commerce_bank_accounts','accounting','retail'),
      ('commerce_customer_khata','accounting','retail'),
      ('commerce_gst_ledgers','accounting','retail'),
      ('commerce_price_lists','pricing','retail'),
      ('master_cost_centers','pricing','retail'),
      ('commerce_workspace_settings','pricing','retail'),
      ('projects','projects','projects'),
      ('project_automations','projects','projects'),
      ('tasks','tasks','projects'),
      ('workspace_labels','tasks','projects'),
      ('project_invoices','project_invoices','projects')
    ) AS t(tbl, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);

    -- Guarantee a permissive baseline so enabling RLS can't black the
    -- table out. Only added when the table has no permissive policy of
    -- its own; existing ones are left exactly as they are.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND permissive = 'PERMISSIVE'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL '
        'USING (public.is_active_workspace_member(workspace_id, auth.uid())) '
        'WITH CHECK (public.is_active_workspace_member(workspace_id, auth.uid()))',
        'members_baseline', r.tbl);
    END IF;

    FOR act IN
      SELECT * FROM (VALUES ('create','INSERT'), ('read','SELECT'), ('update','UPDATE'), ('delete','DELETE')) AS a(action, op)
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
    SELECT * FROM (VALUES
      ('messages','conversations','conversation_id','inbox','crm'),
      ('contact_tags','contacts','contact_id','contacts','crm'),
      ('contact_notes','contacts','contact_id','contacts','crm'),
      ('contact_custom_values','contacts','contact_id','contacts','crm'),
      ('pipeline_stages','pipelines','pipeline_id','pipelines','crm'),
      ('broadcast_recipients','broadcasts','broadcast_id','broadcasts','crm'),
      ('automation_steps','automations','automation_id','automations','crm'),
      ('automation_logs','automations','automation_id','automations','crm'),
      ('hr_salary_structure_components','hr_salary_structures','structure_id','payroll','hr'),
      ('hr_approval_steps','hr_approval_instances','instance_id','hr_approvals','hr'),
      ('commerce_product_variants','commerce_products','parent_product_id','products','retail'),
      ('commerce_warehouse_stock','commerce_warehouses','warehouse_id','inventory','retail'),
      ('commerce_stock_audit_items','commerce_stock_audits','audit_id','inventory','retail'),
      ('commerce_sales_items','commerce_sales_orders','sales_order_id','sales','retail'),
      ('commerce_purchase_items','commerce_purchase_orders','po_id','purchases','retail'),
      ('commerce_journal_lines','commerce_journal_entries','journal_entry_id','accounting','retail'),
      ('commerce_price_list_items','commerce_price_lists','price_list_id','pricing','retail'),
      ('project_members','projects','project_id','projects','projects'),
      ('project_columns','projects','project_id','projects','projects'),
      ('project_statuses','projects','project_id','projects','projects'),
      ('project_workflows','projects','project_id','projects','projects'),
      ('project_components','projects','project_id','projects','projects'),
      ('project_activity','projects','project_id','projects','projects'),
      ('task_comments','tasks','task_id','tasks','projects'),
      ('task_files','tasks','task_id','tasks','projects'),
      ('task_activity','tasks','task_id','tasks','projects'),
      ('task_components','tasks','task_id','tasks','projects'),
      ('task_labels','tasks','task_id','tasks','projects'),
      ('task_watchers','tasks','task_id','tasks','projects'),
      ('epics','projects','project_id','sprints','projects'),
      ('sprints','projects','project_id','sprints','projects'),
      ('project_invoice_items','project_invoices','invoice_id','project_invoices','projects')
    ) AS t(tbl, parent, fk, resource, module)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NULL OR to_regclass('public.'||r.parent) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND permissive = 'PERMISSIVE'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL '
        'USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.is_active_workspace_member(p.workspace_id, auth.uid()))) '
        'WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I '
        '  AND public.is_active_workspace_member(p.workspace_id, auth.uid())))',
        'members_baseline', r.tbl, r.parent, r.tbl, r.fk, r.parent, r.tbl, r.fk);
    END IF;

    FOR act IN
      SELECT * FROM (VALUES ('create','INSERT'), ('read','SELECT'), ('update','UPDATE'), ('delete','DELETE')) AS a(action, op)
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
$crudc$;

-- ==================== END 074_crud_rbac ====================

