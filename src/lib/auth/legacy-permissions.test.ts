import { describe, it, expect } from "vitest";
import {
  withDerivedLegacyPermissions,
  derivableLegacyKeys,
  LEGACY_PERMISSION_SOURCES,
} from "./legacy-permissions";

describe("withDerivedLegacyPermissions", () => {
  it("grants people_manage from employees:update", () => {
    const out = withDerivedLegacyPermissions({ "employees:update": true });
    expect(out.people_manage).toBe(true);
  });

  it("grants people_manage from create or delete alone", () => {
    expect(withDerivedLegacyPermissions({ "employees:create": true }).people_manage).toBe(true);
    expect(withDerivedLegacyPermissions({ "employees:delete": true }).people_manage).toBe(true);
  });

  it("does NOT grant people_manage from read alone", () => {
    const out = withDerivedLegacyPermissions({ "employees:read": true });
    expect(out.people_manage).toBe(false);
    expect(out.people_view).toBe(true);
  });

  it("derives attendance_manage and leave_approve", () => {
    const out = withDerivedLegacyPermissions({
      "attendance:update": true,
      "leave:update": true,
    });
    expect(out.attendance_manage).toBe(true);
    expect(out.leave_approve).toBe(true);
  });

  it("denies everything for a role with no relevant CRUD keys", () => {
    const out = withDerivedLegacyPermissions({ "contacts:read": true });
    for (const key of derivableLegacyKeys()) expect(out[key]).toBe(false);
  });

  it("never downgrades a legacy key that is explicitly granted", () => {
    // A pre-CRUD workspace still storing the old key keeps it.
    const out = withDerivedLegacyPermissions({ people_manage: true });
    expect(out.people_manage).toBe(true);
  });

  it("upgrades a legacy key that is explicitly false but CRUD-granted", () => {
    // The stale `false` came from a default map, not a deliberate denial.
    const out = withDerivedLegacyPermissions({
      people_manage: false,
      "employees:update": true,
    });
    expect(out.people_manage).toBe(true);
  });

  it("preserves every unrelated key untouched", () => {
    const out = withDerivedLegacyPermissions({ inbox: true, "contacts:read": true });
    expect(out.inbox).toBe(true);
    expect(out["contacts:read"]).toBe(true);
  });

  it("does not mutate its input", () => {
    const input = { "employees:update": true };
    withDerivedLegacyPermissions(input);
    expect("people_manage" in input).toBe(false);
  });

  it("handles an empty permission map", () => {
    const out = withDerivedLegacyPermissions({});
    for (const key of derivableLegacyKeys()) expect(out[key]).toBe(false);
  });

  it("every declared source key is a real resource:action pair", () => {
    for (const sources of Object.values(LEGACY_PERMISSION_SOURCES)) {
      for (const s of sources) expect(s).toMatch(/^[a-z_]+:(create|read|update|delete)$/);
    }
  });
});
