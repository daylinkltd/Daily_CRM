import { describe, it, expect } from "vitest";
import {
  applyPlatformFlags,
  deriveModuleAccess,
  DEFAULT_MODULE_ACCESS,
  MODULE_KEYS,
  MODULE_PERMISSION_KEY,
} from "./modules";

/** Every module on — what an owner or admin always resolves to. */
const ALL_MODULES = {
  crm: true,
  marketing: true,
  accounting: true,
  hr: true,
  retail: true,
  bar: true,
  printing: true,
  projects: true,
};

describe("deriveModuleAccess", () => {
  it("grants all modules to owner regardless of permissions", () => {
    expect(deriveModuleAccess("owner", null)).toEqual(ALL_MODULES);
    // even an empty/hostile JSONB can't reduce an owner's access
    expect(deriveModuleAccess("owner", { module_crm: false })).toEqual(ALL_MODULES);
  });

  it("grants all modules to admin", () => {
    expect(deriveModuleAccess("admin", null)).toEqual(ALL_MODULES);
  });

  it("falls back to DEFAULT (CRM only) for a role-less member/viewer", () => {
    expect(deriveModuleAccess("member", null)).toEqual(DEFAULT_MODULE_ACCESS);
    expect(deriveModuleAccess("viewer", undefined)).toEqual(
      DEFAULT_MODULE_ACCESS,
    );
    expect(DEFAULT_MODULE_ACCESS).toEqual({
      crm: true,
      marketing: true,
      accounting: false,
      hr: false,
      retail: false,
      bar: true,
      printing: false,
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
      marketing: false,
      accounting: false,
      hr: true,
      retail: false,
      bar: false,
      printing: false,
      projects: true,
    });
  });

  it("treats an absent module key as no access once any module key is present", () => {
    // Only module_hr present → hr true, all others false (NOT default CRM).
    const perms = { module_hr: true };
    expect(deriveModuleAccess("member", perms)).toEqual({
      crm: false,
      marketing: false,
      accounting: false,
      hr: true,
      retail: false,
      bar: false,
      printing: false,
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
      marketing: false,
      accounting: false,
      hr: false,
      retail: true,
      bar: false,
      printing: false,
      projects: false,
    });
  });

  it("keeps MODULE_KEYS and MODULE_PERMISSION_KEY in sync", () => {
    for (const k of MODULE_KEYS) {
      expect(MODULE_PERMISSION_KEY[k]).toBe(`module_${k}`);
    }
  });
});

describe("applyPlatformFlags", () => {
  const all = { crm: true, marketing: true, accounting: true, hr: true, retail: true, bar: true, printing: true, projects: true };

  it("fails open when no flags row exists", () => {
    // Flags are a kill switch for exceptions, not a provisioning step —
    // a tenant with no row keeps everything their roles grant.
    expect(applyPlatformFlags(all, null)).toEqual(all);
    expect(applyPlatformFlags(all, undefined)).toEqual(all);
  });

  it("switches a module off for everyone, including the owner bypass", () => {
    // The console's kill switch outranks the workspace owner: `all` here
    // is exactly what deriveModuleAccess returns for an owner.
    const out = applyPlatformFlags(all, { enable_hr: false });
    expect(out.hr).toBe(false);
    expect(out.crm).toBe(true);
    expect(out.retail).toBe(true);
  });

  it("never grants what the role did not", () => {
    // AND, not OR: a platform flag switched on cannot open a module the
    // owner's role configuration keeps closed.
    const roleLimited = { crm: true, marketing: false, accounting: false, hr: false, retail: false, bar: false, printing: false, projects: false };
    const out = applyPlatformFlags(roleLimited, {
      enable_hr: true,
      enable_retail: true,
      enable_projects: true,
    });
    expect(out).toEqual(roleLimited);
  });

  it("treats null columns as not-configured, not as off", () => {
    const out = applyPlatformFlags(all, { enable_crm: null, enable_hr: false });
    expect(out.crm).toBe(true);
    expect(out.marketing).toBe(true);
    expect(out.hr).toBe(false);
  });
});

describe("module keys are opt-in, never opt-out", () => {
  // Regression: `marketing` and `bar` were read as `!== false`, so a
  // role narrowed to CRM alone still resolved both to true — a key
  // nobody had written could not be false. Every module must require
  // an explicit grant, or "which modules can this role see" is a lie.
  it("denies every module a custom role has not been granted", () => {
    const crmOnly = { module_crm: true };
    const access = deriveModuleAccess("member", crmOnly);
    expect(access).toEqual({
      crm: true,
      marketing: false,
      accounting: false,
      hr: false,
      retail: false,
      bar: false,
      printing: false,
      projects: false,
    });
  });

  it("grants marketing and bar only when explicitly true", () => {
    expect(
      deriveModuleAccess("member", { module_crm: true, module_marketing: true }).marketing,
    ).toBe(true);
    expect(
      deriveModuleAccess("member", { module_crm: true, module_bar: true }).bar,
    ).toBe(true);
  });
});
