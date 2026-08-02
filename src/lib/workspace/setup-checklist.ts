/**
 * Workspace setup checklist.
 *
 * WHY THIS EXISTS: several settings are load-bearing for output the
 * customer sees, and their absence degrades things silently rather than
 * failing. A missing letterhead means every offer letter goes out reading
 * "Company Legal Name". No signatory means letters are unsigned. No
 * salary structure means the Compensation tab has an empty dropdown. None
 * of that errors — it just produces poor documents, and nobody notices
 * until a candidate does.
 *
 * The rules are pure so they can be unit tested, and so the banner, the
 * setup page and any future onboarding wizard all agree on what "ready"
 * means.
 */

export type SetupSeverity = "blocking" | "recommended";

export interface SetupItem {
  id: string;
  label: string;
  /** What goes wrong while this is missing — shown to the user. */
  consequence: string;
  severity: SetupSeverity;
  href: string;
  /** Only checked when the workspace uses this module. */
  module?: "hr" | "crm" | "accounting";
}

/** What the checker is told about the workspace. */
export interface SetupFacts {
  companyName: boolean;
  logo: boolean;
  letterheadConfigured: boolean;
  taxId: boolean;
  companyAddress: boolean;
  signatoryCount: number;
  departmentCount: number;
  workLocationCount: number;
  salaryStructureCount: number;
  whatsappConnected: boolean;
  modules: { hr: boolean; crm: boolean; accounting: boolean };
}

/**
 * Ordered so the first thing a new workspace sees is the thing with the
 * widest blast radius.
 */
export const SETUP_ITEMS: (SetupItem & { satisfied: (f: SetupFacts) => boolean })[] = [
  {
    id: "company_name",
    label: "Company legal name",
    consequence: "Documents and letters print a placeholder name.",
    severity: "blocking",
    href: "/settings?tab=branding",
    satisfied: (f) => f.companyName,
  },
  {
    id: "company_address",
    label: "Registered address",
    consequence: "Letters and invoices have no address on them.",
    severity: "blocking",
    href: "/settings?tab=branding",
    satisfied: (f) => f.companyAddress,
  },
  {
    id: "letterhead",
    label: "Letterhead",
    consequence:
      "Every offer letter, certificate and official document goes out unbranded.",
    severity: "blocking",
    href: "/settings?tab=branding",
    satisfied: (f) => f.letterheadConfigured,
  },
  {
    id: "signatory",
    label: "An authorised signatory",
    consequence: "Letters are issued unsigned, which makes them unusable.",
    severity: "blocking",
    href: "/documents/signatories",
    satisfied: (f) => f.signatoryCount > 0,
  },
  {
    id: "logo",
    label: "Company logo",
    consequence: "Our logo shows in place of yours.",
    severity: "recommended",
    href: "/settings?tab=branding",
    satisfied: (f) => f.logo,
  },
  {
    id: "tax_id",
    label: "Tax registration number",
    consequence: "Invoices are issued without a GSTIN or tax number.",
    severity: "recommended",
    href: "/settings?tab=branding",
    module: "accounting",
    satisfied: (f) => f.taxId,
  },
  {
    id: "departments",
    label: "At least one department",
    consequence: "Employees cannot be organised or reported on by team.",
    severity: "recommended",
    href: "/departments",
    module: "hr",
    satisfied: (f) => f.departmentCount > 0,
  },
  {
    id: "work_location",
    label: "A work location",
    consequence:
      "Attendance cannot enforce a geofence, so punches are recorded without a boundary.",
    severity: "recommended",
    href: "/settings?tab=hr",
    module: "hr",
    satisfied: (f) => f.workLocationCount > 0,
  },
  {
    id: "salary_structure",
    label: "A salary structure",
    consequence:
      "Compensation must be typed in by hand for every hire, and payroll cannot derive allowances.",
    severity: "recommended",
    href: "/settings?tab=hr",
    module: "hr",
    satisfied: (f) => f.salaryStructureCount > 0,
  },
  {
    id: "whatsapp",
    label: "WhatsApp connection",
    consequence: "Messages and broadcasts cannot be sent.",
    severity: "recommended",
    href: "/settings?tab=whatsapp",
    module: "crm",
    satisfied: (f) => f.whatsappConnected,
  },
];

export interface SetupStatus {
  outstanding: SetupItem[];
  blocking: SetupItem[];
  recommended: SetupItem[];
  completed: number;
  total: number;
  /** True when nothing blocking remains. */
  ready: boolean;
}

/**
 * Items are skipped entirely when their module is off — telling a
 * CRM-only workspace to define a salary structure is noise, and noise is
 * what makes people ignore a checklist.
 */
export function evaluateSetup(facts: SetupFacts): SetupStatus {
  const applicable = SETUP_ITEMS.filter(
    (i) => !i.module || facts.modules[i.module]
  );
  const outstanding = applicable.filter((i) => !i.satisfied(facts));

  return {
    outstanding: outstanding.map(strip),
    blocking: outstanding.filter((i) => i.severity === "blocking").map(strip),
    recommended: outstanding.filter((i) => i.severity === "recommended").map(strip),
    completed: applicable.length - outstanding.length,
    total: applicable.length,
    ready: outstanding.every((i) => i.severity !== "blocking"),
  };
}

function strip(i: SetupItem & { satisfied: unknown }): SetupItem {
  const { satisfied: _ignored, ...rest } = i;
  return rest;
}

/** One line for the banner. Names the worst outstanding item. */
export function setupSummary(status: SetupStatus): string | null {
  if (status.outstanding.length === 0) return null;
  const worst = status.blocking[0] ?? status.recommended[0];
  const others = status.outstanding.length - 1;
  const tail = others > 0 ? ` and ${others} other item${others === 1 ? "" : "s"}` : "";
  return `Set up ${worst.label.toLowerCase()}${tail} — ${worst.consequence}`;
}
