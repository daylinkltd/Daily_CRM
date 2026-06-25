// ============================================================
// Server-side account context — for API routes and server
// components. Reads the caller's profile + account in one round
// trip and verifies role on demand.
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { hasMinRole, isAccountRole, type AccountRole } from "./roles";

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[toErrorResponse] uncategorized error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export interface AccountContext {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  role: AccountRole;
  account: { id: string; name: string };
}

export async function getCurrentAccount(workspaceId?: string): Promise<AccountContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new UnauthorizedError();
  }

  let targetWorkspaceId = workspaceId;

  if (!targetWorkspaceId) {
    // Fallback: get the first workspace the user belongs to
    const { data: firstMember } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    targetWorkspaceId = firstMember?.workspace_id;
  }

  if (!targetWorkspaceId) {
    throw new ForbiddenError("User is not linked to any workspace");
  }

  // Get the member's role and the workspace details
  const { data: member, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name)")
    .eq("workspace_id", targetWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member || !member.workspaces) {
    console.error("[getCurrentAccount] member fetch error:", error);
    throw new ForbiddenError("Could not load workspace context");
  }

  const workspaceRow = Array.isArray(member.workspaces) ? member.workspaces[0] : member.workspaces;

  // Map workspace roles ('owner', 'admin', 'member') to AccountRole ('owner', 'admin', 'agent', 'viewer')
  let role: AccountRole = 'agent';
  if (member.role === 'owner') role = 'owner';
  else if (member.role === 'admin') role = 'admin';
  else if (member.role === 'member') role = 'agent';

  return {
    supabase,
    userId: user.id,
    accountId: workspaceRow.id,
    role,
    account: { id: workspaceRow.id, name: workspaceRow.name },
  };
}

export async function requireRole(min: AccountRole, workspaceId?: string): Promise<AccountContext> {
  const ctx = await getCurrentAccount(workspaceId);
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`,
    );
  }
  return ctx;
}
