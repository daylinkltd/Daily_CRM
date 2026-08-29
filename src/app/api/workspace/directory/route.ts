// ============================================================
// GET /api/workspace/directory?workspace_id=<uuid>
//
// Display names for everyone in a workspace, keyed BOTH by
// `workspace_members.id` and by `user_id` so any caller can look up
// whichever identifier it happens to hold.
//
// Why this exists rather than a client-side `profiles` query:
//
//   Reading `profiles` from the browser is subject to RLS, and in this
//   database the co-member SELECT policy is missing (migration 108 —
//   see its header). The result was that every page resolving teammate
//   names client-side rendered its fallback string: HR showed "Unknown
//   User" for all 30 staff, timesheets showed "Team Member", and the
//   only row that looked right was the viewer's own.
//
//   Migration 108 is still the systemic fix and fixes ~15 pages at
//   once. This route makes the pages people actually stare at correct
//   whether or not that policy is ever applied, because a directory of
//   names is not something a product should get wrong.
//
// Access: any active member of the workspace. Names and avatars are
// visible to colleagues by design — that is what a staff directory is.
// Email is included only for callers who can manage the team, matching
// the privacy line /api/account/members already draws.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTeamPermission } from "@/lib/auth/team-permissions";

export interface DirectoryEntry {
  member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

/**
 * Never returns a placeholder like "Unknown User": falls through
 * profile name → auth metadata name → the email's local part, so the
 * worst case is a recognisable handle rather than an anonymous row.
 */
function displayName(
  profileName: string | null | undefined,
  metaName: string | null | undefined,
  email: string | null | undefined,
): string {
  const candidates = [profileName, metaName];
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed && !["user", "member", "unknown user"].includes(trimmed.toLowerCase())) {
      return trimmed;
    }
  }
  const local = email?.split("@")[0]?.trim();
  if (local) {
    return local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return "Workspace Member";
}

export async function GET(request: NextRequest) {
  const workspaceId = new URL(request.url).searchParams.get("workspace_id");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: caller } = await admin
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!caller) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const { data: members, error: memberError } = await admin
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("workspace_id", workspaceId);
  if (memberError) {
    console.error("[GET /api/workspace/directory] members:", memberError.message);
    return NextResponse.json({ error: "Failed to load the directory" }, { status: 500 });
  }
  if (!members?.length) return NextResponse.json({ entries: [] });

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .in("user_id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  // Members whose profile row is missing or blank still deserve a name;
  // auth metadata carries the one they signed up with.
  const needsMetadata = members.filter((m) => {
    const p = profileMap.get(m.user_id);
    return !p?.full_name?.trim();
  });
  const metaNames = new Map<string, { name?: string; email?: string }>();
  if (needsMetadata.length > 0) {
    await Promise.all(
      needsMetadata.slice(0, 60).map(async (m) => {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        if (data?.user) {
          metaNames.set(m.user_id, {
            name: (data.user.user_metadata?.full_name as string) || undefined,
            email: data.user.email ?? undefined,
          });
        }
      }),
    );
  }

  const canSeeEmail = (
    await checkTeamPermission(admin, workspaceId, user.id, "read")
  ).allowed || caller.role === "owner" || caller.role === "admin";

  const entries: DirectoryEntry[] = members.map((m) => {
    const p = profileMap.get(m.user_id);
    const meta = metaNames.get(m.user_id);
    const email = p?.email ?? meta?.email ?? null;
    return {
      member_id: m.id,
      user_id: m.user_id,
      full_name: displayName(p?.full_name, meta?.name, email),
      email: canSeeEmail || m.user_id === user.id ? email : null,
      avatar_url: p?.avatar_url ?? null,
      role: m.role,
    };
  });

  return NextResponse.json({ entries });
}
