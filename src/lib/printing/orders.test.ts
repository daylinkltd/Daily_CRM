import { describe, expect, it } from "vitest";

import {
  attributeSummary,
  computeOrderTotals,
  isCancellable,
  nextStage,
} from "./orders";

describe("computeOrderTotals", () => {
  it("computes the flow-chart example: 5,000 cards at ₹1.50 + 18% GST", () => {
    const t = computeOrderTotals([{ quantity: 5000, rate: 1.5 }], 18);
    expect(t.subtotal).toBe(7500);
    expect(t.taxAmount).toBe(1350);
    expect(t.grandTotal).toBe(8850);
  });

  it("rounds per line, then per aggregate", () => {
    const t = computeOrderTotals(
      [
        { quantity: 3, rate: 33.335 },
        { quantity: 1, rate: 0.004 },
      ],
      0,
    );
    // 3 × 33.335 = 100.005 → 100.01 (per-line); 0.004 → 0.00
    expect(t.subtotal).toBe(100.01);
    expect(t.grandTotal).toBe(100.01);
  });

  it("treats junk quantities and rates as zero", () => {
    const t = computeOrderTotals([{ quantity: NaN, rate: 10 }], 18);
    expect(t.grandTotal).toBe(0);
  });
});

describe("nextStage", () => {
  it("walks Design → Print → Finishing → done", () => {
    expect(nextStage(null)).toBe("DESIGN");
    expect(nextStage("DESIGN")).toBe("PRINT");
    expect(nextStage("PRINT")).toBe("FINISHING");
    expect(nextStage("FINISHING")).toBeNull();
  });
});

describe("isCancellable", () => {
  it("allows cancelling only before production starts", () => {
    expect(isCancellable("ENQUIRY")).toBe(true);
    expect(isCancellable("QUOTED")).toBe(true);
    expect(isCancellable("APPROVED")).toBe(true);
    expect(isCancellable("IN_PRODUCTION")).toBe(false);
    expect(isCancellable("INVOICED")).toBe(false);
    expect(isCancellable("DELIVERED")).toBe(false);
  });
});

describe("attributeSummary", () => {
  it("joins only the attributes that exist", () => {
    expect(
      attributeSummary({
        size: "3.5 x 2 inch",
        paper_type: "Art Card",
        gsm: "300",
        print_type: "4/4",
        color_mode: null,
        finishing: "Matte Lamination",
      }),
    ).toBe("3.5 x 2 inch · Art Card 300 GSM · 4/4 · Matte Lamination");
  });

  it("returns an empty string for a bare item", () => {
    expect(attributeSummary({})).toBe("");
  });
});
