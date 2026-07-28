-- ============================================================
-- 064: Enforce viewer read-only on the feature-module tables.
--
-- Follow-up to 063_viewer_read_only.sql, which split the CRM core
-- tables' "any active member can do everything" FOR ALL policies
-- into writer-manage + member-view pairs but left the feature
-- modules (projects, payroll, HRMS, commerce, retail — migrations
-- 039+) untouched.
--
-- Depends on 063 (is_active_workspace_writer helper) being applied.
--
-- Same pattern as 063 for every table below:
--   - DROP the old "any active member can manage" FOR ALL policy;
--   - CREATE a FOR ALL policy gated on is_active_workspace_writer;
--   - CREATE a FOR SELECT policy gated on is_active_workspace_member.
--   Policies are permissive (OR'd), so viewers keep read access
--   through the SELECT policy while INSERT/UPDATE/DELETE now
--   require a non-viewer role. (A FOR ALL policy's WITH CHECK
--   defaults to its USING clause, so inserts are covered.)
--   Tables whose policies scope through a parent row keep their
--   original EXISTS-subquery shape.
--
-- Covered: 039 people & projects, 040 payroll, 042/043/045/046
-- project management sprints, 052 hr_employee_requests insert,
-- 053 commerce & platform DDD, 054 accounting, 055 GST,
-- 056 attendance & breaks, 057-061 enterprise retail.
--
-- NOT covered (pre-existing, intentionally left as-is):
--   - 042 task_activity "Allow trigger to insert" (USING true)
--     backs the log_task_activity trigger; its member SELECT
--     policy is already read-only.
--   - 050/051/052 "Admins can manage ..." policies are already
--     gated on has_workspace_permission(); a viewer only passes
--     those if explicitly granted a custom ABAC role, which is an
--     app-layer decision, not plain membership.
--   - 050 "Members can insert own hr_policy_acknowledgements":
--     acknowledging a policy is the read-path counterpart, and 050
--     was not part of the member-writable audit list.
--   - 061 platform_audit_logs only ever had a member SELECT policy.
-- ============================================================


-- ---------------------------------------------------------------------------
-- 039: People (HR) & Projects
-- ---------------------------------------------------------------------------

-- Departments
DROP POLICY IF EXISTS "Active members can manage departments" ON public.departments;
CREATE POLICY "Writers can manage departments" ON public.departments
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view departments" ON public.departments
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Designations
DROP POLICY IF EXISTS "Active members can manage designations" ON public.designations;
CREATE POLICY "Writers can manage designations" ON public.designations
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view designations" ON public.designations
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Employee Profiles
DROP POLICY IF EXISTS "Active members can manage employee_profiles" ON public.employee_profiles;
CREATE POLICY "Writers can manage employee_profiles" ON public.employee_profiles
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view employee_profiles" ON public.employee_profiles
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Attendance
DROP POLICY IF EXISTS "Active members can manage attendance" ON public.attendance;
CREATE POLICY "Writers can manage attendance" ON public.attendance
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view attendance" ON public.attendance
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Leave Requests
DROP POLICY IF EXISTS "Active members can manage leave_requests" ON public.leave_requests;
CREATE POLICY "Writers can manage leave_requests" ON public.leave_requests
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view leave_requests" ON public.leave_requests
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Employee Assets
DROP POLICY IF EXISTS "Active members can manage employee_assets" ON public.employee_assets;
CREATE POLICY "Writers can manage employee_assets" ON public.employee_assets
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view employee_assets" ON public.employee_assets
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Employee Documents
DROP POLICY IF EXISTS "Active members can manage employee_documents" ON public.employee_documents;
CREATE POLICY "Writers can manage employee_documents" ON public.employee_documents
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view employee_documents" ON public.employee_documents
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Projects
DROP POLICY IF EXISTS "Active members can manage projects" ON public.projects;
CREATE POLICY "Writers can manage projects" ON public.projects
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view projects" ON public.projects
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Project Members
DROP POLICY IF EXISTS "Active members can manage project_members" ON public.project_members;
CREATE POLICY "Writers can manage project_members" ON public.project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_members.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_members.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Project Columns
DROP POLICY IF EXISTS "Active members can manage project_columns" ON public.project_columns;
CREATE POLICY "Writers can manage project_columns" ON public.project_columns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_columns.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_columns" ON public.project_columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_columns.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Project Activity
DROP POLICY IF EXISTS "Active members can manage project_activity" ON public.project_activity;
CREATE POLICY "Writers can manage project_activity" ON public.project_activity
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_activity.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_activity" ON public.project_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_activity.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Tasks
DROP POLICY IF EXISTS "Active members can manage tasks" ON public.tasks;
CREATE POLICY "Writers can manage tasks" ON public.tasks
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view tasks" ON public.tasks
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Task Comments
DROP POLICY IF EXISTS "Active members can manage task_comments" ON public.task_comments;
CREATE POLICY "Writers can manage task_comments" ON public.task_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_comments.task_id
      AND public.is_active_workspace_writer(tasks.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view task_comments" ON public.task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_comments.task_id
      AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    )
  );

