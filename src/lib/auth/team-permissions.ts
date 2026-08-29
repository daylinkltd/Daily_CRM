// ============================================================
// Who may add, re-role and remove workspace members.
//
// Before this, "can create users" was hardcoded: owner-only for new
// accounts, owner-or-admin for everything else. That is a reasonable
// default and stays the default, but it was not configurable — a
// workspace could not let its HR lead onboard staff without also
// handing them full admin.
//
// Now the `team_members` matrix resource decides, with two rules the
// matrix itself cannot express:
//
//   • The OWNER always passes. A workspace must never be able to lock
//     its own owner out of managing it.
//   • The permission is read from the member's assigned role even for
//     admins. `has_resource_permission` in the database gives owners
//     AND admins a blanket bypass, which is right for data tables but
//     wrong here: "which roles can create users" is meaningless if
//     admin is unconditionally yes. Admins therefore keep an implicit
//     grant only while their role carries no explicit answer, so
//     existing workspaces behave exactly as before an admin's role is
//     first edited.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamAction = "create" | "read" | "update" | "delete";

export const TEAM_RESOURCE = "team_members";

export function teamPermissionKey(action: TeamAction): string {
  return `${TEAM_RESOURCE}:${action}`;
}

export interface TeamPermissionVerdict {
  allowed: boolean;
  /** 'owner' | 'role' | 'admin-default' | 'denied' — for the audit trail. */
  reason: string;
  role: string | null;
}

/**
 * Resolve whether `userId` may perform `action` on the membership of
 * `workspaceId`. Uses whichever client it is given: pass the admin
 * client from a route that already has one so the role lookup is not
 * itself subject to RLS.
 */
export async function checkTeamPermission(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
  action: TeamAction,
): Promise<TeamPermissionVerdict> {
  const { data: member } = await client
    .from("workspace_members")
    .select("role, role_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return { allowed: false, reason: "not-a-member", role: null };

  if (member.role === "owner") {
    return { allowed: true, reason: "owner", role: "owner" };
  }

  let permissions: Record<string, unknown> | null = null;
  if (member.role_id) {
    const { data: role } = await client
      .from("workspace_roles")
      .select("permissions")
      .eq("id", member.role_id)
      .maybeSingle();
    permissions = (role?.permissions as Record<string, unknown> | null) ?? null;
  }

  const key = teamPermissionKey(action);
  const explicit = permissions && key in permissions ? permissions[key] === true : null;

  if (explicit !== null) {
    return {
      allowed: explicit,
      reason: explicit ? "role" : "denied",
      role: member.role,
    };
  }

  // No explicit answer in this role — fall back to the historical rule
  // so nothing changes until someone actually edits the matrix.
  const legacy = member.role === "admin";
  return {
    allowed: legacy,
    reason: legacy ? "admin-default" : "denied",
    role: member.role,
  };
}

/** Message shown when the check fails, phrased as configuration. */
export function teamPermissionError(action: TeamAction): string {
  const what: Record<TeamAction, string> = {
    create: "add people to this workspace",
    read: "view the team roster",
    update: "change a teammate's role",
    delete: "remove people from this workspace",
  };
  return `Your role does not allow you to ${what[action]}. An owner can grant this under Settings → Roles → Team & Access.`;
}
