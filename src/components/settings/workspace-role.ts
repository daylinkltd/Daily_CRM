import { DEFAULT_ROLE_NAMES } from "@/lib/auth/resources";

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
  return "agent";
}

/**
 * The built-in role a member's legacy enum value corresponds to, used to
 * pre-select the dropdown for members who predate `role_id`. 'agent' has
 * no built-in equivalent (it's the "member" default), so it returns null
 * and the dropdown shows an explicit "No role assigned" placeholder
 * rather than silently implying a role.
 */
export function builtInRoleNameForEnum(
  role: "owner" | "admin" | "agent" | "viewer",
): string | null {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Viewer";
  return null;
}
