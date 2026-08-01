// ============================================================
// Email an invite link from the workspace's OWN mailbox.
//
// Invitations are link-based on purpose (no email service required),
// but when a workspace has connected Outlook we can deliver the link
// from their own domain instead of asking the admin to copy-paste it
// — and without involving Supabase's email at all.
//
// POST { workspace_id, to, url, role?, inviter_name? }
//
// Gated like the Outlook send route: membership + owner/admin or the
// `integrations` permission, and rate limited. The invite link itself
// is supplied by the caller because it is only ever available in the
// create response (we store a hash, never the plaintext token).
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOutlookEmail, type OutlookConfig } from "@/lib/integrations/outlook";
import { decrypt } from "@/lib/whatsapp/encryption";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`invite-email:${user.id}`, RATE_LIMITS.send);
  if (!limit.success) return rateLimitResponse(limit);

  const { workspace_id, to, url, role, inviter_name } = await request.json();
  if (!workspace_id || !to || !url) {
    return NextResponse.json(
      { error: "workspace_id, to and url are required" },
      { status: 400 },
    );
  }
  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
  }
  // Only ever mail a link we generated.
  let inviteUrl: URL;
  try {
    inviteUrl = new URL(String(url));
  } catch {
    return NextResponse.json({ error: "Invalid invite URL" }, { status: 400 });
  }
  if (!/^https?:$/.test(inviteUrl.protocol) || !inviteUrl.pathname.startsWith("/join/")) {
    return NextResponse.json({ error: "Invalid invite URL" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can email invitations" },
      { status: 403 },
    );
  }

  const { data: configRow } = await supabase
    .from("workspace_integrations")
    .select("id, settings")
    .eq("workspace_id", workspace_id)
    .eq("provider", "outlook")
    .eq("status", "active")
    .maybeSingle();

  if (!configRow?.settings?.encrypted_client_secret) {
    return NextResponse.json(
      { error: "Connect Outlook in Integrations to email invitations from your own mailbox" },
      { status: 400 },
    );
  }

  const settings = configRow.settings;
  let clientSecret: string;
  try {
    clientSecret = decrypt(settings.encrypted_client_secret);
  } catch {
    return NextResponse.json(
      { error: "Stored Outlook credentials could not be read. Reconnect the integration." },
      { status: 400 },
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspace_id)
    .single();
  const workspaceName = workspace?.name || "our workspace";
  const invitedBy = typeof inviter_name === "string" && inviter_name.trim()
    ? inviter_name.trim()
    : "A teammate";

  const config: OutlookConfig = {
    tenantId: settings.tenant_id,
    clientId: settings.client_id,
    clientSecret,
    fromEmail: settings.from_email,
  };

  const safeUrl = escapeHtml(inviteUrl.toString());
  const bodyHtml = `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.6">
      <p>${escapeHtml(invitedBy)} has invited you to join
      <strong>${escapeHtml(workspaceName)}</strong>${role ? ` as ${escapeHtml(String(role))}` : ""}.</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#00aef0;color:#ffffff;padding:12px 22px;text-decoration:none;font-weight:600;display:inline-block">
          Accept invitation
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">
        If the button doesn't work, paste this link into your browser:<br>
        <a href="${safeUrl}">${safeUrl}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af">
        This invitation is single-use and expires. If you weren't expecting it, you can ignore this email.
      </p>
    </div>`;

  try {
    await sendOutlookEmail({
      config,
      to: to.trim(),
      subject: `You're invited to join ${workspaceName}`,
      bodyHtml,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outlook rejected the message";
    await supabase
      .from("workspace_integrations")
      .update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", configRow.id);
    return NextResponse.json({ error: `Could not email the invite: ${message}` }, { status: 502 });
  }

  return NextResponse.json({ success: true, message: `Invitation emailed to ${to.trim()}` });
}
