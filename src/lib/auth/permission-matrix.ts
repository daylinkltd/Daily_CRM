// ============================================================
// Permission-matrix helpers — pure, unit-testable, no I/O.
//
// The role editor UI edits a flat `workspace_roles.permissions` JSONB:
//
//   { "contacts:read": true, ..., "module_crm": true, ... }
//
// 32 resources × 4 actions = 128 CRUD keys, plus 4 `module_<key>`
// switches. Every bulk toggle the matrix offers (row / column / module /
// whole matrix / presets) is implemented here as an immutable
// map -> map function so the React component stays a thin renderer and
// the tricky tri-state + counting logic is testable without a DOM.
//
// The resource catalog is read from `@/lib/auth/resources` — the single
// source of truth the RLS migration is generated from. Nothing in this
// file hardcodes a resource or action.
// ============================================================

import {
  ACTIONS,
  MODULE_KEYS,
  RESOURCES,
  permissionKey,
  resourcesByModule,
  type Action,
  type ModuleKey,
} from "./resources";
import { DEFAULT_MODULE_ACCESS, MODULE_PERMISSION_KEY } from "./modules";

/** A role's flat permission map, exactly as stored in the JSONB column. */
export type PermissionMap = Record<string, boolean>;

/** Aggregate state of a group of checkboxes. */
export type TriState = "none" | "some" | "all";

/** Total number of CRUD permission keys in the catalog (32 × 4 = 128). */
export const TOTAL_CRUD_PERMISSIONS = RESOURCES.length * ACTIONS.length;

/** The JSONB key that stores a module's on/off switch. */
export function modulePermissionKey(module: ModuleKey): string {
  return MODULE_PERMISSION_KEY[module];
}

/** Every CRUD permission key, in catalog order. */
export function crudPermissionKeys(): string[] {
  return RESOURCES.flatMap((r) => ACTIONS.map((a) => permissionKey(r.key, a)));
}

/**
 * Coerce whatever is in the database into a complete, dense map so the
 * editor never has to deal with `undefined`.
 *
 * Missing CRUD keys are denied. Module switches follow
 * `deriveModuleAccess`'s rule: a role with *no* `module_*` key at all
 * predates the module migration, so it falls back to
 * DEFAULT_MODULE_ACCESS (CRM only) rather than showing every module off.
 */
export function normalizePermissions(
  raw: Record<string, unknown> | null | undefined,
): PermissionMap {
  const source = raw ?? {};
  // Start from the stored map rather than an empty object: rebuilding
  // only from crudPermissionKeys() silently DROPPED every other key, so
  // saving any role stripped the legacy people_*/attendance_*/leave_*
  // grants a pre-CRUD workspace still relied on. Unknown keys are now
  // carried through untouched.
  const out: PermissionMap = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "boolean") out[key] = value;
  }

  for (const key of crudPermissionKeys()) {
    out[key] = source[key] === true;
  }

  const hasAnyModuleKey = MODULE_KEYS.some(
    (m) => modulePermissionKey(m) in source,
  );
  for (const m of MODULE_KEYS) {
    out[modulePermissionKey(m)] = hasAnyModuleKey
      ? source[modulePermissionKey(m)] === true
      : DEFAULT_MODULE_ACCESS[m];
  }

  return out;
}

/** How many of the 128 CRUD permissions are granted. Module keys excluded. */
export function countGranted(perms: PermissionMap): number {
  let n = 0;
  for (const key of crudPermissionKeys()) if (perms[key] === true) n += 1;
  return n;
}

/** Granted / total CRUD counts, for the live "48 of 128" readout. */
export function grantedSummary(perms: PermissionMap): {
  granted: number;
  total: number;
} {
  return { granted: countGranted(perms), total: TOTAL_CRUD_PERMISSIONS };
}

/** Granted count within one module's resources. */
export function countGrantedInModule(
  perms: PermissionMap,
  module: ModuleKey,
): { granted: number; total: number } {
  const resources = resourcesByModule(module);
  let granted = 0;
  for (const r of resources) {
    for (const a of ACTIONS) {
      if (perms[permissionKey(r.key, a)] === true) granted += 1;
    }
  }
  return { granted, total: resources.length * ACTIONS.length };
}

function tally(perms: PermissionMap, keys: string[]): TriState {
  if (keys.length === 0) return "none";
  let on = 0;
  for (const k of keys) if (perms[k] === true) on += 1;
  if (on === 0) return "none";
  if (on === keys.length) return "all";
  return "some";
}

/** Tri-state for one resource row (its four actions). */
export function resourceState(
  perms: PermissionMap,
  resourceKey: string,
): TriState {
  return tally(
    perms,
    ACTIONS.map((a) => permissionKey(resourceKey, a)),
  );
}

