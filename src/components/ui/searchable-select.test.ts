import { describe, expect, it } from "vitest";

import {
  matchesQuery,
  filterOptions,
  type SearchableOption,
} from "./searchable-select";

const opt = (label: string, hint?: string): SearchableOption => ({
  value: label,
  label,
  hint,
});

describe("matchesQuery", () => {
  it("matches everything on an empty or whitespace query", () => {
    expect(matchesQuery(opt("Anything"), "")).toBe(true);
    expect(matchesQuery(opt("Anything"), "   ")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery(opt("Priya Sharma"), "PRIYA")).toBe(true);
  });

  it("requires every term, in any order", () => {
    // The point of splitting on whitespace: a plain substring test would
    // miss this, because "Sharma, Priya" never contains "priya sharma".
    expect(matchesQuery(opt("Sharma, Priya"), "priya sharma")).toBe(true);
    expect(matchesQuery(opt("Sharma, Priya"), "priya patel")).toBe(false);
  });

  it("searches the hint as well as the label", () => {
    const o = opt("Priya Sharma", "priya@example.com");
    expect(matchesQuery(o, "example.com")).toBe(true);
    expect(matchesQuery(o, "priya example")).toBe(true);
  });

  it("copes with a missing hint", () => {
    expect(matchesQuery({ value: "1", label: "Solo" }, "solo")).toBe(true);
    expect(matchesQuery({ value: "1", label: "Solo", hint: null }, "nope")).toBe(false);
  });

  it("ignores extra internal whitespace in the query", () => {
    expect(matchesQuery(opt("INV-204 Acme Ltd"), "  acme    inv  ")).toBe(true);
  });
});

describe("filterOptions", () => {
  const options = [opt("Alpha"), opt("Beta", "b@x.com"), opt("Gamma")];

  it("returns everything when the query is empty", () => {
    expect(filterOptions(options, "")).toHaveLength(3);
  });

  it("preserves the caller's ordering rather than re-ranking", () => {
    const result = filterOptions([opt("Zeta"), opt("Alpha")], "a");
    expect(result.map((o) => o.label)).toEqual(["Zeta", "Alpha"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterOptions(options, "zzz")).toEqual([]);
  });

  it("matches on hint only", () => {
    expect(filterOptions(options, "b@x").map((o) => o.label)).toEqual(["Beta"]);
  });
});
