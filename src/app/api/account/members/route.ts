import { NextRequest, NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers, fromDbRole } from "@/lib/auth/roles";
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
  if (fromProfile && fromProfile.toLowerCase() !== 'user' && fromProfile.toLowerCase() !== 'member') return fromProfile;
  const fromMeta = metaName?.trim();
  if (fromMeta && fromMeta.toLowerCase() !== 'user' && fromMeta.toLowerCase() !== 'member') return fromMeta;
  const localPart = email?.split("@")[0]?.trim();
  if (localPart) return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  return "Workspace Member";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId);

    // 1. Get all member memberships for this workspace
    const { data: memberRows, error: memberError } = await ctx.supabase
      .from("workspace_members")
      .select("id, user_id, role, role_id, created_at")
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
        const { data: listData, error: listErr } = await admin.auth.admin.listUsers();
        if (!listErr && listData?.users) {
          const needsSet = new Set(needsAuthLookup);
          for (const user of listData.users) {
            if (needsSet.has(user.id)) {
              const metaName = user.user_metadata?.full_name;
              authUsersMap.set(user.id, {
                metaName: typeof metaName === "string" ? metaName : null,
                email: user.email ?? null,
              });
            }
          }
        }
      } catch (err) {
        // Missing SUPABASE_SERVICE_ROLE_KEY or auth API hiccup —
        // degrade to the profile/email-local-part chain.
        console.warn("[GET /api/account/members] auth enrichment skipped:", err);
      }
    }

    // 4. Resolve the assigned per-resource role's display name. Scoped to
    //    this workspace, so a role_id from another tenant (impossible via
    //    the API, but cheap to guarantee) resolves to null rather than
    //    leaking a foreign role name.
    const roleNames = new Map<string, string>();
    const assignedRoleIds = Array.from(
      new Set(
        memberRows
          .map((r) => (r as { role_id: string | null }).role_id)
          .filter((id): id is string => !!id),
      ),
    );
    if (assignedRoleIds.length > 0) {
      const { data: roleRows } = await ctx.supabase
        .from("workspace_roles")
        .select("id, name")
        .eq("workspace_id", ctx.accountId)
        .in("id", assignedRoleIds);
      for (const r of roleRows ?? []) roleNames.set(r.id, r.name);
    }

    const members = memberRows.map((row) => {
      const profile = profilesMap.get(row.user_id);
      const authUser = authUsersMap.get(row.user_id);
      const email = profile?.email || authUser?.email || null;

      return {
        id: row.id,
        user_id: row.user_id,
        full_name: displayNameFrom(profile?.full_name, authUser?.metaName, email),
        email: canSeeEmails ? email : null,
        avatar_url: profile?.avatar_url ?? null,
        role: fromDbRole(row.role),
        role_id: (row as { role_id: string | null }).role_id ?? null,
        role_name:
          roleNames.get((row as { role_id: string | null }).role_id ?? "") ??
          null,
        joined_at: row.created_at,
      };
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
