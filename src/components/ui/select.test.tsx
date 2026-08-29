import { describe, expect, it } from "vitest";
import React from "react";

import { collectItemLabels } from "./select";

/**
 * Regression: a saved Department / Designation / Manager rendered as
 * the placeholder until the dropdown was opened for the first time.
 *
 * SelectItem registers its label from an effect, and Base UI only
 * mounts the items when the popup opens — so on first paint the label
 * map was empty and a UUID value had nothing to resolve against.
 * Reading the labels straight off the JSX fixes that, and these tests
 * pin the reader's behaviour.
 */
const item = (value: string, label: React.ReactNode) =>
  React.createElement("div", { value, key: value }, label);

describe("collectItemLabels", () => {
  it("finds options that are direct children", () => {
    const out = new Map<string, string>();
    collectItemLabels([item("a", "Engineering"), item("b", "Management")], out);
    expect(out.get("a")).toBe("Engineering");
    expect(out.get("b")).toBe("Management");
  });

  it("finds options nested inside a content wrapper, as the real tree nests them", () => {
    const content = React.createElement("div", null, [
      item("uuid-1", "Engineering (IT)"),
      item("uuid-2", "Management"),
    ]);
    const out = new Map<string, string>();
    collectItemLabels([React.createElement("button", null, "trigger"), content], out);
    expect(out.get("uuid-1")).toBe("Engineering (IT)");
    expect(out.size).toBe(2);
  });

  it("prefers an explicit label prop over the rendered children", () => {
    const el = React.createElement(
      "div",
      { value: "v", label: "Explicit" },
      React.createElement("span", null, "Decorated"),
    );
    const out = new Map<string, string>();
    collectItemLabels(el, out);
    expect(out.get("v")).toBe("Explicit");
  });

  it("reads through elements that wrap their label in markup", () => {
    const el = item("v", React.createElement("span", null, "Wrapped Label"));
    const out = new Map<string, string>();
    collectItemLabels(el, out);
    expect(out.get("v")).toBe("Wrapped Label");
  });

  it("ignores nodes with no value and survives null children", () => {
    const out = new Map<string, string>();
    collectItemLabels(
      [null, undefined, false, React.createElement("div", null, "no value here")],
      out,
    );
    expect(out.size).toBe(0);
  });

  it("collects nothing when the options have not arrived yet", () => {
    // The real failure mode: the value is set before the option list
    // loads. Nothing to collect now, but the walk re-runs when the
    // children change, which is what makes the label appear.
    const out = new Map<string, string>();
    collectItemLabels(React.createElement("div", null, []), out);
    expect(out.size).toBe(0);
  });
});
