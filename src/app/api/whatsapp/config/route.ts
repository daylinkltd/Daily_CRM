import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/providers/factory";
import { encrypt, decrypt } from "@/lib/whatsapp/encryption";

/**
 * GET /api/whatsapp/config?workspace_id=...
 *
 * Verifies if the saved WhatsApp config for the active workspace is healthy.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { connected: false, reason: "bad_request", message: "workspace_id parameter is required" },
        { status: 200 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security Gate: Enforce workspace membership
    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this workspace configuration" },
        { status: 403 }
      );
    }

    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("phone_number_id, access_token, status, provider, waba_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching whatsapp_config:", configError);
      return NextResponse.json(
        { connected: false, reason: "db_error", message: "Failed to fetch configuration" },
        { status: 200 }
      );
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: "no_config",
          message: "No WhatsApp configuration saved yet. Choose a provider, fill the credentials, and save.",
        },
        { status: 200 }
      );
    }

    // Try to decrypt stored access token
    let accessToken: string;
    try {
      accessToken = decrypt(config.access_token);
    } catch (err) {
      console.error("[whatsapp/config GET] Token decryption failed:", err);
      return NextResponse.json(
        {
          connected: false,
          reason: "token_corrupted",
          needs_reset: true,
          message:
            "The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click 'Reset Configuration' below and re-save.",
        },
        { status: 200 }
      );
    }

    // Resolve driver and verify credentials dynamically
    try {
      const driver = getWhatsAppProvider(config.provider || "meta");
      const phoneInfo = await driver.verifyConfig({
        phoneId: config.phone_number_id,
        wabaId: config.waba_id,
        token: accessToken,
      });

      return NextResponse.json({
        connected: true,
        phone_info: phoneInfo,
        provider: config.provider || "meta",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "API verification failed";
      console.error(`[whatsapp/config GET] Driver verification failed for ${config.provider}:`, message);
      return NextResponse.json(
        {
          connected: false,
          reason: "api_error",
          message: `API rejected the credentials: ${message}`,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in WhatsApp config GET:", error);
    return NextResponse.json(
      { connected: false, reason: "unknown", message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Configures or updates the WhatsApp settings for a corporate tenant workspace.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, provider = "meta", phone_number_id, waba_id, access_token, verify_token } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }

    if (!access_token || !phone_number_id) {
      return NextResponse.json(
        { error: "access_token and phone_number_id are required" },
        { status: 400 }
      );
    }

    // Security Gate: Enforce workspace membership
    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to configure this workspace" },
        { status: 403 }
      );
    }

    // Verify credentials via selected provider driver PRIOR to storage
    let phoneInfo;
    try {
      const driver = getWhatsAppProvider(provider);
      phoneInfo = await driver.verifyConfig({
        phoneId: phone_number_id,
        wabaId: waba_id,
        token: access_token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      console.error(`Driver verification failed during save for ${provider}:`, message);
      return NextResponse.json(
        { error: `Verification failed: ${message}` },
        { status: 400 }
      );
    }

    // Encrypt sensitive credentials
    let encryptedAccessToken: string;
    let encryptedVerifyToken: string | null;
    try {
      encryptedAccessToken = encrypt(access_token);
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null;
    } catch (err) {
      console.error("Encryption of WhatsApp credentials failed:", err);
      return NextResponse.json(
        { error: "Failed to encrypt token. Verify ENCRYPTION_KEY environment configuration." },
        { status: 500 }
      );
    }

    // Upsert scoped strictly by workspace_id
    const { data: existing } = await supabase
      .from("whatsapp_config")
      .select("id")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("whatsapp_config")
        .update({
          provider,
          phone_number_id,
          waba_id: waba_id || null,
          access_token: encryptedAccessToken,
          verify_token: encryptedVerifyToken,
          status: "connected",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace_id);

      if (updateError) {
        console.error("Error updating whatsapp_config:", updateError);
        return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("whatsapp_config").insert({
        workspace_id,
        user_id: user.id, // Tracks who originally configured it
        provider,
        phone_number_id,
        waba_id: waba_id || null,
        access_token: encryptedAccessToken,
        verify_token: encryptedVerifyToken,
        status: "connected",
        connected_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Error inserting whatsapp_config:", insertError);
        return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, phone_info: phoneInfo });
  } catch (error) {
    console.error("Error in WhatsApp config POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/whatsapp/config?workspace_id=...
 *
 * Removes the selected workspace's WhatsApp credentials configuration row.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security Gate: Enforce workspace membership
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to reset this workspace config" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("whatsapp_config")
      .delete()
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      console.error("Error deleting whatsapp_config:", deleteError);
      return NextResponse.json({ error: "Failed to delete configuration" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in WhatsApp config DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
