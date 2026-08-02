import { describe, it, expect } from "vitest";
import {
  draftKey,
  isBlankRow,
  meaningfulRows,
  serializeDraft,
  parseDraft,
  parsePastedGrid,
  DRAFT_MAX_AGE_MS,
  shouldStoreTextDraft,
  serializeTextDraft,
  parseTextDraft,
  describeAge,
  TEXT_DRAFT_MAX_AGE_MS,
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

describe("text drafts (rich editor recovery)", () => {
  const NOW = 1_800_000_000_000;

  describe("shouldStoreTextDraft", () => {
    it("stores real content that differs from the server value", () => {
      expect(shouldStoreTextDraft("<p>New policy text</p>", "<p>Old</p>")).toBe(true);
    });

    it("does not store an empty editor", () => {
      expect(shouldStoreTextDraft("", "<p>Old</p>")).toBe(false);
      expect(shouldStoreTextDraft("<p></p>", "")).toBe(false);
      expect(shouldStoreTextDraft("<p><br></p>", "")).toBe(false);
    });

    it("does not store content identical to the server value, ignoring markup", () => {
      expect(shouldStoreTextDraft("<h1>Same</h1>", "<p>Same</p>")).toBe(false);
      expect(shouldStoreTextDraft("<p>Same&nbsp;text</p>", "<p>Same text</p>")).toBe(false);
    });
  });

  describe("parseTextDraft", () => {
    const make = (html: string, base = "", at = NOW) =>
      serializeTextDraft(html, base, at)!;

    it("offers a draft that differs from what is on screen", () => {
      const d = parseTextDraft(make("<p>Long unsaved policy</p>"), "", NOW)!;
      expect(d.html).toContain("Long unsaved policy");
      expect(d.baseChanged).toBe(false);
    });

    it("returns null for junk or a missing draft", () => {
      expect(parseTextDraft(null, "", NOW)).toBeNull();
      expect(parseTextDraft("not json", "", NOW)).toBeNull();
      expect(parseTextDraft('{"v":2,"at":1,"html":"x"}', "", NOW)).toBeNull();
    });

    it("expires an abandoned draft", () => {
      const raw = make("<p>Old work</p>");
      expect(parseTextDraft(raw, "", NOW + TEXT_DRAFT_MAX_AGE_MS + 1)).toBeNull();
      expect(parseTextDraft(raw, "", NOW + TEXT_DRAFT_MAX_AGE_MS - 1)).not.toBeNull();
    });

    // The important one: once the work is saved, stop nagging about it.
    it("does not offer a draft that matches the saved value", () => {
      const raw = make("<p>Saved now</p>");
      expect(parseTextDraft(raw, "<p>Saved now</p>", NOW)).toBeNull();
    });

    it("flags when the server value moved on, so restoring would discard it", () => {
      const raw = make("<p>My draft</p>", "<p>Original</p>");
      const d = parseTextDraft(raw, "<p>Someone else edited this</p>", NOW)!;
      expect(d.baseChanged).toBe(true);
    });

    it("does not flag baseChanged when the server value is unchanged", () => {
      const raw = make("<p>My draft</p>", "<p>Original</p>");
      expect(parseTextDraft(raw, "<p>Original</p>", NOW)!.baseChanged).toBe(false);
    });
  });

  describe("describeAge", () => {
    it("reads naturally at each scale", () => {
      expect(describeAge(NOW, NOW)).toBe("just now");
      expect(describeAge(NOW - 60_000, NOW)).toBe("1 minute ago");
      expect(describeAge(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
      expect(describeAge(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
      expect(describeAge(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
    });
  });
});
