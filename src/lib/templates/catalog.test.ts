import { describe, it, expect } from "vitest";
import { extractVariables, needsAggregatorApproval, smsSegments } from "./catalog";

describe("extractVariables", () => {
  it("finds tokens in order, without duplicates", () => {
    expect(
      extractVariables("Hi {{name}}, your order {{order}} for {{name}} is ready")
    ).toEqual(["name", "order"]);
  });

  it("reads across subject and body", () => {
    expect(extractVariables("Invoice {{number}}", "Dear {{contact}}")).toEqual([
      "number",
      "contact",
    ]);
  });

  it("tolerates whitespace inside the braces", () => {
    expect(extractVariables("{{  spaced_token  }}")).toEqual(["spaced_token"]);
  });

  it("supports dotted paths", () => {
    expect(extractVariables("{{employee.name}}")).toEqual(["employee.name"]);
  });

  it("ignores single braces and unclosed tokens", () => {
    expect(extractVariables("{not a token} and {{unclosed")).toEqual([]);
  });

  it("skips null and undefined parts", () => {
    expect(extractVariables(null, undefined, "{{a}}")).toEqual(["a"]);
  });
});

describe("needsAggregatorApproval", () => {
  it("is true only for WhatsApp", () => {
    expect(needsAggregatorApproval("whatsapp")).toBe(true);
    expect(needsAggregatorApproval("email")).toBe(false);
    expect(needsAggregatorApproval("sms")).toBe(false);
    expect(needsAggregatorApproval("document")).toBe(false);
  });
});

describe("smsSegments", () => {
  it("counts an empty body as zero", () => {
    expect(smsSegments("")).toBe(0);
  });

  it("counts a single segment up to 160 characters", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
  });

  it("switches to 153-character parts once concatenated", () => {
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("a".repeat(307))).toBe(3);
  });
});
