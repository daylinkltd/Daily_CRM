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
