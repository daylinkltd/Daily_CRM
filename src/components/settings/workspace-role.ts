import { DEFAULT_ROLE_NAMES } from "@/lib/auth/resources";
import { TEAM_MEMBER_ROLE_NAMES } from "@/lib/auth/roles";

/** A row of `workspace_roles`, as the settings UI consumes it. */
export interface WorkspaceRoleRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
  is_system: boolean;
}

/** Columns the settings surfaces select from `workspace_roles`. */
export const WORKSPACE_ROLE_COLUMNS =
  "id, workspace_id, name, description, permissions, is_system";

/**
 * Built-ins first in their canonical Owner → Admin → Viewer order, then
 * custom roles alphabetically. Keeps the list stable across reloads
 * regardless of insertion order.
 */
export function sortRoles(roles: WorkspaceRoleRow[]): WorkspaceRoleRow[] {
  const rank = (r: WorkspaceRoleRow) => {
    const i = (DEFAULT_ROLE_NAMES as readonly string[]).indexOf(r.name);
    return r.is_system && i >= 0 ? i : DEFAULT_ROLE_NAMES.length;
  };
  return [...roles].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
}

/**
 * The `workspace_role` enum value to persist alongside a custom
 * `role_id`, so the legacy enum column stays coherent with the new
 * per-resource role. Owner is never assignable here — promotions go
 * through the transfer-ownership flow.
 */
export function enumRoleForRoleName(
  name: string | null | undefined,
): "admin" | "agent" | "viewer" {
  if (name === "Admin") return "admin";
  if (name === "Viewer") return "viewer";
  // "Team Member" and its legacy name "Agent" both land on the 'agent'
  // enum value, as does any custom role.
  return "agent";
}

/**
 * The built-in role a member's legacy enum value corresponds to, used to
 * pre-select the dropdown for members who predate `role_id`.
 *
 * 'agent' resolves to the staff role — "Team Member", or "Agent" in a
 * workspace where migration 116 has not run yet. The caller matches the
 * returned candidates against the workspace's actual `workspace_roles`
 * rows, so whichever name is really there wins.
 */
export function builtInRoleNamesForEnum(
  role: "owner" | "admin" | "agent" | "viewer",
): string[] {
  if (role === "owner") return ["Owner"];
  if (role === "admin") return ["Admin"];
  if (role === "viewer") return ["Viewer"];
  return [...TEAM_MEMBER_ROLE_NAMES];
}

/** First candidate name, for display when no matching row is found. */
export function builtInRoleNameForEnum(
  role: "owner" | "admin" | "agent" | "viewer",
): string | null {
  return builtInRoleNamesForEnum(role)[0] ?? null;
}
