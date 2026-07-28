// ============================================================
// /api/account/members/[userId]
//
//   PATCH  — change a member's role.   Admin+.
//   DELETE — remove a member.          Admin+.
//
// Both delegate to SECURITY DEFINER RPCs from migration 018:
//   - set_member_role(p_user_id, p_new_role)
//   - remove_account_member(p_user_id)
//
// The RPCs do the *real* authorisation work — caller must be
// admin+, target must be in caller's account, target can't be the
// owner, can't be self. The TS layer here only forwards the call
// and maps Postgres SQLSTATEs back to HTTP statuses.
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isAccountRole, toDbRole } from "@/lib/auth/roles";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Map known SQLSTATEs from the RPCs (see migration 018) onto HTTP
// statuses. The `error.code` field is the SQLSTATE; the `message`
// is the human-readable RAISE message we put in the migration.
function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[members route] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to update member" },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await requireRole("admin", workspaceId);

    const limit = checkRateLimit(
      `admin:memberRole:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { role?: unknown; role_id?: unknown }
      | null;
    const role = body?.role;
    // Optional per-resource role (a `workspace_roles` row). The legacy
    // enum `role` is still required and still written, so nothing that
    // reads the enum has to change; `role_id` is what the CRUD matrix
    // in migration 074 actually consults.
    const roleIdRaw = body?.role_id;
    const hasRoleId = roleIdRaw !== undefined;
    if (
      hasRoleId &&
      roleIdRaw !== null &&
      typeof roleIdRaw !== "string"
    ) {
      return NextResponse.json(
        { error: "'role_id' must be a workspace_roles id or null" },
        { status: 400 },
      );
    }
    const roleId = (roleIdRaw as string | null | undefined) ?? null;

    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "'role' must be one of owner, admin, agent, viewer" },
        { status: 400 },
      );
    }

    if (role === "owner") {
      return NextResponse.json(
        {
          error:
            "Use POST /api/account/transfer-ownership to promote a member to owner",
        },
        { status: 400 },
      );
    }

    // Map AccountRole ('admin' | 'agent' | 'viewer') back to
    // workspace_role — 'viewer' persists distinctly (migration 062).
    const dbRole = toDbRole(role);

    // Prevent demoting the owner
    const { data: targetMember } = await ctx.supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", userId)
      .eq("workspace_id", ctx.accountId)
      .maybeSingle();

    if (targetMember?.role === "owner") {
      return NextResponse.json(
        { error: "Cannot demote the workspace owner" },
        { status: 400 }
      );
    }

    // Validate role_id belongs to THIS workspace before writing it —
    // otherwise an admin could paste another tenant's role id and grant
    // their member a foreign permission matrix.
    if (hasRoleId && roleId) {
      const { data: roleRow } = await ctx.supabase
        .from("workspace_roles")
        .select("id, name, is_system")
        .eq("id", roleId)
        .eq("workspace_id", ctx.accountId)
        .maybeSingle();

      if (!roleRow) {
        return NextResponse.json(
          { error: "That role doesn't belong to this workspace" },
          { status: 400 },
        );
      }
      if (roleRow.is_system && roleRow.name === "Owner") {
        return NextResponse.json(
          {
            error:
              "The built-in Owner role can't be assigned — use transfer-ownership instead",
          },
          { status: 400 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = { role: dbRole };
    if (hasRoleId) updatePayload.role_id = roleId;

    const { error } = await ctx.supabase
      .from("workspace_members")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("workspace_id", ctx.accountId);

    if (error) {
      console.error("[members route PATCH] update error:", error);
      // 22P02 = invalid input value for enum: the 'viewer' value hasn't
      // been added to workspace_role yet. Say so instead of a generic
      // failure, so the operator knows the fix is a pending migration.
      const isMissingEnumValue =
        (error as { code?: string }).code === "22P02" ||
        /invalid input value for enum/i.test(error.message ?? "");
      if (isMissingEnumValue && dbRole === "viewer") {
        return NextResponse.json(
          {
            error:
              "The read-only 'viewer' role isn't enabled on this database yet. Apply migration 065_add_viewer_workspace_role.sql (then 066/067) in Supabase, or pick agent instead.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await requireRole("admin", workspaceId);

    const limit = checkRateLimit(
      `admin:memberRemove:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    // Prevent deleting the owner
    const { data: targetMember } = await ctx.supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", userId)
      .eq("workspace_id", ctx.accountId)
      .maybeSingle();

    if (targetMember?.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the workspace owner" },
        { status: 400 }
      );
    }

    const { error } = await ctx.supabase
      .from("workspace_members")
      .delete()
      .eq("user_id", userId)
      .eq("workspace_id", ctx.accountId);

    if (error) {
      console.error("[members route DELETE] delete error:", error);
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
