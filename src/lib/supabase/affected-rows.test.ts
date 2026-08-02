import { describe, it, expect } from "vitest";
import { assertAffected, affectedCount, NoRowsAffectedError } from "./affected-rows";

describe("assertAffected", () => {
  it("returns the rows when the mutation changed something", () => {
    expect(assertAffected({ data: [{ id: "a" }], error: null }, "the policy")).toEqual([
      { id: "a" },
    ]);
  });

  it("throws on a real Supabase error, preserving its message", () => {
    expect(() =>
      assertAffected({ data: null, error: { message: "permission denied" } }, "the policy")
    ).toThrow("permission denied");
  });

  // The whole point: RLS filtered everything away but reported no error.
  it("throws when zero rows matched despite no error", () => {
    expect(() => assertAffected({ data: [], error: null }, "the leave request")).toThrow(
      NoRowsAffectedError
    );
  });

  it("throws when data is null with no error", () => {
    expect(() => assertAffected({ data: null, error: null }, "the record")).toThrow(
      NoRowsAffectedError
    );
  });

  it("names the subject and the verb in the message", () => {
    expect(() => assertAffected({ data: [], error: null }, "the department", "delete")).toThrow(
      /Could not delete the department/
    );
  });

  it("mentions permission as a likely cause", () => {
    expect(() => assertAffected({ data: [], error: null }, "x")).toThrow(/permission/);
  });
});

describe("affectedCount", () => {
  it("reports a full success", () => {
    const r = affectedCount({ data: [{}, {}, {}], error: null }, 3, "departments");
    expect(r).toMatchObject({ affected: 3, partial: false });
    expect(r.message).toBe("3 departments changed.");
  });

  it("reports a partial success honestly rather than as the requested count", () => {
    const r = affectedCount({ data: [{}, {}], error: null }, 10, "employees");
    expect(r).toMatchObject({ affected: 2, partial: true });
    expect(r.message).toMatch(/2 of 10 employees changed/);
  });

  it("throws when nothing at all was changed", () => {
    expect(() => affectedCount({ data: [], error: null }, 5, "rows")).toThrow(
      NoRowsAffectedError
    );
  });

  it("propagates a real error", () => {
    expect(() => affectedCount({ data: null, error: { message: "boom" } }, 5, "rows")).toThrow(
      "boom"
    );
  });
});