-- Task Files
DROP POLICY IF EXISTS "Active members can manage task_files" ON public.task_files;
CREATE POLICY "Writers can manage task_files" ON public.task_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_files.task_id
      AND public.is_active_workspace_writer(tasks.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view task_files" ON public.task_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_files.task_id
      AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    )
  );

-- Time Logs
DROP POLICY IF EXISTS "Active members can manage time_logs" ON public.time_logs;
CREATE POLICY "Writers can manage time_logs" ON public.time_logs
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view time_logs" ON public.time_logs
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 040: Payroll Management
-- ---------------------------------------------------------------------------

-- Payroll Cycles
DROP POLICY IF EXISTS "Active members can manage payroll_cycles" ON public.payroll_cycles;
CREATE POLICY "Writers can manage payroll_cycles" ON public.payroll_cycles
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view payroll_cycles" ON public.payroll_cycles
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Expense Claims
DROP POLICY IF EXISTS "Active members can manage expense_claims" ON public.expense_claims;
CREATE POLICY "Writers can manage expense_claims" ON public.expense_claims
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view expense_claims" ON public.expense_claims
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Salary Advances
DROP POLICY IF EXISTS "Active members can manage salary_advances" ON public.salary_advances;
CREATE POLICY "Writers can manage salary_advances" ON public.salary_advances
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view salary_advances" ON public.salary_advances
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Payslips
DROP POLICY IF EXISTS "Active members can manage payslips" ON public.payslips;
CREATE POLICY "Writers can manage payslips" ON public.payslips
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view payslips" ON public.payslips
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 042: Project Management Sprint 2 (sprints, epics, labels, components)
-- ---------------------------------------------------------------------------

-- Sprints
DROP POLICY IF EXISTS "Active members can manage sprints" ON public.sprints;
CREATE POLICY "Writers can manage sprints" ON public.sprints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sprints.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view sprints" ON public.sprints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sprints.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Epics
DROP POLICY IF EXISTS "Active members can manage epics" ON public.epics;
CREATE POLICY "Writers can manage epics" ON public.epics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = epics.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view epics" ON public.epics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = epics.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Workspace Labels
DROP POLICY IF EXISTS "Active members can manage workspace_labels" ON public.workspace_labels;
CREATE POLICY "Writers can manage workspace_labels" ON public.workspace_labels
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace_labels" ON public.workspace_labels
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Project Components
DROP POLICY IF EXISTS "Active members can manage project_components" ON public.project_components;
CREATE POLICY "Writers can manage project_components" ON public.project_components
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_components.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_components" ON public.project_components
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_components.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Task Labels
DROP POLICY IF EXISTS "Active members can manage task_labels" ON public.task_labels;
CREATE POLICY "Writers can manage task_labels" ON public.task_labels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_labels.task_id
      AND public.is_active_workspace_writer(tasks.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view task_labels" ON public.task_labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_labels.task_id
      AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    )
  );

