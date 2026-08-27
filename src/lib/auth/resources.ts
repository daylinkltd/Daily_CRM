// ============================================================
// Resource catalog — the single source of truth for RBAC.
//
// Every permission in the app is `<resource>:<action>`, e.g.
// `contacts:read`, `payroll:delete`. This file maps each resource to
// the database tables that hold its data, and the RLS migration is
// GENERATED from this same file (scripts/generate-crud-rls.mjs) so the
// permission matrix in the UI and the database policies can never
// drift apart.
//
// Adding a resource = one entry here + regenerate the migration.
//
// Scoping: a table either carries `workspace_id` itself
// (scope: "workspace") or resolves its workspace through a parent FK
// (scope: { parent, fk }) — the generator emits the matching policy
// shape for each.
// ============================================================

export const MODULE_KEYS = ["crm", "accounting", "hr", "retail", "projects", "bar"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  crm: "CRM",
  accounting: "Accounting",
  hr: "HR",
  retail: "Retail",
  projects: "Projects",
  bar: "Bar & Restaurant Management",
};

/** The four CRUD actions, in matrix column order. */
export const ACTIONS = ["create", "read", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  create: "Create",
  read: "Read",
  update: "Update",
  delete: "Delete",
};

/** SQL operation each action maps to, for policy generation. */
export const ACTION_SQL: Record<Action, "INSERT" | "SELECT" | "UPDATE" | "DELETE"> = {
  create: "INSERT",
  read: "SELECT",
  update: "UPDATE",
  delete: "DELETE",
};

export type TableScope = "workspace" | { parent: string; fk: string };

export interface ResourceTable {
  name: string;
  scope: TableScope;
}

export interface Resource {
  /** Permission namespace — the part before the colon. */
  key: string;
  label: string;
  module: ModuleKey;
  /** Short hint shown under the label in the matrix. */
  description: string;
  tables: ResourceTable[];
}

const ws = (name: string): ResourceTable => ({ name, scope: "workspace" });
const via = (name: string, parent: string, fk: string): ResourceTable => ({
  name,
  scope: { parent, fk },
});

