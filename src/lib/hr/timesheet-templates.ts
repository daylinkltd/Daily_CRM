/**
 * Timesheet template field definitions.
 *
 * Migration 086 seeded six templates with a rich `fields_json`, but
 * nothing ever read it — TimeLogForm asked a fixed task/hours/notes
 * regardless. This module is the shared contract so the editor, the entry
 * table and any validation all agree on what a field means.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "reference",
  "reference_multi",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  number: "Number",
  date: "Date",
  select: "Pick from a list",
  reference: "Link to one record",
  reference_multi: "Link to several records",
};

/** Tables a reference field may point at, and what to show for each. */
export const REFERENCE_SOURCES = {
  tasks: { label: "Tasks / tickets", table: "tasks", display: "title" },
  projects: { label: "Projects", table: "projects", display: "name" },
  contacts: { label: "Contacts", table: "contacts", display: "name" },
  pipelines: { label: "Deals", table: "deals", display: "title" },
} as const;
export type ReferenceSource = keyof typeof REFERENCE_SOURCES;

export interface TimesheetField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  source?: ReferenceSource;
  options?: string[];
  min?: number;
  max?: number;
  /** Rendered as its own column in the multi-row entry table. */
  perRow?: boolean;
}

export interface TimesheetTemplate {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  role_preset: string | null;
  icon: string | null;
  fields_json: TimesheetField[];
  is_system: boolean;
  is_active: boolean;
}

/** Parse whatever is in the column into a usable field list. */
export function parseFields(raw: unknown): TimesheetField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({
      key: String(f.key ?? ""),
      label: String(f.label ?? f.key ?? "Field"),
      type: (FIELD_TYPES as readonly string[]).includes(String(f.type))
        ? (f.type as FieldType)
        : "text",
      required: f.required === true,
      source: f.source as ReferenceSource | undefined,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
      min: typeof f.min === "number" ? f.min : undefined,
      max: typeof f.max === "number" ? f.max : undefined,
      // A field is per-row when it describes ONE piece of work: the ticket,
      // its hours, what was done. Everything else (blockers, a daily
      // summary) is asked once for the whole day.
      perRow: f.perRow === true || isNaturallyPerRow(String(f.key ?? "")),
    }))
    .filter((f) => f.key !== "");
}

const PER_ROW_KEYS = [
  "ticket_ids",
  "task_id",
  "project_id",
  "hours",
  "work_done",
  "contact_ids",
  "deal_ids",
  "distance_km",
  "orders_handled",
  "calls_made",
  "meetings_held",
  "tickets_resolved",
  "visits",
];

function isNaturallyPerRow(key: string): boolean {
  return PER_ROW_KEYS.includes(key);
}

/** Turn a label into a stable snake_case key. */
export function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/**
 * Which fields become columns in the entry table, and which are asked once
 * beneath it.
 */
export function splitFields(fields: TimesheetField[]): {
  rowFields: TimesheetField[];
  dayFields: TimesheetField[];
} {
  const rowFields = fields.filter((f) => f.perRow);
  const dayFields = fields.filter((f) => !f.perRow);
  // A template with nothing per-row would render an entry table with no
  // columns, so fall back to treating everything as per-row.
  if (rowFields.length === 0) return { rowFields: fields, dayFields: [] };
  return { rowFields, dayFields };
}

/** Total hours across entry rows, for the footer and for time_logs. */
export function sumHours(rows: Record<string, string>[], hoursKey = "hours"): number {
  const total = rows.reduce((acc, r) => acc + (Number(r[hoursKey]) || 0), 0);
  return Math.round(total * 100) / 100;
}

/** Rows the user actually filled in. */
export function meaningfulEntryRows(
  rows: Record<string, string>[]
): Record<string, string>[] {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
}

/** Blocking problems, phrased for the person filling the form. */
export function validateEntry(
  rows: Record<string, string>[],
  rowFields: TimesheetField[],
  dayValues: Record<string, string>,
  dayFields: TimesheetField[]
): string[] {
  const problems: string[] = [];
  const filled = meaningfulEntryRows(rows);

  if (filled.length === 0) {
    problems.push("Add at least one row describing what you worked on.");
    return problems;
  }

  for (const f of rowFields) {
    if (!f.required) continue;
    const missing = filled.filter((r) => !String(r[f.key] ?? "").trim()).length;
    if (missing > 0) {
      problems.push(`"${f.label}" is required on every row — ${missing} still empty.`);
    }
  }

  for (const f of dayFields) {
    if (f.required && !String(dayValues[f.key] ?? "").trim()) {
      problems.push(`"${f.label}" is required.`);
    }
  }

  return problems;
}
