import { NextRequest, NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers } from "@/lib/auth/roles";
import type { AccountRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Display-name fallback chain for a member row:
//   profiles.full_name → auth user_metadata.full_name → email local part.
// Never the literal "User" — invited members whose profile row was
// created by the signup trigger with full_name = '' (or not at all)
// used to render as a bare "User" in Settings → Members.
function displayNameFrom(
  profileName: string | null | undefined,
  metaName: string | null | undefined,
  email: string | null | undefined,
): string {
  const fromProfile = profileName?.trim();
  if (fromProfile) return fromProfile;
  const fromMeta = metaName?.trim();
  if (fromMeta) return fromMeta;
  const localPart = email?.split("@")[0]?.trim();
  if (localPart) return localPart;
  return "Member";
}

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

    // 3. For members whose profile row is missing or has an empty
    //    full_name, resolve auth user_metadata.full_name / email via
    //    the service-role client. Server-only enrichment — the member
    //    set was already workspace-scoped + membership-checked above,
    //    so this never leaks data across tenants.
    const needsAuthLookup = memberRows
      .map((r) => r.user_id)
      .filter((id) => {
        const p = profilesMap.get(id);
        return !p?.full_name?.trim() || !p?.email;
      });

    const authUsersMap = new Map<
      string,
      { metaName: string | null; email: string | null }
    >();
    if (needsAuthLookup.length > 0) {
      try {
        const admin = createAdminClient();
        const lookups = await Promise.all(
          needsAuthLookup.map(async (id) => {
            const { data, error } = await admin.auth.admin.getUserById(id);
            if (error || !data?.user) return null;
            const metaName = data.user.user_metadata?.full_name;
            return {
              id,
              metaName: typeof metaName === "string" ? metaName : null,
              email: data.user.email ?? null,
            };
          }),
        );
        for (const entry of lookups) {
          if (entry) {
            authUsersMap.set(entry.id, {
              metaName: entry.metaName,
              email: entry.email,
            });
          }
        }
      } catch (err) {
        // Missing SUPABASE_SERVICE_ROLE_KEY or auth API hiccup —
        // degrade to the profile/email-local-part chain.
        console.warn("[GET /api/account/members] auth enrichment skipped:", err);
      }
    }

    const members = memberRows.map((row) => {
      const profile = profilesMap.get(row.user_id);
      const authUser = authUsersMap.get(row.user_id);
      const email = profile?.email || authUser?.email || null;

      let role: AccountRole = 'agent';
      if (row.role === 'owner') role = 'owner';
      else if (row.role === 'admin') role = 'admin';
      else if (row.role === 'member') role = 'agent';

      return {
        user_id: row.user_id,
        full_name: displayNameFrom(profile?.full_name, authUser?.metaName, email),
        email: canSeeEmails ? email : null,
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
