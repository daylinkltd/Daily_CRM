import { describe, it, expect } from "vitest";
import {
  describePostgresError,
  isMissingOnConflictConstraint,
} from "./pg-errors";

describe("isMissingOnConflictConstraint", () => {
  it("matches on the 42P10 SQLSTATE", () => {
    expect(isMissingOnConflictConstraint({ code: "42P10" })).toBe(true);
  });

  it("matches the message text when no code is surfaced", () => {
    expect(
      isMissingOnConflictConstraint({
        message:
          'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      }),
    ).toBe(true);
  });

  it("matches the text in details or hint", () => {
    expect(
      isMissingOnConflictConstraint({
        message: "insert failed",
        details:
          "There is no unique or exclusion constraint matching the ON CONFLICT specification.",
      }),
    ).toBe(true);
    expect(
      isMissingOnConflictConstraint({
        hint: "no unique or exclusion constraint matching the ON CONFLICT spec",
      }),
    ).toBe(true);
  });

  it("ignores unrelated database errors", () => {
    expect(isMissingOnConflictConstraint({ code: "23505" })).toBe(false);
    expect(
      isMissingOnConflictConstraint({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toBe(false);
  });

  it("handles null / empty input", () => {
    expect(isMissingOnConflictConstraint(null)).toBe(false);
    expect(isMissingOnConflictConstraint(undefined)).toBe(false);
    expect(isMissingOnConflictConstraint({})).toBe(false);
  });
});

describe("describePostgresError", () => {
  it("combines message and code", () => {
    expect(
      describePostgresError({ code: "42P10", message: "boom" }),
    ).toBe("boom (42P10)");
  });

  it("falls back to whichever field is present", () => {
    expect(describePostgresError({ message: "boom" })).toBe("boom");
    expect(describePostgresError({ code: "42P10" })).toBe("42P10");
    expect(describePostgresError({})).toBe("unknown database error");
    expect(describePostgresError(null)).toBe("unknown database error");
  });
});
