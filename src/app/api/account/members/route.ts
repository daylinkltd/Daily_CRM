import { NextRequest, NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers } from "@/lib/auth/roles";
import type { AccountRole } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId);

    const { data, error } = await ctx.supabase
      .from("workspace_members")
      .select("user_id, role, created_at, profiles!inner(full_name, email, avatar_url)")
      .eq("workspace_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/account/members] fetch error:", error);
      return NextResponse.json(
        { error: "Failed to load members" },
        { status: 500 },
      );
    }

    const canSeeEmails = canManageMembers(ctx.role);

    const members = (data as any[]).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      let role: AccountRole = 'agent';
      if (row.role === 'owner') role = 'owner';
      else if (row.role === 'admin') role = 'admin';
      else if (row.role === 'member') role = 'agent';

      return {
        user_id: row.user_id,
        full_name: profile?.full_name ?? "",
        email: canSeeEmails ? profile?.email : null,
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
