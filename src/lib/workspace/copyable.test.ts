import { describe, expect, it } from "vitest";

import {
  COPYABLE_ENTITIES,
  findCopyable,
  matchSignature,
} from "./copyable";

describe("copyable catalogue", () => {
  it("has unique keys and tables that are named once", () => {
    const keys = COPYABLE_ENTITIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const tables = COPYABLE_ENTITIES.map((e) => e.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("never carries workspace_id or id in the copied columns", () => {
    // Both are rewritten by the copier; listing them would clone the
    // source row's identity into the target workspace.
    for (const e of COPYABLE_ENTITIES) {
      expect(e.columns).not.toContain("workspace_id");
      expect(e.columns).not.toContain("id");
      for (const child of e.children ?? []) {
        expect(child.columns).not.toContain("workspace_id");
        expect(child.columns).not.toContain("id");
        expect(child.columns).not.toContain(child.parentColumn);
      }
    }
  });

  it("copies configuration only — never people or issued records", () => {
    // A regression guard with teeth: adding employees, payroll or
    // issued documents here would duplicate a person onto two payrolls
    // and put one numbered letter in two vaults.
    const forbidden = [
      "employee_profiles",
      "workspace_members",
      "official_documents",
      "payslips",
      "payroll_cycles",
      "attendance",
      "time_logs",
      "leave_requests",
      "profiles",
    ];
    for (const e of COPYABLE_ENTITIES) {
      expect(forbidden).not.toContain(e.table);
    }
  });

  it("matches every entity on something, or declares itself a singleton", () => {
    for (const e of COPYABLE_ENTITIES) {
      // An empty matchOn means one row per workspace (company_details).
      if (e.matchOn.length === 0) {
        expect(matchSignature(e, { anything: 1 })).toBe("__singleton__");
      } else {
        expect(e.matchOn.every((c) => e.columns.includes(c))).toBe(true);
      }
    }
  });
});

describe("matchSignature", () => {
  const templates = findCopyable("message_templates")!;

  it("treats case and padding as the same thing", () => {
    const a = matchSignature(templates, { channel: "email", name: "Welcome" });
    const b = matchSignature(templates, { channel: "EMAIL", name: "  welcome " });
    expect(a).toBe(b);
  });

  it("separates rows that differ on any key column", () => {
    const email = matchSignature(templates, { channel: "email", name: "Welcome" });
    const wa = matchSignature(templates, { channel: "whatsapp", name: "Welcome" });
    expect(email).not.toBe(wa);
  });

  it("treats a missing key column as empty rather than throwing", () => {
    expect(() => matchSignature(templates, {})).not.toThrow();
  });
});

describe("built-ins are left alone", () => {
  it("skips system rows where a workspace seeds its own", () => {
    // Copying a system role or template would collide with the one the
    // target workspace already seeded at creation.
    for (const key of ["roles", "timesheet_templates"]) {
      expect(findCopyable(key)?.skipWhenTrue).toBe("is_system");
    }
  });

  it("skips soft-deleted rows where the table has that column", () => {
    expect(findCopyable("message_templates")?.softDeleteColumn).toBe("deleted_at");
    expect(findCopyable("signatories")?.softDeleteColumn).toBe("deleted_at");
  });
});
