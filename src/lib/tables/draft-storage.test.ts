import { describe, it, expect } from "vitest";
import {
  draftKey,
  isBlankRow,
  meaningfulRows,
  serializeDraft,
  parseDraft,
  parsePastedGrid,
  DRAFT_MAX_AGE_MS,
} from "./draft-storage";

const NOW = 1_800_000_000_000;

describe("draftKey", () => {
  it("scopes by form and workspace so two tenants never share a draft", () => {
    expect(draftKey("departments", "ws1")).toBe("draft:departments:ws1");
    expect(draftKey("departments", "ws2")).not.toBe(draftKey("departments", "ws1"));
  });

  it("handles a missing workspace", () => {
    expect(draftKey("departments", null)).toBe("draft:departments:none");
  });
});

describe("isBlankRow / meaningfulRows", () => {
  it("treats empty strings, null, undefined and false as blank", () => {
    expect(isBlankRow({ a: "", b: null, c: undefined, d: false })).toBe(true);
  });

  it("a single typed character makes a row meaningful", () => {
    expect(isBlankRow({ a: "", b: "x" })).toBe(false);
  });

  it("keeps only rows with content", () => {
    expect(meaningfulRows([{ n: "a" }, { n: "" }, { n: "b" }])).toEqual([{ n: "a" }, { n: "b" }]);
  });

  it("treats 0 as content, not emptiness", () => {
    expect(isBlankRow({ qty: 0 })).toBe(false);
  });
});

describe("serializeDraft", () => {
  it("returns null when nothing has been typed", () => {
    expect(serializeDraft([{ n: "" }, { n: "" }], 1, NOW)).toBeNull();
  });

  it("stores only the meaningful rows", () => {
    const raw = serializeDraft([{ n: "a" }, { n: "" }], 1, NOW)!;
    expect(JSON.parse(raw).rows).toEqual([{ n: "a" }]);
  });

  it("round-trips through parseDraft", () => {
    const raw = serializeDraft([{ n: "a" }, { n: "b" }], 3, NOW)!;
    expect(parseDraft(raw, 3, NOW)).toEqual([{ n: "a" }, { n: "b" }]);
  });
});

describe("parseDraft", () => {
  it("returns null for missing or malformed data", () => {
    expect(parseDraft(null, 1, NOW)).toBeNull();
    expect(parseDraft("not json", 1, NOW)).toBeNull();
    expect(parseDraft("123", 1, NOW)).toBeNull();
  });

  it("rejects a draft written by a different form version", () => {
    const raw = serializeDraft([{ n: "a" }], 1, NOW)!;
    expect(parseDraft(raw, 2, NOW)).toBeNull();
  });

  it("rejects a stale draft", () => {
    const raw = serializeDraft([{ n: "a" }], 1, NOW)!;
    expect(parseDraft(raw, 1, NOW + DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(parseDraft(raw, 1, NOW + DRAFT_MAX_AGE_MS - 1)).toEqual([{ n: "a" }]);
  });

  it("rejects an empty row list", () => {
    expect(parseDraft(JSON.stringify({ v: 1, at: NOW, rows: [] }), 1, NOW)).toBeNull();
  });

  it("drops non-object entries rather than restoring junk", () => {
    const raw = JSON.stringify({ v: 1, at: NOW, rows: [{ n: "a" }, "oops", null, [1]] });
    expect(parseDraft(raw, 1, NOW)).toEqual([{ n: "a" }]);
  });
});

describe("parsePastedGrid", () => {
  it("splits spreadsheet paste into rows and columns", () => {
    expect(parsePastedGrid("a\tb\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles Windows and old-Mac line endings", () => {
    expect(parsePastedGrid("a\r\nb")).toEqual([["a"], ["b"]]);
    expect(parsePastedGrid("a\rb")).toEqual([["a"], ["b"]]);
  });

  it("ignores blank lines, including a trailing newline", () => {
    expect(parsePastedGrid("a\n\nb\n")).toEqual([["a"], ["b"]]);
  });

  it("returns nothing for empty input", () => {
    expect(parsePastedGrid("")).toEqual([]);
  });

  it("handles a single column paste", () => {
    expect(parsePastedGrid("Sales\nMarketing\nOps")).toEqual([["Sales"], ["Marketing"], ["Ops"]]);
  });
});
