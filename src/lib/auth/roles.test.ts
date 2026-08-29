import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ROLES,
  canSendMessages,
  canViewOnly,
  defaultSystemRoleName,
  fromDbRole,
  hasMinRole,
  toDbRole,
  type AccountRole,
} from "./roles";

describe("defaultSystemRoleName", () => {
  // Must match migration 073's backfill CASE and the trigger in 097 —
  // if these three disagree, new members land somewhere existing ones
  // are not.
  it("maps owner and admin to the Admin role", () => {
    expect(defaultSystemRoleName("owner")).toBe("Admin");
    expect(defaultSystemRoleName("admin")).toBe("Admin");
  });

  it("maps everyone else to the staff role", () => {
    expect(defaultSystemRoleName("member")).toBe("Team Member");
    expect(defaultSystemRoleName("viewer")).toBe("Team Member");
  });

  it("never returns Viewer, which would expose payroll to plain members", () => {
    // The seeded Viewer role grants payroll:read and accounting:read, so
    // it is deliberately not the fallback for a plain member.
    const names = (["owner", "admin", "member", "viewer"] as const).map(
      defaultSystemRoleName
    );
    expect(names).not.toContain("Viewer");
  });
});

describe("toDbRole / fromDbRole", () => {
  it("persists 'viewer' distinctly instead of collapsing onto 'member'", () => {
    expect(toDbRole("viewer")).toBe("viewer");
  });

  it("maps 'agent' onto the DB 'member' role", () => {
    expect(toDbRole("agent")).toBe("member");
  });

  it("maps 'owner' and 'admin' 1:1", () => {
    expect(toDbRole("owner")).toBe("owner");
    expect(toDbRole("admin")).toBe("admin");
  });

  it("round-trips every AccountRole through the DB enum", () => {
    for (const role of ACCOUNT_ROLES) {
      expect(fromDbRole(toDbRole(role))).toBe(role);
    }
  });

  it("reads DB 'member' back as 'agent'", () => {
    expect(fromDbRole("member")).toBe("agent");
  });

  it("reads DB 'viewer' back as 'viewer'", () => {
    expect(fromDbRole("viewer")).toBe("viewer");
  });

  it("falls back to 'agent' for unknown or missing values", () => {
    expect(fromDbRole("something-else")).toBe("agent");
    expect(fromDbRole(null)).toBe("agent");
    expect(fromDbRole(undefined)).toBe("agent");
  });
});

describe("viewer demotion", () => {
  // Regression for the bug where PATCH /api/account/members/[userId]
  // wrote 'member' for a viewer demotion and getCurrentAccount read
  // it back as 'agent', leaving a "read-only" user with full write
  // permissions.
  it("a demoted viewer stays a viewer after a DB round-trip", () => {
    const persisted = toDbRole("viewer");
    const readBack: AccountRole = fromDbRole(persisted);
    expect(readBack).toBe("viewer");
    expect(canSendMessages(readBack)).toBe(false);
    expect(canViewOnly(readBack)).toBe(true);
  });

  it("a demoted viewer no longer clears agent-level checks", () => {
    expect(hasMinRole(fromDbRole(toDbRole("viewer")), "agent")).toBe(false);
  });

  it("agents keep write access after a DB round-trip", () => {
    const readBack = fromDbRole(toDbRole("agent"));
    expect(canSendMessages(readBack)).toBe(true);
    expect(canViewOnly(readBack)).toBe(false);
  });
});
