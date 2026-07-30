import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOutlookEmail, type OutlookConfig } from "@/lib/integrations/outlook";
import { decrypt } from "@/lib/whatsapp/encryption";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, to, subject, bodyHtml } = body;

    if (!workspaceId || !to || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "Workspace ID, to address, subject, and bodyHtml are required" },
        { status: 400 }
      );
    }

    const { data: configRow } = await supabase
      .from("workspace_integrations")
      .select("settings")
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
    if (!settings.encrypted_client_secret) {
      return NextResponse.json({ error: "Outlook client secret missing" }, { status: 400 });
    }

    const clientSecret = decrypt(settings.encrypted_client_secret);
    const outlookConfig: OutlookConfig = {
      tenantId: settings.tenant_id,
      clientId: settings.client_id,
      clientSecret,
      fromEmail: settings.from_email,
    };

    await sendOutlookEmail({
      config: outlookConfig,
      to,
      subject,
      bodyHtml,
    });

    return NextResponse.json({ success: true, message: "Email sent successfully via Outlook" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 });
  }
}
