import { NextRequest, NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers } from "@/lib/auth/roles";
import type { AccountRole } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId);

    // 1. Get all member memberships for this workspace
    const { data: memberRows, error: memberError } = await ctx.supabase
      .from("workspace_members")
      .select("user_id, role, created_at")
      .eq("workspace_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (memberError) {
      console.error("[GET /api/account/members] fetch members error:", memberError);
      return NextResponse.json(
        { error: "Failed to load workspace members" },
        { status: 500 },
      );
    }

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // 2. Fetch profile details in a separate query to bypass relationship cache issues
    const userIds = memberRows.map((r) => r.user_id);
    const { data: profileRows, error: profileError } = await ctx.supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url")
      .in("user_id", userIds);

    if (profileError) {
      console.error("[GET /api/account/members] fetch profiles error:", profileError);
      return NextResponse.json(
        { error: "Failed to load member profiles" },
        { status: 500 },
      );
    }

    const profilesMap = new Map(profileRows?.map((p) => [p.user_id, p]) ?? []);
    const canSeeEmails = canManageMembers(ctx.role);

    const members = memberRows.map((row) => {
      const profile = profilesMap.get(row.user_id);
      
      let role: AccountRole = 'agent';
      if (row.role === 'owner') role = 'owner';
      else if (row.role === 'admin') role = 'admin';
      else if (row.role === 'member') role = 'agent';

      return {
        user_id: row.user_id,
        full_name: profile?.full_name ?? "User",
        email: canSeeEmails ? (profile?.email ?? null) : null,
        avatar_url: profile?.avatar_url ?? null,
        role,
        joined_at: row.created_at,
      };
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