-- Task Components
DROP POLICY IF EXISTS "Active members can manage task_components" ON public.task_components;
CREATE POLICY "Writers can manage task_components" ON public.task_components
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_components.task_id
      AND public.is_active_workspace_writer(tasks.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view task_components" ON public.task_components
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_components.task_id
      AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    )
  );

-- Task Watchers
DROP POLICY IF EXISTS "Active members can manage task_watchers" ON public.task_watchers;
CREATE POLICY "Writers can manage task_watchers" ON public.task_watchers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_watchers.task_id
      AND public.is_active_workspace_writer(tasks.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view task_watchers" ON public.task_watchers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_watchers.task_id
      AND public.is_active_workspace_member(tasks.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 043: Project Management Sprint 3 (statuses, workflows)
-- ---------------------------------------------------------------------------

-- Project Statuses
DROP POLICY IF EXISTS "Active members can manage project_statuses" ON public.project_statuses;
CREATE POLICY "Writers can manage project_statuses" ON public.project_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_statuses.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_statuses" ON public.project_statuses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_statuses.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );

-- Project Workflows
DROP POLICY IF EXISTS "Active members can manage project_workflows" ON public.project_workflows;
CREATE POLICY "Writers can manage project_workflows" ON public.project_workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_workflows.project_id
      AND public.is_active_workspace_writer(projects.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view project_workflows" ON public.project_workflows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_workflows.project_id
      AND public.is_active_workspace_member(projects.workspace_id, auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 045: Project Management Sprint 6 (automations)
-- ---------------------------------------------------------------------------

-- Project Automations
DROP POLICY IF EXISTS "Active members can manage project_automations" ON public.project_automations;
CREATE POLICY "Writers can manage project_automations" ON public.project_automations
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view project_automations" ON public.project_automations
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 046: Project Management Sprint 7 (invoices)
-- ---------------------------------------------------------------------------

-- Project Invoices
DROP POLICY IF EXISTS "Active members can manage project_invoices" ON public.project_invoices;
CREATE POLICY "Writers can manage project_invoices" ON public.project_invoices
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view project_invoices" ON public.project_invoices
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Project Invoice Items
DROP POLICY IF EXISTS "Active members can manage project_invoice_items" ON public.project_invoice_items;
CREATE POLICY "Writers can manage project_invoice_items" ON public.project_invoice_items
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view project_invoice_items" ON public.project_invoice_items
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 052: Enterprise HRMS Extensions
-- The "Admins manage hr_*" FOR ALL policies are already gated on
-- has_workspace_permission() and stay as-is. The only plain-member write
-- path is the self-service request INSERT, which viewers must not have.
-- The member SELECT policy from 052 already exists and is kept.
-- ---------------------------------------------------------------------------

-- HR Employee Requests (self-service insert)
DROP POLICY IF EXISTS "Members insert own hr_employee_requests" ON public.hr_employee_requests;
CREATE POLICY "Writers insert own hr_employee_requests" ON public.hr_employee_requests
  FOR INSERT WITH CHECK (public.is_active_workspace_writer(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 053: Commerce & Platform DDD
-- ---------------------------------------------------------------------------

-- Commerce Categories
DROP POLICY IF EXISTS "Active members can manage commerce_categories" ON public.commerce_categories;
CREATE POLICY "Writers can manage commerce_categories" ON public.commerce_categories
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_categories" ON public.commerce_categories
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Products
DROP POLICY IF EXISTS "Active members can manage commerce_products" ON public.commerce_products;
CREATE POLICY "Writers can manage commerce_products" ON public.commerce_products
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_products" ON public.commerce_products
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Inventory Batches
DROP POLICY IF EXISTS "Active members can manage commerce_inventory_batches" ON public.commerce_inventory_batches;
CREATE POLICY "Writers can manage commerce_inventory_batches" ON public.commerce_inventory_batches
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_inventory_batches" ON public.commerce_inventory_batches
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Inventory Movements
DROP POLICY IF EXISTS "Active members can manage commerce_inventory_movements" ON public.commerce_inventory_movements;
CREATE POLICY "Writers can manage commerce_inventory_movements" ON public.commerce_inventory_movements
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_inventory_movements" ON public.commerce_inventory_movements
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Suppliers
DROP POLICY IF EXISTS "Active members can manage commerce_suppliers" ON public.commerce_suppliers;
CREATE POLICY "Writers can manage commerce_suppliers" ON public.commerce_suppliers
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_suppliers" ON public.commerce_suppliers
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Purchase Orders
DROP POLICY IF EXISTS "Active members can manage commerce_purchase_orders" ON public.commerce_purchase_orders;
CREATE POLICY "Writers can manage commerce_purchase_orders" ON public.commerce_purchase_orders
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_purchase_orders" ON public.commerce_purchase_orders
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Purchase Items
DROP POLICY IF EXISTS "Active members can manage commerce_purchase_items" ON public.commerce_purchase_items;
CREATE POLICY "Writers can manage commerce_purchase_items" ON public.commerce_purchase_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_purchase_orders
      WHERE commerce_purchase_orders.id = commerce_purchase_items.po_id
      AND public.is_active_workspace_writer(commerce_purchase_orders.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view commerce_purchase_items" ON public.commerce_purchase_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_purchase_orders
      WHERE commerce_purchase_orders.id = commerce_purchase_items.po_id
      AND public.is_active_workspace_member(commerce_purchase_orders.workspace_id, auth.uid())
    )
  );

-- Commerce Sales Orders
DROP POLICY IF EXISTS "Active members can manage commerce_sales_orders" ON public.commerce_sales_orders;
CREATE POLICY "Writers can manage commerce_sales_orders" ON public.commerce_sales_orders
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_sales_orders" ON public.commerce_sales_orders
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Commerce Sales Items
DROP POLICY IF EXISTS "Active members can manage commerce_sales_items" ON public.commerce_sales_items;
CREATE POLICY "Writers can manage commerce_sales_items" ON public.commerce_sales_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_sales_orders
      WHERE commerce_sales_orders.id = commerce_sales_items.sales_order_id
      AND public.is_active_workspace_writer(commerce_sales_orders.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view commerce_sales_items" ON public.commerce_sales_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_sales_orders
      WHERE commerce_sales_orders.id = commerce_sales_items.sales_order_id
      AND public.is_active_workspace_member(commerce_sales_orders.workspace_id, auth.uid())
    )
  );

-- Commerce Cash Registers
DROP POLICY IF EXISTS "Active members can manage commerce_cash_registers" ON public.commerce_cash_registers;
CREATE POLICY "Writers can manage commerce_cash_registers" ON public.commerce_cash_registers
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_cash_registers" ON public.commerce_cash_registers
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Platform Domain Events
DROP POLICY IF EXISTS "Active members can manage platform_domain_events" ON public.platform_domain_events;
CREATE POLICY "Writers can manage platform_domain_events" ON public.platform_domain_events
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view platform_domain_events" ON public.platform_domain_events
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 054: Accounting & Ledger System
-- ---------------------------------------------------------------------------

-- Chart of Accounts
DROP POLICY IF EXISTS "Active members can manage chart_of_accounts" ON public.commerce_chart_of_accounts;
CREATE POLICY "Writers can manage chart_of_accounts" ON public.commerce_chart_of_accounts
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view chart_of_accounts" ON public.commerce_chart_of_accounts
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Bank Accounts
DROP POLICY IF EXISTS "Active members can manage bank_accounts" ON public.commerce_bank_accounts;
CREATE POLICY "Writers can manage bank_accounts" ON public.commerce_bank_accounts
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view bank_accounts" ON public.commerce_bank_accounts
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Journal Entries
DROP POLICY IF EXISTS "Active members can manage journal_entries" ON public.commerce_journal_entries;
CREATE POLICY "Writers can manage journal_entries" ON public.commerce_journal_entries
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view journal_entries" ON public.commerce_journal_entries
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Journal Lines
DROP POLICY IF EXISTS "Active members can manage journal_lines" ON public.commerce_journal_lines;
CREATE POLICY "Writers can manage journal_lines" ON public.commerce_journal_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_journal_entries
      WHERE commerce_journal_entries.id = commerce_journal_lines.journal_entry_id
      AND public.is_active_workspace_writer(commerce_journal_entries.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view journal_lines" ON public.commerce_journal_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_journal_entries
      WHERE commerce_journal_entries.id = commerce_journal_lines.journal_entry_id
      AND public.is_active_workspace_member(commerce_journal_entries.workspace_id, auth.uid())
    )
  );

-- Customer Khata
DROP POLICY IF EXISTS "Active members can manage customer_khata" ON public.commerce_customer_khata;
CREATE POLICY "Writers can manage customer_khata" ON public.commerce_customer_khata
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view customer_khata" ON public.commerce_customer_khata
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 055: GST Tax Module
-- ---------------------------------------------------------------------------

-- GST Ledgers
DROP POLICY IF EXISTS "Active members can manage commerce_gst_ledgers" ON public.commerce_gst_ledgers;
CREATE POLICY "Writers can manage commerce_gst_ledgers" ON public.commerce_gst_ledgers
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_gst_ledgers" ON public.commerce_gst_ledgers
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 056: Enterprise Attendance & Breaks
-- ---------------------------------------------------------------------------

-- Attendance Breaks
DROP POLICY IF EXISTS "Active members can manage hr_attendance_breaks" ON public.hr_attendance_breaks;
CREATE POLICY "Writers can manage hr_attendance_breaks" ON public.hr_attendance_breaks
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view hr_attendance_breaks" ON public.hr_attendance_breaks
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Attendance Requests
DROP POLICY IF EXISTS "Active members can manage hr_attendance_requests" ON public.hr_attendance_requests;
CREATE POLICY "Writers can manage hr_attendance_requests" ON public.hr_attendance_requests
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view hr_attendance_requests" ON public.hr_attendance_requests
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 057: Enterprise Retail Schema Expansion
-- ---------------------------------------------------------------------------

-- POS Held Bills
DROP POLICY IF EXISTS "Active members can manage commerce_pos_held_bills" ON public.commerce_pos_held_bills;
CREATE POLICY "Writers can manage commerce_pos_held_bills" ON public.commerce_pos_held_bills
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_pos_held_bills" ON public.commerce_pos_held_bills
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 058: Enterprise Retail Missing Modules
-- ---------------------------------------------------------------------------

-- Warehouses
DROP POLICY IF EXISTS "Active members can manage commerce_warehouses" ON public.commerce_warehouses;
CREATE POLICY "Writers can manage commerce_warehouses" ON public.commerce_warehouses
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view commerce_warehouses" ON public.commerce_warehouses
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Warehouse Stock
DROP POLICY IF EXISTS "Active members can manage warehouse stock" ON public.commerce_warehouse_stock;
CREATE POLICY "Writers can manage warehouse stock" ON public.commerce_warehouse_stock
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_warehouses
      WHERE commerce_warehouses.id = commerce_warehouse_stock.warehouse_id
      AND public.is_active_workspace_writer(commerce_warehouses.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view warehouse stock" ON public.commerce_warehouse_stock
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_warehouses
      WHERE commerce_warehouses.id = commerce_warehouse_stock.warehouse_id
      AND public.is_active_workspace_member(commerce_warehouses.workspace_id, auth.uid())
    )
  );

-- Stock Transfers
DROP POLICY IF EXISTS "Active members can manage stock transfers" ON public.commerce_stock_transfers;
CREATE POLICY "Writers can manage stock transfers" ON public.commerce_stock_transfers
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view stock transfers" ON public.commerce_stock_transfers
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Price Lists
DROP POLICY IF EXISTS "Active members can manage price lists" ON public.commerce_price_lists;
CREATE POLICY "Writers can manage price lists" ON public.commerce_price_lists
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view price lists" ON public.commerce_price_lists
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Price List Items
DROP POLICY IF EXISTS "Active members can manage price list items" ON public.commerce_price_list_items;
CREATE POLICY "Writers can manage price list items" ON public.commerce_price_list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_price_lists
      WHERE commerce_price_lists.id = commerce_price_list_items.price_list_id
      AND public.is_active_workspace_writer(commerce_price_lists.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view price list items" ON public.commerce_price_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_price_lists
      WHERE commerce_price_lists.id = commerce_price_list_items.price_list_id
      AND public.is_active_workspace_member(commerce_price_lists.workspace_id, auth.uid())
    )
  );

-- Stock Audits
DROP POLICY IF EXISTS "Active members can manage stock audits" ON public.commerce_stock_audits;
CREATE POLICY "Writers can manage stock audits" ON public.commerce_stock_audits
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view stock audits" ON public.commerce_stock_audits
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Stock Audit Items
DROP POLICY IF EXISTS "Active members can manage audit items" ON public.commerce_stock_audit_items;
CREATE POLICY "Writers can manage audit items" ON public.commerce_stock_audit_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_stock_audits
      WHERE commerce_stock_audits.id = commerce_stock_audit_items.audit_id
      AND public.is_active_workspace_writer(commerce_stock_audits.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view audit items" ON public.commerce_stock_audit_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_stock_audits
      WHERE commerce_stock_audits.id = commerce_stock_audit_items.audit_id
      AND public.is_active_workspace_member(commerce_stock_audits.workspace_id, auth.uid())
    )
  );

