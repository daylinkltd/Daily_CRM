import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateChatbotResponse } from "@/lib/chatbot/ai-service";
import { decrypt } from "@/lib/whatsapp/encryption";

export async function POST(request: Request) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch conversation to get workspace_id
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("workspace_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const workspaceId = conversation.workspace_id;

    // Security check: Verify workspace membership
    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to access this workspace" },
        { status: 403 }
      );
    }

    // Fetch chatbot config
    const { data: config, error: configErr } = await supabase
      .from("chatbot_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (configErr || !config) {
      return NextResponse.json({ draft: null, message: "Chatbot not configured" });
    }

    // Fetch message history (last 10 messages)
    const { data: dbMessages, error: msgErr } = await supabase
      .from("messages")
      .select("sender_type, content_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (msgErr || !dbMessages || dbMessages.length === 0) {
      return NextResponse.json({ draft: null, message: "No message history found" });
    }

    // Format message history chronologically
    const history: { role: "user" | "assistant"; content: string }[] = [];
    const reversedMessages = [...dbMessages].reverse();

    // We take the very last message as the user message if it is from the customer
    const lastMsg = reversedMessages[reversedMessages.length - 1];
    const isLastFromCustomer = lastMsg.sender_type === "customer";
    
    // All preceding messages go into history
    const contextMessages = isLastFromCustomer ? reversedMessages.slice(0, -1) : reversedMessages;

    for (const msg of contextMessages) {
      if (!msg.content_text) continue;
      history.push({
        role: msg.sender_type === "customer" ? "user" : "assistant",
        content: msg.content_text,
      });
    }

    const userMessage = isLastFromCustomer ? (lastMsg.content_text || "") : "Provide a follow-up or reply suggestion based on the context.";

    // Decrypt API key
    let decryptedKey: string | null = null;
    if (config.api_key) {
      try {
        decryptedKey = decrypt(config.api_key);
      } catch (err) {
        console.error("Decrypting tenant API key failed:", err);
      }
    }

    // Construct the specialized system prompt for the draft helper
    const copilotInstructions = `
CRITICAL INSTRUCTIONS FOR AI COPILOT DRAFT SUGGESTIONS:
1. You are an AI assistant helping a human CRM agent draft a response to a patient on WhatsApp.
2. Based on the business context and history, generate a single, highly concise, friendly, and professional response that the agent can review, modify, and send.
3. DO NOT include any introductory greetings like "Here is a suggested reply:" or comments.
4. DO NOT include metadata instructions like "Typing..." or "Buttons:". If choices are required, list them as clean bullet points or write them naturally (e.g. "• Option 1\n• Option 2").
5. Only output the raw text of the message draft itself.
`;

    const systemPrompt = `${config.system_prompt}\n${copilotInstructions}\n\nBusiness Context:\n${config.business_context || ""}`;

    const draft = await generateChatbotResponse({
      provider: config.provider,
      apiKey: decryptedKey,
      model: config.model,
      systemPrompt,
      history,
      userMessage,
    });

    return NextResponse.json({ draft: draft?.trim() || null });
  } catch (error) {
    console.error("Error in suggest-draft route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
