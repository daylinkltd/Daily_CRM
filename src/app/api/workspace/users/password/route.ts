// ============================================================
// POST /api/workspace/users/password
//
// Owner/admin credential control over a teammate, from
// Settings → Members:
//
//   { workspace_id, user_id, mode: 'set' | 'generate' | 'email_reset',
//     password? }
//
//   set         — the admin types the new password
//   generate    — server mints a strong random one, returned ONCE
//   email_reset — Supabase recovery email with a correct redirect
//
// RBAC is rank-based and enforced here, not just hidden in the UI:
// the owner can manage anyone below them (admins included); an admin
// can manage members/viewers but never another admin or the owner;
// nobody manages themselves here (Settings → Security is for that) and
// platform super-admins are untouchable from tenant screens.
//
// Cross-tenant hijack guard: a password is a USER credential, not a
// workspace one. If the target also belongs to other workspaces,
// setting their password here would hand this workspace's admin the
// keys to those tenants too — so set/generate are refused for
// multi-workspace users and the email flow (where the target's mailbox
// is the second factor) is offered instead.
//
// Every use lands in the admin-only platform activity log, and the
// target's devices are signed out immediately — a credential change
// that leaves old sessions alive isn't a credential change.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVITY, logActivity } from "@/lib/saas-admin/activity";
import {
  generatePassword,
  recoveryRedirectUrl,
  validateNewPassword,
} from "@/lib/auth/passwords";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

const RANK: Record<string, number> = { owner: 3, admin: 2, member: 1, viewer: 1 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspace_id, user_id: targetUserId, mode, password } = body as {
      workspace_id?: string;
      user_id?: string;
      mode?: string;
      password?: string;
    };

    if (!workspace_id || !targetUserId || !mode) {
      return NextResponse.json(
        { error: "workspace_id, user_id and mode are required" },
        { status: 400 },
      );
    }
    if (!["set", "generate", "email_reset"].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be 'set', 'generate' or 'email_reset'" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(`admin:memberPassword:${user.id}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const { data: caller } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (caller?.role !== "owner" && caller?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: owner or admin role required" },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const { data: target } = await admin
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Member not found in this workspace" }, { status: 404 });
    }

    if (target.user_id === user.id) {
      return NextResponse.json(
        { error: "Change your own password from Settings → Security." },
        { status: 400 },
      );
    }
    if ((RANK[caller.role] ?? 0) <= (RANK[target.role] ?? 0)) {
      return NextResponse.json(
        {
          error:
            target.role === "owner"
              ? "The workspace owner's password can only be reset by the owner themselves."
              : "Admins can manage members and viewers — only the owner can manage another admin.",
        },
        { status: 403 },
      );
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("email, full_name, system_role")
      .eq("user_id", target.user_id)
      .maybeSingle();
    if (targetProfile?.system_role === "super_admin") {
      return NextResponse.json(
        { error: "This account is platform staff and cannot be managed from here." },
        { status: 403 },
      );
    }

    // ---------- email_reset: mailbox is the second factor ----------
    if (mode === "email_reset") {
      if (!targetProfile?.email) {
        return NextResponse.json({ error: "This member has no email on file." }, { status: 400 });
      }
      const { error } = await supabase.auth.resetPasswordForEmail(targetProfile.email, {
        redirectTo: recoveryRedirectUrl(request),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logActivity({
        event: ACTIVITY.MEMBER_PASSWORD_RESET_EMAILED,
        workspaceId: workspace_id,
        userId: user.id,
        userEmail: user.email,
        details: { target_email: targetProfile.email, target_member_id: target.id },
        request,
      });
      return NextResponse.json({ ok: true, mode });
    }

    // ---------- set / generate ----------
    // A user in several workspaces: their password opens ALL of them,
    // so no single workspace's admin may choose it.
    const { count: otherMemberships } = await admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", target.user_id)
      .neq("workspace_id", workspace_id);
    if ((otherMemberships ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This person also belongs to other workspaces, so their password can't be set from here — use “Email reset link” instead and let them choose it.",
          code: "multi_workspace",
        },
        { status: 409 },
      );
    }

    let newPassword: string;
    if (mode === "generate") {
      newPassword = generatePassword();
    } else {
      const check = validateNewPassword(password);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      newPassword = check.password;
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(target.user_id, {
      password: newPassword,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Old devices must not survive a credential change.
    await admin.rpc("revoke_user_sessions", {
      p_user_id: target.user_id,
      p_reason: "password changed by workspace admin",
    });

    await logActivity({
      event: ACTIVITY.MEMBER_PASSWORD_SET,
      severity: "warning",
      workspaceId: workspace_id,
      userId: user.id,
      userEmail: user.email,
      details: {
        target_email: targetProfile?.email ?? null,
        target_member_id: target.id,
        mode,
      },
      request,
    });

    // The generated credential is returned exactly once and never stored.
    return NextResponse.json({
      ok: true,
      mode,
      ...(mode === "generate" ? { password: newPassword } : {}),
    });
  } catch (err) {
    console.error("[workspace/users/password] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