-- GRN Receipts
DROP POLICY IF EXISTS "Active members can manage grn receipts" ON public.commerce_grn_receipts;
CREATE POLICY "Writers can manage grn receipts" ON public.commerce_grn_receipts
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view grn receipts" ON public.commerce_grn_receipts
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Sales Returns
DROP POLICY IF EXISTS "Active members can manage sales returns" ON public.commerce_sales_returns;
CREATE POLICY "Writers can manage sales returns" ON public.commerce_sales_returns
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view sales returns" ON public.commerce_sales_returns
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- RMA Tickets
DROP POLICY IF EXISTS "Active members can manage rma tickets" ON public.commerce_rma_tickets;
CREATE POLICY "Writers can manage rma tickets" ON public.commerce_rma_tickets
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view rma tickets" ON public.commerce_rma_tickets
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Loyalty Ledger
DROP POLICY IF EXISTS "Active members can manage loyalty ledger" ON public.commerce_loyalty_ledger;
CREATE POLICY "Writers can manage loyalty ledger" ON public.commerce_loyalty_ledger
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view loyalty ledger" ON public.commerce_loyalty_ledger
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 059: Enterprise Retail Configuration Engine
-- ---------------------------------------------------------------------------

-- Workspace Settings
DROP POLICY IF EXISTS "Active members can manage workspace settings" ON public.commerce_workspace_settings;
CREATE POLICY "Writers can manage workspace settings" ON public.commerce_workspace_settings
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view workspace settings" ON public.commerce_workspace_settings
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Product Attribute Definitions
DROP POLICY IF EXISTS "Active members can manage attribute definitions" ON public.commerce_product_attribute_definitions;
CREATE POLICY "Writers can manage attribute definitions" ON public.commerce_product_attribute_definitions
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view attribute definitions" ON public.commerce_product_attribute_definitions
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Product Variants
DROP POLICY IF EXISTS "Active members can manage product variants" ON public.commerce_product_variants;
CREATE POLICY "Writers can manage product variants" ON public.commerce_product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_products
      WHERE commerce_products.id = commerce_product_variants.parent_product_id
      AND public.is_active_workspace_writer(commerce_products.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view product variants" ON public.commerce_product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_products
      WHERE commerce_products.id = commerce_product_variants.parent_product_id
      AND public.is_active_workspace_member(commerce_products.workspace_id, auth.uid())
    )
  );