/** Tri-state for one action column, scoped to a single module group. */
export function moduleActionState(
  perms: PermissionMap,
  module: ModuleKey,
  action: Action,
): TriState {
  return tally(
    perms,
    resourcesByModule(module).map((r) => permissionKey(r.key, action)),
  );
}

/** Tri-state for every CRUD key inside a module group. */
export function moduleState(
  perms: PermissionMap,
  module: ModuleKey,
): TriState {
  return tally(
    perms,
    resourcesByModule(module).flatMap((r) =>
      ACTIONS.map((a) => permissionKey(r.key, a)),
    ),
  );
}

/** Tri-state across the whole 128-key matrix. */
export function matrixState(perms: PermissionMap): TriState {
  return tally(perms, crudPermissionKeys());
}

/** Is this module switched on for the role? */
export function isModuleEnabled(
  perms: PermissionMap,
  module: ModuleKey,
): boolean {
  return perms[modulePermissionKey(module)] === true;
}

function withKeys(
  perms: PermissionMap,
  keys: string[],
  value: boolean,
): PermissionMap {
  const next = { ...perms };
  for (const k of keys) next[k] = value;
  return next;
}

/** Set a single `<resource>:<action>` cell. */
export function setPermission(
  perms: PermissionMap,
  resourceKey: string,
  action: Action,
  value: boolean,
): PermissionMap {
  return withKeys(perms, [permissionKey(resourceKey, action)], value);
}

/** Row "all" toggle — every action on one resource. */
export function setResource(
  perms: PermissionMap,
  resourceKey: string,
  value: boolean,
): PermissionMap {
  return withKeys(
    perms,
    ACTIONS.map((a) => permissionKey(resourceKey, a)),
    value,
  );
}

/** Column header toggle — one action across a module's resources only. */
export function setModuleAction(
  perms: PermissionMap,
  module: ModuleKey,
  action: Action,
  value: boolean,
): PermissionMap {
  return withKeys(
    perms,
    resourcesByModule(module).map((r) => permissionKey(r.key, action)),
    value,
  );
}

/**
 * Module master switch — every CRUD key in the group *and* the
 * `module_<key>` switch, so turning a module on never leaves a role that
 * has ticks it can't reach (or a module it can open with nothing in it).
 */
export function setModule(
  perms: PermissionMap,
  module: ModuleKey,
  value: boolean,
): PermissionMap {
  const next = withKeys(
    perms,
    resourcesByModule(module).flatMap((r) =>
      ACTIONS.map((a) => permissionKey(r.key, a)),
    ),
    value,
  );
  next[modulePermissionKey(module)] = value;
  return next;
}

/** Flip only the `module_<key>` switch, leaving the ticks untouched. */
export function setModuleEnabled(
  perms: PermissionMap,
  module: ModuleKey,
  value: boolean,
): PermissionMap {
  const next = { ...perms };
  next[modulePermissionKey(module)] = value;
  return next;
}

/** "Select all / none" for the entire matrix, modules included. */
export function setAllPermissions(
  perms: PermissionMap,
  value: boolean,
): PermissionMap {
  const next = withKeys(perms, crudPermissionKeys(), value);
  for (const m of MODULE_KEYS) next[modulePermissionKey(m)] = value;
  return next;
}

// ────────────────────────────────────────────────────────────
// Presets — starting points for a new role. Mirrors the shape
// `defaultRolePermissions` produces, but parameterised on the
// three shortcuts the editor offers.
// ────────────────────────────────────────────────────────────

export type MatrixPreset = "full" | "read_only" | "crm_only" | "none";

export const MATRIX_PRESETS: {
  value: MatrixPreset;
  label: string;
  hint: string;
}[] = [
  { value: "full", label: "Full access", hint: "Every action in every module" },
  { value: "read_only", label: "Read-only", hint: "Read everywhere, no writes" },
  { value: "crm_only", label: "CRM only", hint: "Full CRUD on CRM, nothing else" },
  { value: "none", label: "No access", hint: "Start from a blank matrix" },
];

/** Build a complete permission map for one of the presets. */
export function presetPermissions(preset: MatrixPreset): PermissionMap {
  const out: PermissionMap = {};

  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const key = permissionKey(resource.key, action);
      switch (preset) {
        case "full":
          out[key] = true;
          break;
        case "read_only":
          out[key] = action === "read";
          break;
        case "crm_only":
          out[key] = resource.module === "crm";
          break;
        case "none":
          out[key] = false;
          break;
      }
    }
  }

  for (const m of MODULE_KEYS) {
    out[modulePermissionKey(m)] =
      preset === "full" || preset === "read_only"
        ? true
        : preset === "crm_only"
          ? m === "crm"
          : false;
  }

  return out;
}
