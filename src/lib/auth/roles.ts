// ============================================================
// Account role helpers — pure, unit-testable, no I/O.
//
// Mirrors the `account_role_enum` Postgres type from migration
// 017_account_sharing.sql. The hierarchy is intentionally a flat
// ordinal (owner=4 … viewer=1) — it matches the same CASE
// expression the `is_account_member(account_id, min_role)` SQL
// helper uses, so server-side TypeScript guards and database-side
// RLS speak the same language.
//
// Predicates (`canManageMembers`, `canEditSettings`, …) are the
// single source of truth for "what can this role do?" — both
// API route guards and UI gates should call them rather than
// open-coding their own role checks. That keeps role-policy
// changes a one-file diff.
// ============================================================

export type AccountRole = "owner" | "admin" | "agent" | "viewer";

/** Ordered list of every valid role, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  "viewer",
  "agent",
  "admin",
  "owner",
] as const;

/**
 * Numeric rank of a role. Higher = more privileged. Mirrors the
 * CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountRole): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "agent":
      return 2;
    case "viewer":
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`. Use this
 * for any "user has at least admin" / "at least agent" checks.
 */
export function hasMinRole(role: AccountRole, min: AccountRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountRole`. */
export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === "string" &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

// ============================================================
// DB <-> app role mapping
//
// The `workspace_members.role` column uses the `workspace_role`
// Postgres enum: 'owner' | 'admin' | 'member' | 'viewer'
// (migration 009, 'viewer' added in 062). The app-level
// `AccountRole` calls the write-capable non-admin role 'agent'
// where the DB calls it 'member'; every other role maps 1:1.
//
// These two functions are the ONLY place that translation may
// happen. Open-coding the mapping at call sites is how 'viewer'
// silently collapsed onto 'member' (full agent permissions) —
// don't reintroduce that.
// ============================================================

/** The `workspace_role` Postgres enum, as stored in `workspace_members.role`. */
export type WorkspaceDbRole = "owner" | "admin" | "member" | "viewer";

/** App role → DB enum value, for writes to `workspace_members.role`. */
export function toDbRole(role: AccountRole): WorkspaceDbRole {
  return role === "agent" ? "member" : role;
}

/**
 * DB enum value → app role, for reads of `workspace_members.role`.
 * Unknown values fall back to 'agent' (matches the historical
 * behaviour for rows written before the enum grew).
 */
export function fromDbRole(dbRole: string | null | undefined): AccountRole {
  switch (dbRole) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "viewer":
      return "viewer";
    default:
      return "agent";
  }
}

/**
 * The built-in system role a member should fall back to when no custom
 * role is chosen for them.
 *
 * `workspace_members.role_id` must never be NULL. The CRUD policies from
 * migration 074 are RESTRICTIVE and `has_resource_permission` returns
 * FALSE when the role JOIN finds nothing, so a role-less member is denied
 * every operation — including SELECT — on every catalogued table, while
 * `get_user_permissions` still hands the UI a set of coarse keys and
 * happily renders pages the database will then refuse.
 *
 * This is the same mapping migration 073 used to backfill the column, so
 * new members land where existing ones already are. Kept in one place
 * because the trigger in migration 097 encodes it too.
 */
export function defaultSystemRoleName(dbRole: WorkspaceDbRole): string {
  return dbRole === "owner" || dbRole === "admin"
    ? ADMIN_ROLE_NAME
    : TEAM_MEMBER_ROLE_NAME;
}

/**
 * The built-in role for ordinary staff, renamed from "Agent" to
 * "Team Member" — "agent" described a support-desk seat, which is not
 * what most of these people do.
 *
 * Only the DISPLAY name changed. The `workspace_members.role` enum value
 * stays `'agent'`: it is written into a CHECK constraint, a trigger and
 * every existing row, and renaming it would be a data migration with no
 * user-visible benefit.
 *
 * Both names are accepted when looking a role up by name, because a
 * workspace only carries the new name once migration 119 has run — code
 * that assumed one or the other would break on exactly one side of that
 * deploy.
 */
export const TEAM_MEMBER_ROLE_NAME = "Team Member";
export const LEGACY_TEAM_MEMBER_ROLE_NAME = "Agent";
export const ADMIN_ROLE_NAME = "Admin";

/** Every name a workspace's built-in staff role may be stored under. */
export const TEAM_MEMBER_ROLE_NAMES: readonly string[] = [
  TEAM_MEMBER_ROLE_NAME,
  LEGACY_TEAM_MEMBER_ROLE_NAME,
];

/** Names to match when resolving the fallback role for a db enum value. */
export function systemRoleNameCandidates(dbRole: WorkspaceDbRole): string[] {
  return dbRole === "owner" || dbRole === "admin"
    ? [ADMIN_ROLE_NAME]
    : [...TEAM_MEMBER_ROLE_NAMES];
}

// ============================================================
// Capability predicates
//
// Every UI gate and API route guard should call one of these
// instead of comparing role strings inline. Adding a capability
// = one new predicate here + one call site change per consumer.
// ============================================================

/** Owner / admin: invite, remove, change roles. */
export function canManageMembers(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin: edit account-wide settings (WhatsApp config,
 * message templates, pipelines, tags, custom fields, account
 * name). Excludes per-user settings like avatar or own password.
 */
export function canEditSettings(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin / agent: write operational data — send messages,
 * create contacts, move deals, run broadcasts, edit automations.
 * Viewers are read-only.
 */
export function canSendMessages(role: AccountRole): boolean {
  return hasMinRole(role, "agent");
}

/**
 * Viewer: read-only across everything. Provided as a positive
 * predicate so UI gates read naturally (`if (canViewOnly(role))`
 * shows the "Read-only" tooltip without inverting `canSendMessages`).
 */
export function canViewOnly(role: AccountRole): boolean {
  return role === "viewer";
}

/** Owner only: irreversible destructive operations. */
export function canDeleteAccount(role: AccountRole): boolean {
  return role === "owner";
}

/** Owner only: hand the account to another member. */
export function canTransferOwnership(role: AccountRole): boolean {
  return role === "owner";
}
