import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testOutlookConnection, type OutlookConfig } from "@/lib/integrations/outlook";
import { decrypt, encrypt } from "@/lib/whatsapp/encryption";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    const { data: config } = await supabase
      .from("workspace_integrations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", "outlook")
      .maybeSingle();

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    const settings = config.settings || {};
    return NextResponse.json({
      configured: true,
      provider: "outlook",
      tenantId: settings.tenant_id || "",
      clientId: settings.client_id || "",
      fromEmail: settings.from_email || "",
      status: config.status || "active",
      updatedAt: config.updated_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load Outlook config" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, tenantId, clientId, clientSecret, fromEmail, action } = body;

    if (!workspaceId || !tenantId || !clientId || !fromEmail) {
      return NextResponse.json(
        { error: "Workspace ID, Tenant ID, Client ID, and From Email are required" },
        { status: 400 }
      );
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json({ error: "Only workspace admins can configure integrations" }, { status: 403 });
    }

    // Resolve client secret (if testing/updating without re-entering unchanged secret)
    let secretToUse = clientSecret;
    if (!secretToUse) {
      const { data: existing } = await supabase
        .from("workspace_integrations")
        .select("settings")
        .eq("workspace_id", workspaceId)
        .eq("provider", "outlook")
        .maybeSingle();

      if (existing?.settings?.encrypted_client_secret) {
        secretToUse = decrypt(existing.settings.encrypted_client_secret);
      }
    }

    if (!secretToUse) {
      return NextResponse.json({ error: "Client Secret is required" }, { status: 400 });
    }

    const outlookConfig: OutlookConfig = {
      tenantId: tenantId.trim(),
      clientId: clientId.trim(),
      clientSecret: secretToUse.trim(),
      fromEmail: fromEmail.trim(),
    };

    // If testing connection
    if (action === "test") {
      const testResult = await testOutlookConnection(outlookConfig);
      if (!testResult.success) {
        return NextResponse.json({ error: testResult.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: testResult.message });
    }

    // Verify before saving
    const testResult = await testOutlookConnection(outlookConfig);
    if (!testResult.success) {
      return NextResponse.json(
        { error: `Validation failed: ${testResult.message}` },
        { status: 400 }
      );
    }

    // Save encrypted credentials to workspace_integrations
    const encryptedSecret = encrypt(secretToUse.trim());
    const payload = {
      workspace_id: workspaceId,
      provider: "outlook",
      status: "active",
      settings: {
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        from_email: fromEmail.trim(),
        encrypted_client_secret: encryptedSecret,
      },
      updated_at: new Date().toISOString(),
    };

    const { error: saveErr } = await supabase
      .from("workspace_integrations")
      .upsert(payload, { onConflict: "workspace_id,provider" });

    if (saveErr) {
      throw saveErr;
    }

    return NextResponse.json({
      success: true,
      message: "Microsoft Outlook App Registration saved and connected successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to configure Outlook" }, { status: 500 });
  }
}
