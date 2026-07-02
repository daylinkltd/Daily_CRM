import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/whatsapp/encryption";

/**
 * GET /api/whatsapp/chatbot-config?workspace_id=...
 * Fetches the chatbot configuration for a specific workspace.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id parameter is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security check: Verify workspace membership
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
      .from("chatbot_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching chatbot_config:", configError);
      return NextResponse.json({ error: "Failed to fetch chatbot configuration" }, { status: 500 });
    }

    if (!config) {
      // Return a default blank config if none exists yet
      return NextResponse.json({
        is_enabled: false,
        provider: "openai",
        model: "gpt-4o-mini",
        system_prompt: "You are a helpful customer service assistant for our business.",
        business_context: "",
        auto_pause_duration: 60,
        response_delay: 0,
        bot_name: "AI Assistant",
        api_key_configured: false,
      });
    }

    // Return config without exposing the actual encrypted API key
    return NextResponse.json({
      ...config,
      api_key: undefined, // Redact the key
      api_key_configured: !!config.api_key,
    });
  } catch (error) {
    console.error("Error in chatbot config GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/chatbot-config
 * Creates or updates the chatbot configuration for a workspace.
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
    const {
      workspace_id,
      is_enabled,
      provider,
      api_key,
      model,
      system_prompt,
      business_context,
      auto_pause_duration,
      response_delay,
      bot_name,
    } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }

    // Security check: Verify workspace membership
    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to edit this workspace configuration" },
        { status: 403 }
      );
    }

    // Encrypt the API key if a new one is provided
    let encryptedApiKey: string | undefined = undefined;
    if (api_key) {
      try {
        encryptedApiKey = encrypt(api_key);
      } catch (err) {
        console.error("Encryption of API key failed:", err);
        return NextResponse.json({ error: "Failed to securely encrypt API key" }, { status: 500 });
      }
    }

    // Check if configuration already exists
    const { data: existing } = await supabase
      .from("chatbot_config")
      .select("id, api_key")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    const updatePayload: Record<string, any> = {
      is_enabled: !!is_enabled,
      provider: provider || "openai",
      model: model || "gpt-4o-mini",
      system_prompt: system_prompt || "You are a helpful customer service assistant for our business.",
      business_context: business_context || "",
      auto_pause_duration: auto_pause_duration !== undefined ? Number(auto_pause_duration) : 60,
      response_delay: response_delay !== undefined ? Number(response_delay) : 0,
      bot_name: bot_name || "AI Assistant",
      updated_at: new Date().toISOString(),
    };

    // If new API key is provided, update it. If not, preserve the existing one.
    if (encryptedApiKey !== undefined) {
      updatePayload.api_key = encryptedApiKey;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("chatbot_config")
        .update(updatePayload)
        .eq("workspace_id", workspace_id);

      if (updateError) {
        console.error("Error updating chatbot_config:", updateError);
        return NextResponse.json({ error: "Failed to update chatbot configuration" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("chatbot_config").insert({
        workspace_id,
        ...updatePayload,
        // If it's a new config and no api_key is passed, it remains null (using global fallback)
        api_key: encryptedApiKey || null,
      });

      if (insertError) {
        console.error("Error inserting chatbot_config:", insertError);
        return NextResponse.json({ error: "Failed to save chatbot configuration" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in chatbot config POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/whatsapp/chatbot-config?workspace_id=...
 * Resets/deletes the chatbot configuration for a specific workspace.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id parameter is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security check: Verify workspace membership
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
      .from("chatbot_config")
      .delete()
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      console.error("Error deleting chatbot_config:", deleteError);
      return NextResponse.json({ error: "Failed to delete configuration" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in chatbot config DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
