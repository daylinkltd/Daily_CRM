import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  MODULE_KEYS,
  RESOURCES,
  permissionKey,
  resourcesByModule,
} from "./resources";
import {
  TOTAL_CRUD_PERMISSIONS,
  countGranted,
  countGrantedInModule,
  crudPermissionKeys,
  grantedSummary,
  isModuleEnabled,
  matrixState,
  moduleActionState,
  modulePermissionKey,
  moduleState,
  normalizePermissions,
  presetPermissions,
  resourceState,
  setAllPermissions,
  setModule,
  setModuleAction,
  setModuleEnabled,
  setPermission,
  setResource,
} from "./permission-matrix";

const CRM_RESOURCES = resourcesByModule("crm");
const firstCrm = CRM_RESOURCES[0].key;

describe("catalog shape", () => {
  it("has 136 CRUD keys (34 resources × 4 actions)", () => {
    expect(RESOURCES).toHaveLength(34);
    expect(ACTIONS).toHaveLength(4);
    expect(TOTAL_CRUD_PERMISSIONS).toBe(136);
    expect(crudPermissionKeys()).toHaveLength(136);
  });

  it("produces unique permission keys", () => {
    const keys = crudPermissionKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("normalizePermissions", () => {
  it("denies every missing CRUD key", () => {
    const perms = normalizePermissions({});
    expect(countGranted(perms)).toBe(0);
    expect(Object.keys(perms)).toHaveLength(TOTAL_CRUD_PERMISSIONS + MODULE_KEYS.length);
  });

  it("falls back to CRM-only modules for a legacy role with no module keys", () => {
    const perms = normalizePermissions({ "contacts:read": true });
    expect(isModuleEnabled(perms, "crm")).toBe(true);
    expect(isModuleEnabled(perms, "hr")).toBe(false);
    expect(isModuleEnabled(perms, "retail")).toBe(false);
    expect(isModuleEnabled(perms, "projects")).toBe(false);
  });

  it("honours module keys verbatim once any are present", () => {
    const perms = normalizePermissions({ module_hr: true });
    expect(isModuleEnabled(perms, "hr")).toBe(true);
    expect(isModuleEnabled(perms, "crm")).toBe(false);
  });

  it("treats non-boolean truthy values as denied", () => {
    const perms = normalizePermissions({
      "contacts:read": "yes",
      "contacts:create": 1,
      "contacts:update": true,
    } as Record<string, unknown>);
    expect(perms["contacts:read"]).toBe(false);
    expect(perms["contacts:create"]).toBe(false);
    expect(perms["contacts:update"]).toBe(true);
  });

  it("does not mutate its input", () => {
    const raw = { "contacts:read": true };
    normalizePermissions(raw);
    expect(Object.keys(raw)).toEqual(["contacts:read"]);
  });

  it("handles null/undefined", () => {
    expect(countGranted(normalizePermissions(null))).toBe(0);
    expect(countGranted(normalizePermissions(undefined))).toBe(0);
  });
});

describe("counting", () => {
  it("ignores module keys in the granted count", () => {
    const perms = normalizePermissions({
      module_crm: true,
      module_hr: true,
      module_retail: true,
      module_projects: true,
    });
    expect(countGranted(perms)).toBe(0);
    expect(grantedSummary(perms)).toEqual({ granted: 0, total: 136 });
  });

  it("counts a module subtotal independently", () => {
    let perms = normalizePermissions({});
    perms = setModule(perms, "crm", true);
    const crm = countGrantedInModule(perms, "crm");
    expect(crm.total).toBe(CRM_RESOURCES.length * 4);
    expect(crm.granted).toBe(crm.total);
    expect(countGrantedInModule(perms, "hr").granted).toBe(0);
    expect(countGranted(perms)).toBe(crm.total);
  });
});

describe("tri-state derivation", () => {
  it("reports none / some / all for a resource row", () => {
    let perms = normalizePermissions({});
    expect(resourceState(perms, firstCrm)).toBe("none");
    perms = setPermission(perms, firstCrm, "read", true);
    expect(resourceState(perms, firstCrm)).toBe("some");
    perms = setResource(perms, firstCrm, true);
    expect(resourceState(perms, firstCrm)).toBe("all");
  });

  it("scopes a column tri-state to its own module", () => {
    let perms = normalizePermissions({});
    perms = setModuleAction(perms, "crm", "read", true);
    expect(moduleActionState(perms, "crm", "read")).toBe("all");
    expect(moduleActionState(perms, "crm", "create")).toBe("none");
    expect(moduleActionState(perms, "hr", "read")).toBe("none");
    expect(moduleState(perms, "crm")).toBe("some");
    expect(moduleState(perms, "hr")).toBe("none");
    expect(matrixState(perms)).toBe("some");
  });

  it("reports the whole matrix as all/none at the extremes", () => {
    const all = setAllPermissions(normalizePermissions({}), true);
    expect(matrixState(all)).toBe("all");
    expect(countGranted(all)).toBe(TOTAL_CRUD_PERMISSIONS);

    const none = setAllPermissions(all, false);
    expect(matrixState(none)).toBe("none");
    expect(countGranted(none)).toBe(0);
  });
});

describe("bulk toggles", () => {
  it("row toggle only touches its own resource", () => {
    const base = normalizePermissions({});
    const next = setResource(base, firstCrm, true);
    expect(countGranted(next)).toBe(4);
    expect(countGranted(base)).toBe(0); // immutability
  });

  it("column toggle only touches its module's rows", () => {
    const perms = setModuleAction(normalizePermissions({}), "hr", "delete", true);
    expect(countGranted(perms)).toBe(resourcesByModule("hr").length);
    for (const r of resourcesByModule("crm")) {
      expect(perms[permissionKey(r.key, "delete")]).toBe(false);
    }
  });

  it("module master switch also writes the module_<key> permission", () => {
    let perms = normalizePermissions({ module_crm: false });
    perms = setModule(perms, "retail", true);
    expect(isModuleEnabled(perms, "retail")).toBe(true);
    expect(moduleState(perms, "retail")).toBe("all");

    perms = setModule(perms, "retail", false);
    expect(isModuleEnabled(perms, "retail")).toBe(false);
    expect(moduleState(perms, "retail")).toBe("none");
  });

  it("setModuleEnabled leaves the ticks alone", () => {
    let perms = setModule(normalizePermissions({}), "projects", true);
    const before = countGranted(perms);
    perms = setModuleEnabled(perms, "projects", false);
    expect(isModuleEnabled(perms, "projects")).toBe(false);
    expect(countGranted(perms)).toBe(before);
  });

  it("select-all flips every module switch too", () => {
    const all = setAllPermissions(normalizePermissions({}), true);
    for (const m of MODULE_KEYS) expect(all[modulePermissionKey(m)]).toBe(true);
    const none = setAllPermissions(all, false);
    for (const m of MODULE_KEYS) expect(none[modulePermissionKey(m)]).toBe(false);
  });
});

describe("presets", () => {
  it("full grants everything", () => {
    const perms = presetPermissions("full");
    expect(countGranted(perms)).toBe(TOTAL_CRUD_PERMISSIONS);
    for (const m of MODULE_KEYS) expect(isModuleEnabled(perms, m)).toBe(true);
  });

  it("read_only grants exactly one action per resource", () => {
    const perms = presetPermissions("read_only");
    expect(countGranted(perms)).toBe(RESOURCES.length);
    for (const r of RESOURCES) {
      expect(perms[permissionKey(r.key, "read")]).toBe(true);
      expect(perms[permissionKey(r.key, "create")]).toBe(false);
      expect(perms[permissionKey(r.key, "update")]).toBe(false);
      expect(perms[permissionKey(r.key, "delete")]).toBe(false);
    }
    for (const m of MODULE_KEYS) expect(isModuleEnabled(perms, m)).toBe(true);
  });

  it("crm_only grants full CRUD on CRM and nothing else", () => {
    const perms = presetPermissions("crm_only");
    expect(countGranted(perms)).toBe(CRM_RESOURCES.length * ACTIONS.length);
    expect(moduleState(perms, "crm")).toBe("all");
    expect(moduleState(perms, "hr")).toBe("none");
    expect(isModuleEnabled(perms, "crm")).toBe(true);
    expect(isModuleEnabled(perms, "projects")).toBe(false);
  });

  it("none grants nothing", () => {
    const perms = presetPermissions("none");
    expect(countGranted(perms)).toBe(0);
    for (const m of MODULE_KEYS) expect(isModuleEnabled(perms, m)).toBe(false);
  });

  it("every preset is a complete, dense map", () => {
    for (const preset of ["full", "read_only", "crm_only", "none"] as const) {
      const perms = presetPermissions(preset);
      expect(Object.keys(perms)).toHaveLength(
        TOTAL_CRUD_PERMISSIONS + MODULE_KEYS.length,
      );
      for (const v of Object.values(perms)) expect(typeof v).toBe("boolean");
    }
  });
});