-- Master Brands
DROP POLICY IF EXISTS "Active members can manage master_brands" ON public.master_brands;
CREATE POLICY "Writers can manage master_brands" ON public.master_brands
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view master_brands" ON public.master_brands
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Master Cost Centers
DROP POLICY IF EXISTS "Active members can manage master_cost_centers" ON public.master_cost_centers;
CREATE POLICY "Writers can manage master_cost_centers" ON public.master_cost_centers
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view master_cost_centers" ON public.master_cost_centers
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Feature Flags
DROP POLICY IF EXISTS "Active members can manage feature flags" ON public.saas_workspace_feature_flags;
CREATE POLICY "Writers can manage feature flags" ON public.saas_workspace_feature_flags
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view feature flags" ON public.saas_workspace_feature_flags
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 060: Enterprise Promotions Engine
-- ---------------------------------------------------------------------------

-- Promotion Campaigns
DROP POLICY IF EXISTS "Active members can manage promotion campaigns" ON public.commerce_promotion_campaigns;
CREATE POLICY "Writers can manage promotion campaigns" ON public.commerce_promotion_campaigns
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view promotion campaigns" ON public.commerce_promotion_campaigns
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- Promotion Targets
DROP POLICY IF EXISTS "Active members can manage promotion targets" ON public.commerce_promotion_targets;
CREATE POLICY "Writers can manage promotion targets" ON public.commerce_promotion_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_targets.campaign_id
      AND public.is_active_workspace_writer(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view promotion targets" ON public.commerce_promotion_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_targets.campaign_id
      AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );

