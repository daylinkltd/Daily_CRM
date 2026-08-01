// ============================================================
// Send mail through the workspace's Outlook (Microsoft Graph)
// app registration.
//
// This sends FROM the company mailbox with app-only Graph
// credentials, so it is gated like an outbound channel, not a read:
//   - authenticated
//   - an active member of the workspace (explicit check, not just a
//     reliance on the table's RLS)
//   - holds the `integrations` permission — previously ANY active
//     member could send arbitrary HTML to any recipient as the
//     company, which is a phishing primitive
//   - rate limited per user, like /api/whatsapp/send
//   - recipients validated, and failures recorded on the integration
//     row instead of echoing raw crypto/Graph errors to the client
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOutlookEmail, type OutlookConfig } from "@/lib/integrations/outlook";
import { decrypt } from "@/lib/whatsapp/encryption";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(`outlook-send:${user.id}`, RATE_LIMITS.send);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const { workspaceId, to, subject, bodyHtml } = body;

    if (!workspaceId || !to || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "Workspace ID, to address, subject, and bodyHtml are required" },
        { status: 400 }
      );
    }
    if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
      return NextResponse.json({ error: "A single valid recipient email address is required" }, { status: 400 });
    }
    if (typeof subject !== "string" || typeof bodyHtml !== "string") {
      return NextResponse.json({ error: "Subject and bodyHtml must be strings" }, { status: 400 });
    }

    // Sending as the company is an admin/integrations capability.
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id, role, role_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();
    if (!member) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }
    if (!["owner", "admin"].includes(member.role)) {
      const { data: allowed } = await supabase.rpc("has_workspace_permission", {
        p_workspace_id: workspaceId,
        p_user_id: user.id,
        p_permission: "integrations",
      });
      if (allowed !== true) {
        return NextResponse.json(
          { error: "You do not have permission to send email as this workspace" },
          { status: 403 }
        );
      }
    }

    const { data: configRow } = await supabase
      .from("workspace_integrations")
      .select("id, settings")
      .eq("workspace_id", workspaceId)
      .eq("provider", "outlook")
      .eq("status", "active")
      .maybeSingle();

    if (!configRow || !configRow.settings) {
      return NextResponse.json(
        { error: "Microsoft Outlook integration is not active for this workspace" },
        { status: 400 }
      );
    }

    const settings = configRow.settings;
    // A partially-written row would otherwise surface as an opaque
    // Azure error; name the missing piece instead.
    for (const field of ["tenant_id", "client_id", "from_email", "encrypted_client_secret"] as const) {
      if (!settings[field]) {
        return NextResponse.json(
          { error: `Outlook integration is incomplete — ${field.replace(/_/g, " ")} is missing. Reconnect it in Integrations.` },
          { status: 400 }
        );
      }
    }

    let clientSecret: string;
    try {
      clientSecret = decrypt(settings.encrypted_client_secret);
    } catch {
      // Never leak crypto internals; this means the key rotated or the
      // stored value is corrupt.
      return NextResponse.json(
        { error: "Stored Outlook credentials could not be read. Reconnect the integration." },
        { status: 400 }
      );
    }

    const outlookConfig: OutlookConfig = {
      tenantId: settings.tenant_id,
      clientId: settings.client_id,
      clientSecret,
      fromEmail: settings.from_email,
    };

    try {
      await sendOutlookEmail({ config: outlookConfig, to: to.trim(), subject, bodyHtml });
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : "Outlook rejected the message";
      // Surface the failure on the integration row so Integrations can
      // show it, rather than failing silently for the next caller.
      await supabase
        .from("workspace_integrations")
        .update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("id", configRow.id);
      return NextResponse.json({ error: `Outlook send failed: ${message}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Email sent successfully via Outlook" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
