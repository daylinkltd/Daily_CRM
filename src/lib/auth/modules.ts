// ============================================================
// App-module access — pure, unit-testable, no I/O.
//
// Per-module access control lives in the SAME `workspace_roles.permissions`
// JSONB as the feature permissions, under four boolean keys added by the
// module-permission DB migration:
//
//   module_crm | module_hr | module_retail | module_projects
//
// This file is the single source of truth for turning a member's DB
// enum role + that JSONB into a `{ crm, hr, retail, projects }` shape the
// client can gate UI on. It mirrors the owner/admin bypass baked into the
// `has_workspace_permission(workspace_id, user_id, permission)` SQL
// function: enum role 'owner' or 'admin' ⇒ every module, no JSONB lookup.
//
// Keep this in sync with the SQL migration's module keys.
// ============================================================

import type { WorkspaceDbRole } from "./roles";

/** The app modules the sidebar switches between. */
export type ModuleKey = "crm" | "marketing" | "accounting" | "hr" | "retail" | "bar" | "printing" | "projects";

/** Ordered list of every module key (mirrors sidebar nav order). */
export const MODULE_KEYS: readonly ModuleKey[] = [
  "crm",
  "marketing",
  "accounting",
  "hr",
  "retail",
  "bar",
  "printing",
  "projects",
] as const;

/** Resolved per-module access for the current member. */
export interface ModuleAccess {
  crm: boolean;
  marketing: boolean;
  accounting: boolean;
  hr: boolean;
  retail: boolean;
  bar: boolean;
  printing: boolean;
  projects: boolean;
}

/** Module key → the JSONB permission key that stores it. */
export const MODULE_PERMISSION_KEY: Record<ModuleKey, string> = {
  crm: "module_crm",
  marketing: "module_marketing",
  accounting: "module_accounting",
  hr: "module_hr",
  retail: "module_retail",
  bar: "module_bar",
  printing: "module_printing",
  projects: "module_projects",
};

/** Module key → human label (used in guards/toasts and the role editor). */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  crm: "CRM",
  marketing: "Marketing",
  accounting: "Accounting",
  hr: "HR",
  retail: "Retail",
  bar: "Bar Management",
  printing: "Printing Press",
  projects: "Projects",
};

// ────────────────────────────────────────────────────────────
// DEFAULT ACCESS for a plain agent/member with NO custom role
// assigned (workspace_members.role_id is null), and the fallback
// for legacy custom roles created before the module migration.
//
// >>> CHANGE THIS ONE CONSTANT to alter the baseline module access
// >>> a role-less member gets. Today: CRM & Bar only.
// ────────────────────────────────────────────────────────────
export const DEFAULT_MODULE_ACCESS: ModuleAccess = {
  crm: true,
  marketing: true,
  accounting: false,
  hr: false,
  retail: false,
  bar: true,
  printing: false,
  projects: false,
};

/** Everything on — the owner/admin bypass result. */
const ALL_MODULES: ModuleAccess = {
  crm: true,
  marketing: true,
  accounting: true,
  hr: true,
  retail: true,
  bar: true,
  printing: true,
  projects: true,
};

/**
 * Derive per-module access from a member's enum role and their custom
 * role's permissions JSONB.
 *
 * @param role         `workspace_members.role` enum value (or null while loading).
 * @param permissions  the member's `workspace_roles.permissions` JSONB, or
 *                     null/undefined when they have no custom role assigned.
 *
 * Rules:
 *   1. owner / admin        → all modules (mirrors has_workspace_permission).
 *   2. no permissions JSONB → DEFAULT_MODULE_ACCESS (role-less agent).
 *   3. JSONB with no module_* keys at all → DEFAULT_MODULE_ACCESS
 *      (legacy role predating the migration — fail open to the baseline,
 *      not fully closed, so existing members keep CRM).
 *   4. otherwise            → honour each module_* boolean (absent = false).
 */
