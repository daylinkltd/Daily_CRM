import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/providers/factory";
import { encrypt, decrypt } from "@/lib/whatsapp/encryption";
import { ensureWabaSubscribed } from "@/lib/whatsapp/webhook-subscribe";
import { validateAppSecret } from "@/lib/whatsapp/meta-api";

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

    // select * so this works whether or not optional columns
    // (app_secret, migration 054) exist yet.
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
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
          provider: config.provider || "meta",
          phone_number_id: config.phone_number_id || "",
          waba_id: config.waba_id || "",
          message:
            "The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click 'Reset Configuration' below and re-save.",
        },
        { status: 200 }
      );
    }

    // Try decrypting verify_token if present, or auto-generate fallback
    let verifyToken = "";
    if (config.verify_token) {
      try {
        verifyToken = decrypt(config.verify_token);
      } catch {
        verifyToken = config.verify_token;
      }
    }
    if (!verifyToken) {
      const rand = Math.random().toString(36).substring(2, 14);
      verifyToken = `whvt_${rand}`;
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
        phone_number_id: config.phone_number_id || "",
        waba_id: config.waba_id || "",
        verify_token: verifyToken,
        has_token: true,
        has_app_secret: Boolean(
          (config as { app_secret?: string | null }).app_secret || process.env.META_APP_SECRET
        ),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "API verification failed";
      console.error(`[whatsapp/config GET] Driver verification failed for ${config.provider}:`, message);
      return NextResponse.json(
        {
          connected: false,
          reason: "api_error",
          message: `API rejected the credentials: ${message}`,
          provider: config.provider || "meta",
          phone_number_id: config.phone_number_id || "",
          waba_id: config.waba_id || "",
          verify_token: verifyToken,
          has_token: true,
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
    const { workspace_id, provider = "meta", phone_number_id, waba_id, access_token, verify_token, app_secret } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
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

    // Check existing config
    const { data: existing } = await supabase
      .from("whatsapp_config")
      .select("id, access_token, verify_token")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    let effectiveAccessToken = access_token;
    let isNewToken = true;

    // If access token is masked or missing and existing config exists, decrypt existing token
    if (existing && (!access_token || access_token === "••••••••••••••••")) {
      try {
        effectiveAccessToken = decrypt(existing.access_token);
        isNewToken = false;
      } catch (err) {
        return NextResponse.json(
          { error: "Existing stored access token could not be decrypted. Please re-enter a new access token." },
          { status: 400 }
        );
      }
    }

    if (!effectiveAccessToken || !phone_number_id) {
      return NextResponse.json(
        { error: "access_token and phone_number_id are required" },
        { status: 400 }
      );
    }

    // Verify credentials via selected provider driver PRIOR to storage
    let phoneInfo;
    try {
      const driver = getWhatsAppProvider(provider);
      phoneInfo = await driver.verifyConfig({
        phoneId: phone_number_id,
        wabaId: waba_id,
        token: effectiveAccessToken,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      console.error(`Driver verification failed during save for ${provider}:`, message);
      return NextResponse.json(
        { error: `Verification failed: ${message}` },
        { status: 400 }
      );
    }

    // Encrypt credentials
    let encryptedAccessToken: string;
    if (isNewToken) {
      try {
        encryptedAccessToken = encrypt(effectiveAccessToken);
      } catch (err) {
        console.error("Encryption of WhatsApp token failed:", err);
        return NextResponse.json(
          { error: "Failed to encrypt token. Verify ENCRYPTION_KEY environment configuration." },
          { status: 500 }
        );
      }
    } else {
      encryptedAccessToken = existing!.access_token;
    }

    let finalVerifyToken = (verify_token && verify_token.trim()) ? verify_token.trim() : null;
    if (!finalVerifyToken && existing?.verify_token) {
      try {
        finalVerifyToken = decrypt(existing.verify_token);
      } catch {
        finalVerifyToken = existing.verify_token;
      }
    }
    if (!finalVerifyToken) {
      const rand = Math.random().toString(36).substring(2, 14);
      finalVerifyToken = `whvt_${rand}`;
    }

    let encryptedVerifyToken: string | null = null;
    try {
      encryptedVerifyToken = encrypt(finalVerifyToken);
    } catch {
      encryptedVerifyToken = finalVerifyToken;
    }

    // Validate + encrypt the Meta App Secret when provided. A wrong
    // secret silently kills inbound (every webhook 401s on HMAC), so
    // reject bad values at save time with a clear error.
    let encryptedAppSecret: string | null | undefined = undefined; // undefined = leave unchanged
    if (provider === "meta" && typeof app_secret === "string" && app_secret.trim() && app_secret !== "••••••••••••••••") {
      const secretCheck = await validateAppSecret({
        accessToken: effectiveAccessToken,
        appSecret: app_secret.trim(),
      });
      if (!secretCheck.valid) {
        return NextResponse.json(
          {
            error: `The Meta App Secret is not valid for this app${secretCheck.appId ? ` (${secretCheck.appId})` : ""}: ${secretCheck.error || "rejected"}. Copy it from Meta App Dashboard → App settings → Basic → App Secret.`,
          },
          { status: 400 }
        );
      }
      try {
        encryptedAppSecret = encrypt(app_secret.trim());
      } catch {
        encryptedAppSecret = app_secret.trim();
      }
    }

    // Upsert scoped strictly by workspace_id. app_secret is only
    // included when the caller provided one; if the column doesn't
    // exist yet (migration 054 not applied) we retry without it and
    // surface a warning instead of failing the whole save.
    let appSecretWarning: string | null = null;
    const isMissingColumnError = (e: { code?: string; message?: string } | null) =>
      e?.code === "42703" ||
      e?.code === "PGRST204" ||
      /app_secret/.test(e?.message ?? "");

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        provider,
        phone_number_id,
        waba_id: waba_id || null,
        access_token: encryptedAccessToken,
        verify_token: encryptedVerifyToken,
        status: "connected",
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (encryptedAppSecret !== undefined) updatePayload.app_secret = encryptedAppSecret;

      let { error: updateError } = await supabase
        .from("whatsapp_config")
        .update(updatePayload)
        .eq("workspace_id", workspace_id);

      if (updateError && "app_secret" in updatePayload && isMissingColumnError(updateError)) {
        delete updatePayload.app_secret;
        appSecretWarning =
          "App Secret could not be stored: run migration 054 (whatsapp_config.app_secret) in Supabase, or set META_APP_SECRET on the server.";
        ({ error: updateError } = await supabase
          .from("whatsapp_config")
          .update(updatePayload)
          .eq("workspace_id", workspace_id));
      }

      if (updateError) {
        console.error("Error updating whatsapp_config:", updateError);
        return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
      }
    } else {
      const insertPayload: Record<string, unknown> = {
        workspace_id,
        user_id: user.id,
        provider,
        phone_number_id,
        waba_id: waba_id || null,
        access_token: encryptedAccessToken,
        verify_token: encryptedVerifyToken,
        status: "connected",
        connected_at: new Date().toISOString(),
      };
      if (encryptedAppSecret !== undefined) insertPayload.app_secret = encryptedAppSecret;

      let { error: insertError } = await supabase.from("whatsapp_config").insert(insertPayload);

      if (insertError && "app_secret" in insertPayload && isMissingColumnError(insertError)) {
        delete insertPayload.app_secret;
        appSecretWarning =
          "App Secret could not be stored: run migration 054 (whatsapp_config.app_secret) in Supabase, or set META_APP_SECRET on the server.";
        ({ error: insertError } = await supabase.from("whatsapp_config").insert(insertPayload));
      }

      if (insertError) {
        console.error("Error inserting whatsapp_config:", insertError);
        return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
      }
    }

    // Wire inbound webhooks immediately after a successful save.
    // Without this, saving credentials only enables OUTBOUND sending —
    // Meta won't deliver inbound messages until the WABA is subscribed
    // to our app. Best-effort: a subscription failure must not fail
    // the save, but it is surfaced so the UI can warn.
    let webhookSubscription: {
      subscribed: boolean;
      mode: string;
      error?: string;
    } | null = null;
    if (provider === "meta" && waba_id) {
      webhookSubscription = await ensureWabaSubscribed({
        wabaId: waba_id,
        accessToken: effectiveAccessToken,
        verifyToken: finalVerifyToken,
      });
      if (!webhookSubscription.subscribed) {
        console.error(
          "[whatsapp/config] WABA webhook subscription failed:",
          webhookSubscription.error
        );
      }
    }

    return NextResponse.json({
      success: true,
      phone_info: phoneInfo,
      webhook_subscription: webhookSubscription,
      app_secret_warning: appSecretWarning,
    });
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
