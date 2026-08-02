import { describe, it, expect } from "vitest";
import {
  toggleId,
  setId,
  selectRange,
  toggleAllVisible,
  allVisibleSelected,
  someVisibleSelected,
  hiddenSelectedCount,
  pruneMissing,
} from "./selection";

const S = (...ids: string[]) => new Set(ids);
const ALL = ["a", "b", "c", "d", "e"];
const sorted = (s: Set<string>) => Array.from(s).sort();

describe("toggleId", () => {
  it("adds then removes", () => {
    expect(sorted(toggleId(S(), "b"))).toEqual(["b"]);
    expect(sorted(toggleId(S("b"), "b"))).toEqual([]);
  });

  it("does not mutate the input", () => {
    const before = S("a");
    toggleId(before, "b");
    expect(sorted(before)).toEqual(["a"]);
  });
});

describe("setId", () => {
  it("forces an explicit value regardless of current state", () => {
    expect(sorted(setId(S("a"), "a", true))).toEqual(["a"]);
    expect(sorted(setId(S("a"), "a", false))).toEqual([]);
    expect(sorted(setId(S(), "z", false))).toEqual([]);
  });
});

describe("selectRange", () => {
  it("selects the inclusive range forwards", () => {
    expect(sorted(selectRange(S(), ALL, "b", "d"))).toEqual(["b", "c", "d"]);
  });

  it("selects the inclusive range backwards", () => {
    expect(sorted(selectRange(S(), ALL, "d", "b"))).toEqual(["b", "c", "d"]);
  });

  it("only ever adds — a range never deselects", () => {
    expect(sorted(selectRange(S("a", "c"), ALL, "c", "a"))).toEqual(["a", "b", "c"]);
  });

  it("falls back to a plain toggle with no anchor", () => {
    expect(sorted(selectRange(S(), ALL, null, "c"))).toEqual(["c"]);
  });

  it("falls back to a toggle when an end is not visible", () => {
    expect(sorted(selectRange(S(), ["b", "c"], "a", "c"))).toEqual(["c"]);
  });

  it("treats anchor === id as a toggle", () => {
    expect(sorted(selectRange(S("c"), ALL, "c", "c"))).toEqual([]);
  });
});

describe("toggleAllVisible", () => {
  it("selects every visible row", () => {
    expect(sorted(toggleAllVisible(S(), ALL))).toEqual(ALL);
  });

  it("clears when all visible are already selected", () => {
    expect(sorted(toggleAllVisible(S(...ALL), ALL))).toEqual([]);
  });

  it("never reaches rows the filter hides", () => {
    // Only b and c visible; a stays selected and d, e are never added.
    expect(sorted(toggleAllVisible(S("a"), ["b", "c"]))).toEqual(["a", "b", "c"]);
  });

  it("clearing while filtered leaves hidden picks alone", () => {
    expect(sorted(toggleAllVisible(S("a", "b", "c"), ["b", "c"]))).toEqual(["a"]);
  });

  it("does nothing on an empty table", () => {
    expect(sorted(toggleAllVisible(S(), []))).toEqual([]);
  });
});

describe("allVisibleSelected / someVisibleSelected", () => {
  it("an empty table is never 'all selected'", () => {
    expect(allVisibleSelected(S(), [])).toBe(false);
    expect(allVisibleSelected(S("a"), [])).toBe(false);
  });

  it("distinguishes partial from full", () => {
    expect(someVisibleSelected(S("a"), ALL)).toBe(true);
    expect(allVisibleSelected(S("a"), ALL)).toBe(false);
    expect(allVisibleSelected(S(...ALL), ALL)).toBe(true);
    expect(someVisibleSelected(S(...ALL), ALL)).toBe(false);
  });
});

describe("hiddenSelectedCount", () => {
  it("counts selections the filter has hidden", () => {
    expect(hiddenSelectedCount(S("a", "e", "b"), ["b", "c", "d"])).toBe(2);
  });

  it("is zero when everything selected is visible", () => {
    expect(hiddenSelectedCount(S("b"), ALL)).toBe(0);
  });
});

describe("pruneMissing", () => {
  it("drops ids that no longer exist, e.g. after a bulk delete", () => {
    expect(sorted(pruneMissing(S("a", "b", "zz"), ALL))).toEqual(["a", "b"]);
  });

  it("empties when nothing is known", () => {
    expect(sorted(pruneMissing(S("a"), []))).toEqual([]);
  });
});
