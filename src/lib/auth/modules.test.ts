import { describe, it, expect } from "vitest";
import {
  deriveModuleAccess,
  DEFAULT_MODULE_ACCESS,
  MODULE_KEYS,
  MODULE_PERMISSION_KEY,
} from "./modules";

describe("deriveModuleAccess", () => {
  it("grants all modules to owner regardless of permissions", () => {
    expect(deriveModuleAccess("owner", null)).toEqual({
      crm: true,
      hr: true,
      retail: true,
      projects: true,
    });
    // even an empty/hostile JSONB can't reduce an owner's access
    expect(deriveModuleAccess("owner", { module_crm: false })).toEqual({
      crm: true,
      hr: true,
      retail: true,
      projects: true,
    });
  });

  it("grants all modules to admin", () => {
    expect(deriveModuleAccess("admin", null)).toEqual({
      crm: true,
      hr: true,
      retail: true,
      projects: true,
    });
  });

  it("falls back to DEFAULT (CRM only) for a role-less member/viewer", () => {
    expect(deriveModuleAccess("member", null)).toEqual(DEFAULT_MODULE_ACCESS);
    expect(deriveModuleAccess("viewer", undefined)).toEqual(
      DEFAULT_MODULE_ACCESS,
    );
    expect(DEFAULT_MODULE_ACCESS).toEqual({
      crm: true,
      hr: false,
      retail: false,
      projects: false,
    });
  });

  it("falls back to DEFAULT for a legacy role JSONB with no module_* keys", () => {
    // A pre-migration custom role: only feature keys, no module keys.
    const legacy = { inbox: true, contacts: true, pipelines: false };
    expect(deriveModuleAccess("member", legacy)).toEqual(DEFAULT_MODULE_ACCESS);
  });

  it("honours explicit module_* booleans on a custom role", () => {
    const perms = {
      inbox: true,
      module_crm: true,
      module_hr: true,
      module_retail: false,
      module_projects: true,
    };
    expect(deriveModuleAccess("member", perms)).toEqual({
      crm: true,
      hr: true,
      retail: false,
      projects: true,
    });
  });

  it("treats an absent module key as no access once any module key is present", () => {
    // Only module_hr present → hr true, all others false (NOT default CRM).
    const perms = { module_hr: true };
    expect(deriveModuleAccess("member", perms)).toEqual({
      crm: false,
      hr: true,
      retail: false,
      projects: false,
    });
  });

  it("treats non-true values (e.g. truthy strings) as no access", () => {
    const perms = {
      module_crm: "yes" as unknown as boolean,
      module_hr: 1 as unknown as boolean,
      module_retail: true,
    };
    expect(deriveModuleAccess("member", perms)).toEqual({
      crm: false,
      hr: false,
      retail: true,
      projects: false,
    });
  });

  it("keeps MODULE_KEYS and MODULE_PERMISSION_KEY in sync", () => {
    for (const k of MODULE_KEYS) {
      expect(MODULE_PERMISSION_KEY[k]).toBe(`module_${k}`);
    }
  });
});
