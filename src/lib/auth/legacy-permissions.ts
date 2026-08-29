/**
 * Bridge between the two permission namespaces.
 *
 * THE PROBLEM: the app grew a CRUD matrix (`employees:update`,
 * `attendance:read`, 136 keys generated from resources.ts) but most of
 * the HR UI still gates on the older coarse keys — `people_manage`,
 * `people_view`, `attendance_manage`, `leave_approve`. The seeded roles
 * from migration 074 contain ONLY the CRUD keys. Verified against
 * production: all 12 roles carry 136 CRUD keys and zero legacy keys.
 *
 * Owners and admins short-circuit to full permissions, so the split is
 * invisible to them — which is exactly why it went unnoticed. For every
 * other role the legacy keys are permanently false and cannot be turned
 * on by any configuration, so HR work cannot be delegated at all.
 *
 * Rather than migrate every call site at once (dozens of gates, each a
 * chance to widen access by accident), the legacy keys are DERIVED from
 * the CRUD keys that already exist. One source of truth, no behaviour
 * change for owners/admins, and the UI keeps working untouched.
 */

/** Legacy key -> the CRUD keys that should grant it. Any one suffices. */
export const LEGACY_PERMISSION_SOURCES: Record<string, string[]> = {
  // Managing people means being able to change them, not merely read.
  people_manage: ["employees:update", "employees:create", "employees:delete"],
  people_view: ["employees:read"],
  // Editing an attendance record is what regularisation approval does.
  attendance_manage: ["attendance:update", "attendance:delete"],
  // Approving leave is an update on the request.
  leave_approve: ["leave:update"],
  // Adding, re-roling or removing people. Lets a workspace delegate
  // team management to a role that is not admin — the settings UI
  // gates on `manage_users`, and the member APIs enforce the same
  // `team_members:*` keys server-side.
  manage_users: ["team_members:create", "team_members:update", "team_members:delete"],
};

/**
 * Fill in any legacy key that is absent (or false) but whose CRUD
 * equivalent is granted.
 *
 * An explicitly granted legacy key is never downgraded — a workspace
 * that predates the CRUD matrix and still stores `people_manage: true`
 * keeps it.
 */
export function withDerivedLegacyPermissions<T extends Record<string, unknown>>(
  perms: T
): T & Record<string, boolean> {
  const out: Record<string, unknown> = { ...perms };

  for (const [legacyKey, sources] of Object.entries(LEGACY_PERMISSION_SOURCES)) {
    if (out[legacyKey] === true) continue;
    out[legacyKey] = sources.some((crudKey) => perms[crudKey] === true);
  }

  return out as T & Record<string, boolean>;
}

/** The legacy keys this module knows how to derive. */
export function derivableLegacyKeys(): string[] {
  return Object.keys(LEGACY_PERMISSION_SOURCES);
}