export const RESOURCES: Resource[] = [
  // ── CRM ────────────────────────────────────────────────────────
  {
    key: "inbox",
    label: "Inbox & Conversations",
    module: "crm",
    description: "Chat threads and messages",
    tables: [ws("conversations"), via("messages", "conversations", "conversation_id")],
  },
  {
    key: "contacts",
    label: "Contacts",
    module: "crm",
    description: "Customer records, notes and tags on them",
    tables: [
      ws("contacts"),
      via("contact_tags", "contacts", "contact_id"),
      via("contact_notes", "contacts", "contact_id"),
      via("contact_custom_values", "contacts", "contact_id"),
    ],
  },
  {
    key: "pipelines",
    label: "Pipelines",
    module: "crm",
    description: "Pipeline definitions and their stages",
    tables: [ws("pipelines"), via("pipeline_stages", "pipelines", "pipeline_id")],
  },
  {
    key: "deals",
    label: "Deals",
    module: "crm",
    description: "Deals on the kanban board",
    tables: [ws("deals")],
  },
  {
    key: "broadcasts",
    label: "Broadcasts",
    module: "crm",
    description: "Bulk campaigns and their recipients",
    tables: [
      ws("broadcasts"),
      via("broadcast_recipients", "broadcasts", "broadcast_id"),
    ],
  },
  {
    key: "automations",
    label: "Automations",
    module: "crm",
    description: "Trigger-based workflows and run logs",
    tables: [
      ws("automations"),
      via("automation_steps", "automations", "automation_id"),
      via("automation_logs", "automations", "automation_id"),
    ],
  },
  {
    key: "forms",
    label: "Forms",
    module: "crm",
    description: "Public lead-capture forms",
    tables: [ws("custom_forms")],
  },
  {
    key: "quotations",
    label: "Quotations",
    module: "crm",
    description: "Customer quotes",
    tables: [ws("quotations")],
  },
  {
    key: "commercials",
    label: "Commercials",
    module: "crm",
    description: "Internal costing and margin between deal and quotation",
    tables: [ws("commercials"), ws("commercial_line_items")],
  },
  {
    key: "invoices",
    label: "Invoices",
    module: "crm",
    description: "Customer invoices and their payments",
    tables: [ws("invoices"), ws("invoice_items"), ws("invoice_payments")],
  },
  {
    key: "templates",
    label: "Message Templates",
    module: "crm",
    description: "WhatsApp templates submitted to Meta",
    tables: [ws("message_templates")],
  },
  {
    key: "tags",
    label: "Tags & Custom Fields",
    module: "crm",
    description: "Contact taxonomy",
    tables: [ws("tags"), ws("custom_fields")],
  },
  {
    key: "media",
    label: "Media Library",
    module: "crm",
    description: "Uploaded files and folders",
    tables: [ws("media_files"), ws("media_folders")],
  },
  {
    key: "chatbot",
    label: "AI Chatbot",
    module: "crm",
    description: "Chatbot configuration",
    tables: [ws("chatbot_config")],
  },
  {
    key: "api_keys",
    label: "API Keys",
    module: "crm",
    description: "Public API credentials",
    tables: [ws("api_keys")],
  },

  // ── HR ─────────────────────────────────────────────────────────
  {
    key: "employees",
    label: "Employees",
    module: "hr",
    description: "Employee records, departments, designations",
    tables: [
      ws("employee_profiles"),
      ws("employee_assets"),
      ws("employee_documents"),
      ws("hr_employees"),
      ws("hr_employee_history"),
      ws("hr_employee_promotions"),
      ws("departments"),
      ws("designations"),
    ],
  },
  {
    key: "attendance",
    label: "Attendance & Shifts",
    module: "hr",
    description: "Punches, breaks, shifts, timesheets",
    tables: [
      ws("attendance"),
      ws("hr_attendance_breaks"),
      ws("hr_attendance_requests"),
      ws("time_logs"),
      ws("hr_shifts"),
      ws("hr_shift_assignments"),
    ],
  },
  {
    key: "leave",
    label: "Leave & Holidays",
    module: "hr",
    description: "Leave requests and the holiday calendar",
    tables: [ws("leave_requests"), ws("hr_holidays")],
  },
  {
    key: "payroll",
    label: "Payroll & Salary",
    module: "hr",
    description: "Payslips, salary structures, advances, expense claims",
    tables: [
      ws("payroll_cycles"),
      ws("payslips"),
      ws("salary_advances"),
      ws("expense_claims"),
      ws("hr_salary_components"),
      ws("hr_salary_structures"),
      via("hr_salary_structure_components", "hr_salary_structures", "structure_id"),
    ],
  },
  {
    key: "hr_policies",
    label: "HR Policies",
    module: "hr",
    description: "Policy documents and acknowledgements",
    tables: [
      ws("hr_policies"),
      ws("hr_policy_versions"),
      ws("hr_policy_targets"),
      ws("hr_policy_acknowledgements"),
      ws("hr_policy_notifications"),
      ws("hr_operational_settings"),
    ],
  },
  {
    key: "recruitment",
    label: "Recruitment",
    module: "hr",
    description: "Jobs, candidates, interviews, offers, onboarding",
    tables: [
      ws("hr_recruitment_jobs"),
      ws("hr_candidates"),
      ws("hr_job_applications"),
      ws("hr_interviews"),
      ws("hr_offer_letters"),
      ws("hr_onboarding_tasks"),
      ws("hr_onboarding_employee_tasks"),
    ],
  },
  {
    key: "performance",
    label: "Performance",
    module: "hr",
    description: "Goals, reviews and review cycles",
    tables: [
      ws("hr_performance_goals"),
      ws("hr_performance_reviews"),
      ws("hr_review_cycles"),
    ],
  },
  {
    key: "hr_approvals",
    label: "HR Approvals",
    module: "hr",
    description: "Approval workflows, requests and audit log",
    tables: [
      ws("hr_approval_workflows"),
      ws("hr_approval_instances"),
      via("hr_approval_steps", "hr_approval_instances", "instance_id"),
      ws("hr_employee_requests"),
      ws("hr_audit_logs"),
    ],
  },

  // ── Retail ─────────────────────────────────────────────────────
  {
    key: "products",
    label: "Products & Catalog",
    module: "retail",
    description: "Products, categories, variants, brands",
    tables: [
      ws("commerce_products"),
      ws("commerce_categories"),
      via("commerce_product_variants", "commerce_products", "parent_product_id"),
      ws("commerce_product_attribute_definitions"),
      ws("master_brands"),
    ],
  },
  {
    key: "inventory",
    label: "Inventory & Warehouses",
    module: "retail",
    description: "Stock, batches, transfers, audits, GRN",
    tables: [
      ws("commerce_inventory_batches"),
      ws("commerce_inventory_movements"),
      ws("commerce_warehouses"),
      via("commerce_warehouse_stock", "commerce_warehouses", "warehouse_id"),
      ws("commerce_stock_audits"),
      via("commerce_stock_audit_items", "commerce_stock_audits", "audit_id"),
      ws("commerce_stock_transfers"),
      ws("commerce_grn_receipts"),
    ],
  },
  {
    key: "sales",
    label: "Sales & Invoices",
    module: "retail",
    description: "Sales orders, returns, RMA, loyalty",
    tables: [
      ws("commerce_sales_orders"),
      via("commerce_sales_items", "commerce_sales_orders", "sales_order_id"),
      ws("commerce_sales_returns"),
      ws("commerce_rma_tickets"),
      ws("commerce_loyalty_ledger"),
    ],
  },
  {
    key: "purchases",
    label: "Purchases & Suppliers",
    module: "retail",
    description: "Purchase orders and suppliers",
    tables: [
      ws("commerce_purchase_orders"),
      via("commerce_purchase_items", "commerce_purchase_orders", "po_id"),
      ws("commerce_suppliers"),
    ],
  },
  {
    key: "pos",
    label: "POS Terminal",
    module: "retail",
    description: "Cash registers and held bills",
    tables: [ws("commerce_cash_registers"), ws("commerce_pos_held_bills")],
  },
  {
    key: "accounting",
    label: "Accounting & GST",
    module: "accounting",
    description: "Ledger, journals, khata, bank accounts, GST",
    tables: [
      ws("commerce_chart_of_accounts"),
      ws("commerce_journal_entries"),
      via("commerce_journal_lines", "commerce_journal_entries", "journal_entry_id"),
      ws("commerce_bank_accounts"),
      ws("commerce_customer_khata"),
      ws("commerce_gst_ledgers"),
    ],
  },
  {
    key: "pricing",
    label: "Pricing & Retail Settings",
    module: "retail",
    description: "Price lists, cost centers, retail config",
    tables: [
      ws("commerce_price_lists"),
      via("commerce_price_list_items", "commerce_price_lists", "price_list_id"),
      ws("master_cost_centers"),
      ws("commerce_workspace_settings"),
    ],
  },

  // ── Projects ───────────────────────────────────────────────────
  {
    key: "projects",
    label: "Projects",
    module: "projects",
    description: "Projects, members, boards, workflows",
    tables: [
      ws("projects"),
      via("project_members", "projects", "project_id"),
      via("project_columns", "projects", "project_id"),
      via("project_statuses", "projects", "project_id"),
      via("project_workflows", "projects", "project_id"),
      via("project_components", "projects", "project_id"),
      via("project_activity", "projects", "project_id"),
      ws("project_automations"),
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    module: "projects",
    description: "Tasks, comments, files, labels",
    tables: [
      ws("tasks"),
      via("task_comments", "tasks", "task_id"),
      via("task_files", "tasks", "task_id"),
      via("task_activity", "tasks", "task_id"),
      via("task_components", "tasks", "task_id"),
      via("task_labels", "tasks", "task_id"),
      via("task_watchers", "tasks", "task_id"),
      ws("workspace_labels"),
    ],
  },
  {
    key: "sprints",
    label: "Sprints & Epics",
    module: "projects",
    description: "Agile planning objects",
    tables: [
      via("epics", "projects", "project_id"),
      via("sprints", "projects", "project_id"),
    ],
  },
  {
    key: "project_invoices",
    label: "Project Invoices",
    module: "projects",
    description: "Client billing for projects",
    tables: [
      ws("project_invoices"),
      via("project_invoice_items", "project_invoices", "invoice_id"),
    ],
  },

  // ── Bar & Restaurant Management ──────────────────────────────────
  {
    key: "bar_pos",
    label: "POS & Billing",
    module: "bar",
    description: "Touch POS, Table Billing, Layouts & KDS Kitchen Queue",
    tables: [ws("bar_orders"), ws("bar_tables"), ws("bar_kds_queue")],
  },
  {
    key: "bar_catalog",
    label: "Food & Liquor Catalog",
    module: "bar",
    description: "Food menu items, liquor catalog, and Recipe BOM links",
    tables: [ws("bar_menu_items"), ws("bar_liquor_items"), ws("bar_recipe_boms")],
  },
  {
    key: "bar_inventory",
    label: "Kitchen Raw Stock & KSBCL",
    module: "bar",
    description: "Kitchen stock balances, KSBCL liquor inventory & wastage logs",
    tables: [
      ws("kitchen_raw_materials"),
      ws("kitchen_stock_balances"),
      ws("kitchen_stock_movements"),
      ws("kitchen_wastage_logs"),
    ],
  },
  {
    key: "bar_masters",
    label: "Inventory Masters",
    module: "bar",
    description: "Storage locations, kitchen stations, and supplier masters",
    tables: [ws("kitchen_locations"), ws("kitchen_suppliers")],
  },
];

/** Permission key for a resource + action, e.g. `contacts:read`. */
export function permissionKey(resource: string, action: Action): string {
  return `${resource}:${action}`;
}

/** Every permission key in the catalog — used to build default roles. */
export function allPermissionKeys(): string[] {
  return RESOURCES.flatMap((r) => ACTIONS.map((a) => permissionKey(r.key, a)));
}

export function resourcesByModule(module: ModuleKey): Resource[] {
  return RESOURCES.filter((r) => r.module === module);
}

/**
 * The built-in roles every workspace gets. Owner and Admin are
 * all-powerful (the SQL helper short-circuits on the enum role, so
 * their matrices are informational); Viewer is read-everything with no
 * writes, and is editable so an admin can narrow which modules a
 * viewer sees.
 */
export const DEFAULT_ROLE_NAMES = ["Owner", "Admin", "Viewer"] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];

/** Build the permission map for a built-in role. */
export function defaultRolePermissions(
  role: DefaultRoleName,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      out[permissionKey(resource.key, action)] =
        role === "Viewer" ? action === "read" : true;
    }
  }
  for (const m of MODULE_KEYS) out[`module_${m}`] = true;
  return out;
}
