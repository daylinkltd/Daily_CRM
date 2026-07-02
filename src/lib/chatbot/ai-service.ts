/**
 * AI Service for Chatbot Responses
 * Supports OpenAI, Grok (xAI), Gemini (via OpenAI compatibility), and Anthropic.
 * Uses native fetch to avoid external SDK version mismatches.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateChatbotResponse({
  provider,
  apiKey,
  model,
  systemPrompt,
  history,
  userMessage,
}: {
  provider: "openai" | "gemini" | "anthropic" | "grok" | "groq";
  apiKey: string | null;
  model: string;
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
}): Promise<string> {
  // Resolve key, falling back to system-wide env variables
  const resolvedKey = apiKey || getFallbackApiKey(provider);

  if (!resolvedKey) {
    throw new Error(`API key is missing for AI provider: ${provider}`);
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  if (provider === "openai" || provider === "grok" || provider === "gemini" || provider === "groq") {
    let url = "https://api.openai.com/v1/chat/completions";
    if (provider === "grok") {
      url = "https://api.x.ai/v1/chat/completions";
    } else if (provider === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    } else if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Provider ${provider} returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error(`Failed to extract text response from ${provider} API output`);
    }
    return reply;
  }

  if (provider === "anthropic") {
    // Anthropic messages format splits system prompt into top-level parameter
    const formattedHistory = messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": resolvedKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: formattedHistory,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text;
    if (!reply) {
      throw new Error("Failed to extract text response from Anthropic API output");
    }
    return reply;
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

function getFallbackApiKey(provider: string): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "grok":
      return process.env.XAI_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}
