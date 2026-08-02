import { describe, it, expect } from "vitest";
import {
  parseFields,
  keyFromLabel,
  splitFields,
  sumHours,
  meaningfulEntryRows,
  validateEntry,
  type TimesheetField,
} from "./timesheet-templates";

describe("parseFields", () => {
  it("returns nothing for a non-array", () => {
    expect(parseFields(null)).toEqual([]);
    expect(parseFields({ key: "a" })).toEqual([]);
  });

  it("reads a seeded field and keeps its constraints", () => {
    const [f] = parseFields([
      { key: "hours", label: "Hours spent", type: "number", required: true, min: 0, max: 24 },
    ]);
    expect(f).toMatchObject({ key: "hours", type: "number", required: true, min: 0, max: 24 });
  });

  it("falls back to text for an unknown type rather than dropping the field", () => {
    expect(parseFields([{ key: "x", type: "quantum" }])[0].type).toBe("text");
  });

  it("drops entries with no key", () => {
    expect(parseFields([{ label: "orphan" }, { key: "ok" }])).toHaveLength(1);
  });

  it("labels default to the key when absent", () => {
    expect(parseFields([{ key: "blockers" }])[0].label).toBe("blockers");
  });

  it("infers perRow for fields describing one piece of work", () => {
    const fs = parseFields([{ key: "ticket_ids" }, { key: "hours" }, { key: "blockers" }]);
    expect(fs.find((f) => f.key === "ticket_ids")!.perRow).toBe(true);
    expect(fs.find((f) => f.key === "hours")!.perRow).toBe(true);
    expect(fs.find((f) => f.key === "blockers")!.perRow).toBe(false);
  });

  it("honours an explicit perRow override", () => {
    expect(parseFields([{ key: "blockers", perRow: true }])[0].perRow).toBe(true);
  });
});

describe("keyFromLabel", () => {
  it("makes a stable snake_case key", () => {
    expect(keyFromLabel("Hours Spent")).toBe("hours_spent");
    expect(keyFromLabel("What did you build / fix?")).toBe("what_did_you_build_fix");
  });

  it("trims separators from the ends", () => {
    expect(keyFromLabel("  Notes!  ")).toBe("notes");
  });
});

describe("splitFields", () => {
  const f = (key: string, perRow: boolean): TimesheetField => ({
    key, label: key, type: "text", perRow,
  });

  it("separates row columns from day-level questions", () => {
    const { rowFields, dayFields } = splitFields([f("hours", true), f("blockers", false)]);
    expect(rowFields.map((x) => x.key)).toEqual(["hours"]);
    expect(dayFields.map((x) => x.key)).toEqual(["blockers"]);
  });

  it("treats everything as per-row when nothing is marked, so the table is never empty", () => {
    const { rowFields, dayFields } = splitFields([f("a", false), f("b", false)]);
    expect(rowFields).toHaveLength(2);
    expect(dayFields).toHaveLength(0);
  });
});

describe("sumHours", () => {
  it("adds the hours column", () => {
    expect(sumHours([{ hours: "2" }, { hours: "3.5" }])).toBe(5.5);
  });

  it("ignores blank and non-numeric entries", () => {
    expect(sumHours([{ hours: "" }, { hours: "abc" }, { hours: "1" }])).toBe(1);
  });

  it("rounds to two places rather than trailing float noise", () => {
    expect(sumHours([{ hours: "0.1" }, { hours: "0.2" }])).toBe(0.3);
  });
});

describe("meaningfulEntryRows", () => {
  it("keeps only rows with something typed", () => {
    expect(meaningfulEntryRows([{ a: "" }, { a: "x" }, { a: "  " }])).toEqual([{ a: "x" }]);
  });
});

describe("validateEntry", () => {
  const rowFields: TimesheetField[] = [
    { key: "ticket_ids", label: "Tickets", type: "reference_multi", required: true, perRow: true },
    { key: "hours", label: "Hours spent", type: "number", required: true, perRow: true },
  ];
  const dayFields: TimesheetField[] = [
    { key: "blockers", label: "Blockers", type: "textarea", required: true },
  ];

  it("requires at least one row", () => {
    expect(validateEntry([{ ticket_ids: "" }], rowFields, {}, [])).toEqual([
      "Add at least one row describing what you worked on.",
    ]);
  });

  it("counts how many rows are missing a required column", () => {
    const problems = validateEntry(
      [{ ticket_ids: "T-1", hours: "" }, { ticket_ids: "T-2", hours: "" }],
      rowFields, {}, []
    );
    expect(problems.some((p) => p.includes("Hours spent") && p.includes("2 still empty"))).toBe(true);
  });

  it("reports a missing day-level answer", () => {
    const problems = validateEntry([{ ticket_ids: "T-1", hours: "2" }], rowFields, {}, dayFields);
    expect(problems).toEqual(['"Blockers" is required.']);
  });

  it("passes a complete entry", () => {
    expect(
      validateEntry([{ ticket_ids: "T-1", hours: "2" }], rowFields, { blockers: "none" }, dayFields)
    ).toEqual([]);
  });

  it("ignores blank trailing rows rather than failing on them", () => {
    expect(
      validateEntry(
        [{ ticket_ids: "T-1", hours: "2" }, { ticket_ids: "", hours: "" }],
        rowFields, {}, []
      )
    ).toEqual([]);
  });
});
