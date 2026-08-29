// ============================================================
// What can be copied from one workspace into another.
//
// Setting up a second workspace meant rebuilding the handbook, the
// letter templates, the policies, the departments — all of it, by hand,
// even though an identical set already existed next door. Everything
// here is CONFIGURATION: the shapes a company decides once and reuses.
//
// Records are deliberately absent. Employees, letters actually issued,
// attendance, payroll — those belong to the workspace that produced
// them, and duplicating them would put the same person on two payrolls
// and the same numbered letter in two vaults.
//
// Each entry names the table, the columns worth carrying, and the key
// that decides "this already exists here" so a second run adds only
// what is missing.
// ============================================================

export interface CopyableEntity {
  /** Stable id used by the API and the checkboxes. */
  key: string;
  label: string;
  description: string;
  table: string;
  /** Columns copied verbatim. `workspace_id` is always rewritten. */
  columns: string[];
  /** Columns whose combined value identifies a duplicate in the target. */
  matchOn: string[];
  /** Skip rows the source marks as deleted. */
  softDeleteColumn?: string;
  /** Skip rows where this column is true — used to leave built-ins alone. */
  skipWhenTrue?: string;
  /**
   * Child rows to bring along, keyed by the parent's new id. Used where
   * a thing is meaningless without its parts — a policy without its
   * text, a structure without its components.
   */
  children?: {
    table: string;
    parentColumn: string;
    columns: string[];
  }[];
}

export const COPYABLE_ENTITIES: CopyableEntity[] = [
  {
    key: "message_templates",
    label: "Message & letter templates",
    description: "WhatsApp, email and document templates from the template library.",
    table: "templates",
    columns: [
      "module", "channel", "category", "name", "description",
      "subject", "body", "variables", "tags", "requires_approval",
    ],
    matchOn: ["channel", "name"],
    softDeleteColumn: "deleted_at",
  },
  {
    key: "document_templates",
    label: "Document templates",
    description: "Offer letters, appointment letters and the rest of the letter shapes.",
    table: "document_templates",
    columns: [
      "name", "description", "body_html", "body_json",
      "variables", "status", "is_default",
    ],
    matchOn: ["name"],
  },
  {
    key: "signatories",
    label: "Signatories",
    description: "Who signs official documents, with their designation.",
    table: "company_signatories",
    columns: [
      "name", "designation", "department", "email",
      "priority", "signature_url", "stamp_url", "is_default",
    ],
    matchOn: ["name", "designation"],
    softDeleteColumn: "deleted_at",
  },
  {
    key: "hr_policies",
    label: "HR policies",
    description: "Policy definitions and their published text.",
    table: "hr_policies",
    columns: [
      "title", "category", "linked_module",
      "review_frequency_months", "status",
    ],
    matchOn: ["title"],
    children: [
      {
        table: "hr_policy_versions",
        parentColumn: "policy_id",
        columns: [
          "version_number", "content", "change_summary",
          "mandatory", "language", "effective_at",
        ],
      },
    ],
  },
  {
    key: "departments",
    label: "Departments",
    description: "The department list employees are filed under.",
    table: "departments",
    columns: ["name", "description"],
    matchOn: ["name"],
  },
  {
    key: "designations",
    label: "Designations",
    description: "Job titles and their levels.",
    table: "designations",
    columns: ["title", "level", "description"],
    matchOn: ["title"],
  },
  {
    key: "timesheet_templates",
    label: "Timesheet templates",
    description: "What each role is asked to fill in when logging time.",
    table: "hr_timesheet_templates",
    columns: ["name", "description", "role_preset", "icon", "fields_json", "is_active"],
    matchOn: ["name"],
    skipWhenTrue: "is_system",
  },
  {
    key: "holidays",
    label: "Holiday calendar",
    description: "Public and company holidays.",
    table: "hr_holidays",
    columns: ["title", "date", "holiday_type", "recurrence_type", "description"],
    matchOn: ["title", "date"],
  },
  {
    key: "roles",
    label: "Custom roles",
    description:
      "Roles you built in the permission matrix. Built-in roles already exist in every workspace and are skipped.",
    table: "workspace_roles",
    columns: ["name", "description", "permissions"],
    matchOn: ["name"],
    skipWhenTrue: "is_system",
  },
  {
    key: "company_details",
    label: "Company details & handbook",
    description:
      "Legal name, address, working hours, and the welcome / vision / mission text the handbook is built from.",
    table: "company_details",
    columns: [
      "legal_name", "brand_name", "director_name", "registered_address",
      "cin", "website", "contact_email", "contact_phone",
      "welcome_message", "vision", "mission", "core_values",
      "office_start", "office_end", "working_days",
      "lunch_minutes", "break_minutes", "probation_months", "notice_period_days",
    ],
    // One row per workspace, so the workspace itself is the key.
    matchOn: [],
  },
];

export function findCopyable(key: string): CopyableEntity | undefined {
  return COPYABLE_ENTITIES.find((e) => e.key === key);
}

/** Stable signature for "is this the same thing" comparisons. */
export function matchSignature(
  entity: CopyableEntity,
  row: Record<string, unknown>,
): string {
  if (entity.matchOn.length === 0) return "__singleton__";
  return entity.matchOn
    .map((c) => String(row[c] ?? "").trim().toLowerCase())
    .join(" ");
}
