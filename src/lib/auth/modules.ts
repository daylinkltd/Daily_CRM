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

/** The four app modules the sidebar switches between. */
export type ModuleKey = "crm" | "hr" | "retail" | "projects";

/** Ordered list of every module key (mirrors sidebar nav order). */
export const MODULE_KEYS: readonly ModuleKey[] = [
  "crm",
  "hr",
  "retail",
  "projects",
] as const;

/** Resolved per-module access for the current member. */
export interface ModuleAccess {
  crm: boolean;
  hr: boolean;
  retail: boolean;
  projects: boolean;
}

/** Module key → the JSONB permission key that stores it. */
export const MODULE_PERMISSION_KEY: Record<ModuleKey, string> = {
  crm: "module_crm",
  hr: "module_hr",
  retail: "module_retail",
  projects: "module_projects",
};

/** Module key → human label (used in guards/toasts and the role editor). */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  crm: "CRM",
  hr: "HR",
  retail: "Retail",
  projects: "Projects",
};

// ────────────────────────────────────────────────────────────
// DEFAULT ACCESS for a plain agent/member with NO custom role
// assigned (workspace_members.role_id is null), and the fallback
// for legacy custom roles created before the module migration.
//
// >>> CHANGE THIS ONE CONSTANT to alter the baseline module access
// >>> a role-less member gets. Today: CRM only.
// ────────────────────────────────────────────────────────────
export const DEFAULT_MODULE_ACCESS: ModuleAccess = {
  crm: true,
  hr: false,
  retail: false,
  projects: false,
};

/** Everything on — the owner/admin bypass result. */
const ALL_MODULES: ModuleAccess = {
  crm: true,
  hr: true,
  retail: true,
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

  return {
    crm: permissions[MODULE_PERMISSION_KEY.crm] === true,
    hr: permissions[MODULE_PERMISSION_KEY.hr] === true,
    retail: permissions[MODULE_PERMISSION_KEY.retail] === true,
    projects: permissions[MODULE_PERMISSION_KEY.projects] === true,
  };
}