-- Promotion Benefits
DROP POLICY IF EXISTS "Active members can manage promotion benefits" ON public.commerce_promotion_benefits;
CREATE POLICY "Writers can manage promotion benefits" ON public.commerce_promotion_benefits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_benefits.campaign_id
      AND public.is_active_workspace_writer(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view promotion benefits" ON public.commerce_promotion_benefits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_benefits.campaign_id
      AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );

-- Promotion Usage
DROP POLICY IF EXISTS "Active members can manage promotion usage" ON public.commerce_promotion_usage;
CREATE POLICY "Writers can manage promotion usage" ON public.commerce_promotion_usage
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_usage.campaign_id
      AND public.is_active_workspace_writer(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view promotion usage" ON public.commerce_promotion_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commerce_promotion_campaigns
      WHERE commerce_promotion_campaigns.id = commerce_promotion_usage.campaign_id
      AND public.is_active_workspace_member(commerce_promotion_campaigns.workspace_id, auth.uid())
    )
  );

-- Customer Credit Risk
DROP POLICY IF EXISTS "Active members can manage credit risk" ON public.commerce_customer_credit_risk;
CREATE POLICY "Writers can manage credit risk" ON public.commerce_customer_credit_risk
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view credit risk" ON public.commerce_customer_credit_risk
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 061: Enterprise Platform Engines
-- ---------------------------------------------------------------------------

