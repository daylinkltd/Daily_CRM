import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateChatbotResponse } from "@/lib/chatbot/ai-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();

    // 1. Verify User Authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch last 50 messages from the conversation
    const { data: messages, error } = await supabase
      .from("messages")
      .select("sender_type, content_text, content_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[summarize] Error fetching messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation messages" },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages found in this conversation to summarize" },
        { status: 404 }
      );
    }

    // Chronological order format: "[Customer]: ..." or "[Agent]: ..."
    const chatTranscript = messages
      .reverse()
      .map((m) => {
        const sender = m.sender_type === "customer" ? "Customer" : "Agent";
        const content = m.content_text || `[${m.content_type || "media"}]`;
        return `${sender}: ${content}`;
      })
      .join("\n");

    // 3. System prompt for structured Groq Llama 3 output
    const systemPrompt = `
You are an executive CRM AI assistant. Summarize the following customer WhatsApp chat transcript cleanly into 3 specific sections:

📌 CUSTOMER ISSUE / GOAL:
(1-2 concise bullet points explaining why the customer reached out or what they need)

🤝 KEY AGREEMENTS & POINTS DISCUSSED:
(1-3 bullet points listing key info, offers, or facts exchanged)

🎯 RECOMMENDED NEXT STEPS:
(1-2 actionable bullet points for the agent taking over this ticket)

Keep it brief, accurate, easy to scan in 10 seconds, and formatted with clean markdown bullets.
`;

    // 4. Call Groq AI via existing AI service
    const summary = await generateChatbotResponse({
      provider: "groq",
      apiKey: null, // Resolves process.env.GROQ_API_KEY
      model: "llama-3.3-70b-versatile",
      systemPrompt,
      history: [],
      userMessage: chatTranscript,
    });

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("[summarize] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate conversation summary" },
      { status: 500 }
    );
  }
}
