import { describe, it, expect } from "vitest";
import { isNormalWeight, isBoldWeight, normalisePastedHtml } from "./paste-normalise";

describe("isNormalWeight", () => {
  it("recognises the Google Docs wrapper value", () => {
    expect(isNormalWeight("normal")).toBe(true);
  });

  it("treats numeric weights under 600 as not bold", () => {
    for (const w of ["100", "300", "400", "500"]) expect(isNormalWeight(w)).toBe(true);
  });

  it("does not treat bold weights as normal", () => {
    for (const w of ["600", "700", "bold", "900"]) expect(isNormalWeight(w)).toBe(false);
  });

  it("ignores an absent weight rather than guessing", () => {
    expect(isNormalWeight("")).toBe(false);
    expect(isNormalWeight("   ")).toBe(false);
  });

  it("is case and whitespace tolerant", () => {
    expect(isNormalWeight("  NORMAL ")).toBe(true);
  });

  it("treats lighter as not bold", () => {
    expect(isNormalWeight("lighter")).toBe(true);
  });
});

describe("isBoldWeight", () => {
  it("recognises keyword and numeric bold", () => {
    for (const w of ["bold", "bolder", "600", "700", "800"]) expect(isBoldWeight(w)).toBe(true);
  });

  it("rejects normal weights", () => {
    for (const w of ["normal", "400", "500", ""]) expect(isBoldWeight(w)).toBe(false);
  });

  it("600 is the boundary and counts as bold", () => {
    expect(isBoldWeight("599")).toBe(false);
    expect(isBoldWeight("600")).toBe(true);
  });
});

describe("normalisePastedHtml", () => {
  it("returns empty input unchanged", () => {
    expect(normalisePastedHtml("")).toBe("");
  });

  // Without DOMParser (this suite runs in node) it must pass through rather
  // than throw — the sanitiser downstream is the safety net.
  it("passes through when no DOM is available", () => {
    const input = '<b style="font-weight:normal">x</b>';
    expect(normalisePastedHtml(input)).toBe(input);
  });
});