-- Number Series
DROP POLICY IF EXISTS "Active members can manage number_series" ON public.platform_number_series;
CREATE POLICY "Writers can manage number_series" ON public.platform_number_series
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view number_series" ON public.platform_number_series
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- DMS Documents
DROP POLICY IF EXISTS "Active members can manage dms documents" ON public.platform_dms_documents;
CREATE POLICY "Writers can manage dms documents" ON public.platform_dms_documents
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view dms documents" ON public.platform_dms_documents
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- DMS Links
DROP POLICY IF EXISTS "Active members can manage dms links" ON public.platform_dms_links;
CREATE POLICY "Writers can manage dms links" ON public.platform_dms_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.platform_dms_documents
      WHERE platform_dms_documents.id = platform_dms_links.document_id
      AND public.is_active_workspace_writer(platform_dms_documents.workspace_id, auth.uid())
    )
  );
CREATE POLICY "Active members can view dms links" ON public.platform_dms_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_dms_documents
      WHERE platform_dms_documents.id = platform_dms_links.document_id
      AND public.is_active_workspace_member(platform_dms_documents.workspace_id, auth.uid())
    )
  );

-- Policy Rules
DROP POLICY IF EXISTS "Active members can manage policy rules" ON public.platform_policy_rules;
CREATE POLICY "Writers can manage policy rules" ON public.platform_policy_rules
  FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()));
CREATE POLICY "Active members can view policy rules" ON public.platform_policy_rules
  FOR SELECT USING (public.is_active_workspace_member(workspace_id, auth.uid()));