export function deriveModuleAccess(
  role: WorkspaceDbRole | null | undefined,
  permissions: Record<string, unknown> | null | undefined,
): ModuleAccess {
  if (role === "owner" || role === "admin") {
    return { ...ALL_MODULES };
  }

  if (!permissions) {
    return { ...DEFAULT_MODULE_ACCESS };
  }

  const hasAnyModuleKey = MODULE_KEYS.some(
    (k) => MODULE_PERMISSION_KEY[k] in permissions,
  );
  if (!hasAnyModuleKey) {
    return { ...DEFAULT_MODULE_ACCESS };
  }

  // Every module reads the same way: granted only when the key is
  // explicitly true. `marketing` and `bar` used `!== false`, which made
  // them opt-OUT — a role narrowed to CRM alone still returned true for
  // both, because a key nobody had written could not be false. That
  // contradicts rule 4 above and quietly widened every custom role.
  // Migration 116 writes the two keys explicitly for existing roles, so
  // nobody loses access they have today.
  return {
    crm: permissions[MODULE_PERMISSION_KEY.crm] === true,
    marketing: permissions[MODULE_PERMISSION_KEY.marketing] === true,
    accounting: permissions[MODULE_PERMISSION_KEY.accounting] === true,
    hr: permissions[MODULE_PERMISSION_KEY.hr] === true,
    retail: permissions[MODULE_PERMISSION_KEY.retail] === true,
    bar: permissions[MODULE_PERMISSION_KEY.bar] === true,
    printing: permissions[MODULE_PERMISSION_KEY.printing] === true,
    projects: permissions[MODULE_PERMISSION_KEY.projects] === true,
  };
}

// ────────────────────────────────────────────────────────────
// Platform feature flags — the SaaS console's kill switch layer.
// ────────────────────────────────────────────────────────────

/** The relevant columns of `saas_workspace_feature_flags`. */
export interface PlatformModuleFlags {
  enable_crm?: boolean | null;
  enable_hr?: boolean | null;
  enable_retail?: boolean | null;
  enable_projects?: boolean | null;
}

/**
 * Intersect role-derived access with the platform's per-tenant flags.
 *
 * Two DIFFERENT authorities compose here, and the order matters to
 * nobody but the result must honour both:
 *
 *   - the workspace OWNER decides who on their team sees which module
 *     (roles → deriveModuleAccess above);
 *   - the PLATFORM decides which modules the tenant has at all
 *     (saas_workspace_feature_flags, set from the admin console).
 *
 * A module is visible only when both say yes — which is why this is an
 * AND, and why the owner/admin bypass in deriveModuleAccess deliberately
 * does NOT bypass this: a module the platform switched off for a tenant
 * is off for that tenant's owner too. Before this function existed, the
 * console's toggles wrote to a table nothing read.
 *
 * A missing flags row (or null column) means "not configured" and fails
 * OPEN: flags are a kill switch for exceptions, not a provisioning step
 * every tenant must pass.
 *
 * Accounting has no platform flag column today, so it stays governed by
 * roles alone.
 */
export function applyPlatformFlags(
  access: ModuleAccess,
  flags: PlatformModuleFlags | null | undefined,
): ModuleAccess {
  if (!flags) return access;
  return {
    crm: access.crm && flags.enable_crm !== false,
    marketing: access.marketing,
    accounting: access.accounting,
    hr: access.hr && flags.enable_hr !== false,
    retail: access.retail && flags.enable_retail !== false,
    bar: access.bar,
    // Like bar/marketing: no platform flag column yet — roles + the
    // workspace's own module selection govern it.
    printing: access.printing,
    projects: access.projects && flags.enable_projects !== false,
  };
}

// ────────────────────────────────────────────────────────────
// What the BUSINESS chose to use.
// ────────────────────────────────────────────────────────────

/**
 * Narrow access to the modules this workspace actually turned on.
 *
 * A third authority, distinct from the two above and answering a
 * different question:
 *
 *   - the PLATFORM decides what a tenant is allowed to have (flags);
 *   - the BUSINESS decides which of those it actually uses (this);
 *   - the OWNER decides who on the team sees each one (roles).
 *
 * Chosen at signup from a handful of questions and changed afterwards in
 * Settings → Modules. It exists because the product keeps growing
 * modules and most businesses want a fraction of them — without this,
 * a restaurant's sidebar carries a project tracker forever.
 *
 * Like the platform flags, this does NOT bypass for owners: a module
 * the business switched off is off for everyone, including the person
 * who switched it off. They turn it back on in settings, where they
 * turned it off.
 *
 * NULL OR EMPTY MEANS EVERYTHING. Every workspace that existed before
 * this feature has no selection stored, and must not silently lose its
 * sidebar. An explicit empty list is treated the same way rather than
 * hiding every module and leaving no way back in.
 */
export function applyWorkspaceModules(
  access: ModuleAccess,
  enabled: readonly string[] | null | undefined,
): ModuleAccess {
  if (!enabled || enabled.length === 0) return access;
  const on = new Set(enabled);
  return MODULE_KEYS.reduce<ModuleAccess>(
    (acc, key) => ({ ...acc, [key]: access[key] && on.has(key) }),
    { ...access },
  );
}
