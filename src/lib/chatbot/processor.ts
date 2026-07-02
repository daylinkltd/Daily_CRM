import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/whatsapp/encryption";
import { generateChatbotResponse } from "./ai-service";
import { engineSendText } from "@/lib/automations/meta-send";

// Lazy-initialized admin client
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

interface ProcessChatbotReplyArgs {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  messageText: string;
}

export async function processChatbotReply({
  workspaceId,
  conversationId,
  contactId,
  messageText,
}: ProcessChatbotReplyArgs): Promise<void> {
  try {
    const db = supabaseAdmin();

    // 1. Fetch chatbot config for the workspace
    const { data: config, error: configErr } = await db
      .from("chatbot_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (configErr) {
      console.error("[chatbot processor] Error fetching chatbot_config:", configErr);
      return;
    }

    if (!config || !config.is_enabled) {
      // Chatbot not configured or disabled globally
      return;
    }

    // 2. Fetch conversation to check bot_status and bot_paused_until
    const { data: conversation, error: convErr } = await db
      .from("conversations")
      .select("bot_status, bot_paused_until")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr || !conversation) {
      console.error("[chatbot processor] Error fetching conversation status:", convErr);
      return;
    }

    let isBotActive = conversation.bot_status === "active";

    // Handle auto-resume if the pause timer has expired
    if (!isBotActive && conversation.bot_paused_until) {
      const now = new Date();
      const pausedUntil = new Date(conversation.bot_paused_until);
      if (now > pausedUntil) {
        // Pause has expired! Auto-resume the bot
        isBotActive = true;
        const { error: resumeErr } = await db
          .from("conversations")
          .update({
            bot_status: "active",
            bot_paused_until: null,
          })
          .eq("id", conversationId);

        if (resumeErr) {
          console.error("[chatbot processor] Failed to auto-resume conversation bot status:", resumeErr);
        }
      }
    }

    if (!isBotActive) {
      // Bot is currently paused
      return;
    }

    // 3. Fetch recent message history (last 10 messages)
    const { data: dbMessages, error: msgErr } = await db
      .from("messages")
      .select("sender_type, content_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (msgErr) {
      console.error("[chatbot processor] Error fetching message history:", msgErr);
      return;
    }

    // Map DB messages to LLM chat format (reverse to be chronological)
    // Filter out empty messages or non-text messages
    const history: { role: "user" | "assistant"; content: string }[] = [];
    const reversedMessages = dbMessages ? [...dbMessages].reverse() : [];

    // We exclude the very last message if it's the current user message,
    // as we pass that separately to the AI service.
    const lastMsg = reversedMessages[reversedMessages.length - 1];
    const contextMessages =
      lastMsg && lastMsg.content_text === messageText
        ? reversedMessages.slice(0, -1)
        : reversedMessages;

    for (const msg of contextMessages) {
      if (!msg.content_text) continue;
      history.push({
        role: msg.sender_type === "customer" ? "user" : "assistant",
        content: msg.content_text,
      });
    }

    // 4. Decrypt tenant-specific API key if present
    let decryptedKey: string | null = null;
    if (config.api_key) {
      try {
        decryptedKey = decrypt(config.api_key);
      } catch (err) {
        console.error("[chatbot processor] Decrypting tenant API key failed:", err);
      }
    }

    // 5. Generate reply via AI Service
    const systemPrompt = `${config.system_prompt}\n\nBusiness Context / Info:\n${config.business_context || ""}`;

    const reply = await generateChatbotResponse({
      provider: config.provider,
      apiKey: decryptedKey,
      model: config.model,
      systemPrompt,
      history,
      userMessage: messageText,
    });

    if (!reply || !reply.trim()) {
      return;
    }

    // 6. Simulate delay if configured
    if (config.response_delay > 0) {
      const delayMs = Math.min(Math.max(config.response_delay, 0), 10) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // 7. Send the text via provider and persist to database
    await engineSendText({
      workspaceId,
      conversationId,
      contactId,
      text: reply.trim(),
    });
  } catch (error) {
    console.error("[chatbot processor] Error processing chatbot reply:", error);
  }
}
