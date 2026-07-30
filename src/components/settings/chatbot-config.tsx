"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Eye,
  EyeOff,
  Bot,
  Sparkles,
  Zap,
  RotateCcw,
  BookOpen,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MASKED_KEY = "••••••••••••••••••••••••••••••••";

type AIProvider = "openai" | "gemini" | "anthropic" | "grok" | "groq";

interface ChatbotConfigPayload {
  is_enabled: boolean;
  provider: AIProvider;
  model: string;
  system_prompt: string;
  business_context: string;
  auto_pause_duration: number;
  response_delay: number;
  bot_name: string;
  api_key_configured: boolean;
}

export function ChatbotConfig() {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Chatbot State Fields
  const [isEnabled, setIsEnabled] = useState(false);
  const [provider, setProvider] = useState<AIProvider>("groq");
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful customer service assistant for our business."
  );
  const [businessContext, setBusinessContext] = useState("");
  const [autoPauseDuration, setAutoPauseDuration] = useState("60"); // in minutes, "0" = off, "-1" = permanent
  const [responseDelay, setResponseDelay] = useState("0"); // in seconds
  const [botName, setBotName] = useState("AI Assistant");

  // Track key status
  const [hasConfig, setHasConfig] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);

  // Set default model on provider change
  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    if (newProvider === "openai") {
      setModel("gpt-4o-mini");
    } else if (newProvider === "grok") {
      setModel("grok-2-1212");
    } else if (newProvider === "groq") {
      setModel("llama-3.3-70b-versatile");
    } else if (newProvider === "gemini") {
      setModel("gemini-1.5-flash");
    } else if (newProvider === "anthropic") {
      setModel("claude-3-5-haiku-20241022");
    }
  };

  const fetchConfig = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/chatbot-config?workspace_id=${activeWorkspace.id}`);
      if (!res.ok) {
        throw new Error("Failed to load config");
      }
      const data: ChatbotConfigPayload = await res.json();

      setIsEnabled(data.is_enabled);
      setProvider(data.provider || "groq");
      setModel(data.model || "gpt-4o-mini");
      setSystemPrompt(data.system_prompt || "You are a helpful customer service assistant for our business.");
      setBusinessContext(data.business_context || "");
      setAutoPauseDuration(data.auto_pause_duration !== undefined && data.auto_pause_duration !== null ? String(data.auto_pause_duration) : "60");
      setResponseDelay(data.response_delay !== undefined && data.response_delay !== null ? String(data.response_delay) : "0");
      setBotName(data.bot_name || "AI Assistant");
      setApiKeyConfigured(data.api_key_configured);

      if (data.api_key_configured) {
        setApiKey(MASKED_KEY);
        setKeyEdited(false);
        setHasConfig(true);
      } else {
        setApiKey("");
        setKeyEdited(true);
        setHasConfig(false);
      }
    } catch (err) {
      console.error("fetchConfig error:", err);
      toast.error("Failed to load chatbot configuration");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeWorkspace?.id) {
      setLoading(false);
      return;
    }
    fetchConfig();
  }, [authLoading, user, activeWorkspace?.id, fetchConfig]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) {
      toast.error("No active workspace selected");
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, any> = {
        workspace_id: activeWorkspace.id,
        is_enabled: isEnabled,
        provider,
        model,
        system_prompt: (systemPrompt || "").trim(),
        business_context: (businessContext || "").trim(),
        auto_pause_duration: isNaN(Number(autoPauseDuration)) ? 60 : Number(autoPauseDuration),
        response_delay: isNaN(Number(responseDelay)) ? 0 : Number(responseDelay),
        bot_name: (botName || "").trim() || "AI Assistant",
      };

      // Only send api_key if edited and not using the mask placeholder
      if (keyEdited && apiKey !== MASKED_KEY && apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }

      const res = await fetch("/api/whatsapp/chatbot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save configuration");
        return;
      }

      toast.success("Chatbot configuration saved successfully");
      await fetchConfig();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!activeWorkspace?.id) return;
    if (!confirm("This will completely reset the chatbot settings for this workspace. Continue?")) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch(`/api/whatsapp/chatbot-config?workspace_id=${activeWorkspace.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to reset configuration");
        return;
      }

      toast.success("Chatbot settings reset successfully");
      setApiKey("");
      setKeyEdited(true);
      setIsEnabled(false);
      setProvider("openai");
      setModel("gpt-4o-mini");
      setSystemPrompt("You are a helpful customer service assistant for our business.");
      setBusinessContext("");
      setAutoPauseDuration("60");
      setResponseDelay("0");
      setBotName("AI Assistant");
      setHasConfig(false);
      setApiKeyConfigured(false);
    } catch (err) {
      console.error("Reset error:", err);
      toast.error("Failed to reset configuration");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      <div className="space-y-6">
        {/* ── Chatbot Activation Toggle ── */}
        <Card className="bg-card border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Bot className="size-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Enable AI Chatbot</h3>
                  <p className="text-xs text-muted-foreground">
                    Allow the AI Chatbot to monitor and respond to customer WhatsApp inquiries.
                  </p>
                </div>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* ── AI Provider Configurations ── */}
        <Card className="bg-card border-slate-700">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              AI Engine Credentials
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Select your preferred LLM provider and enter credentials to power the chatbot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider Selection */}
            <div className="grid gap-2">
              <Label className="text-slate-300">LLM Provider</Label>
              <Select value={provider} onValueChange={(val) => handleProviderChange((val ?? "openai") as AIProvider)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="grok">xAI (Grok AI)</SelectItem>
                  <SelectItem value="groq">Groq (groq.com)</SelectItem>
                  <SelectItem value="gemini">Google (Gemini)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Name */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Model Name</Label>
              <Input
                placeholder="e.g. grok-beta, gpt-4o-mini"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-slate-800 border-slate-700 text-foreground placeholder:text-slate-500"
              />
            </div>

            {/* API Key Input */}
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-slate-300">Provider API Key</Label>
                {apiKeyConfigured && !keyEdited && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Configured
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={
                    apiKeyConfigured
                      ? "Use saved API key"
                      : `Enter API key for ${provider.toUpperCase()}`
                  }
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyEdited(true);
                  }}
                  onFocus={() => {
                    if (apiKey === MASKED_KEY) {
                      setApiKey("");
                      setKeyEdited(true);
                    }
                  }}
                  className="bg-slate-800 border-slate-700 text-foreground placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Left blank? The chatbot will attempt to fall back to the CRM&apos;s system-wide{" "}
                <code className="text-muted-foreground bg-background px-1 py-0.5 rounded text-[10px]">
                  {provider === "grok"
                    ? "XAI_API_KEY"
                    : provider === "groq"
                    ? "GROQ_API_KEY"
                    : `${provider.toUpperCase()}_API_KEY`}
                </code>{" "}
                key.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Prompts & Business Knowledge ── */}
        <Card className="bg-card border-slate-700">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-base">
              <BookOpen className="size-4 text-primary" />
              Persona & Knowledge Base
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Provide context and directions to shape the bot&apos;s behavior and business awareness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Assistant Name */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Assistant Bot Name</Label>
              <Input
                placeholder="e.g. Voyage Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-foreground placeholder:text-slate-500"
              />
            </div>

            {/* System Prompt */}
            <div className="grid gap-2">
              <Label className="text-slate-300">System Instructions / Persona</Label>
              <Textarea
                placeholder="Act as a helpful customer support agent. Be concise, polite, and professional..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                className="bg-slate-800 border-slate-700 text-foreground placeholder:text-slate-500 resize-y"
              />
            </div>

            {/* Business Context */}
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-slate-300">Business Knowledge (FAQs, Pricing, Details)</Label>
                <span className="text-[10px] text-slate-500">Add custom details here</span>
              </div>
              <Textarea
                placeholder="Our business hours: Mon-Fri 9 AM to 6 PM.
Pricing details: Standard $29, Premium $99.
Support contacts: support@example.com"
                value={businessContext}
                onChange={(e) => setBusinessContext(e.target.value)}
                rows={6}
                className="bg-slate-800 border-slate-700 text-foreground placeholder:text-slate-500 resize-y font-mono text-xs leading-normal"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Control Rules (Auto-Pause & Typing Delay) ── */}
        <Card className="bg-card border-slate-700">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-base">
              <Sliders className="size-4 text-primary" />
              Conversation Control Rules
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage how the AI interacts alongside human agents in your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {/* Auto-Pause */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Agent Handover Auto-Pause</Label>
              <Select value={autoPauseDuration} onValueChange={(val) => setAutoPauseDuration(val ?? "60")}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectItem value="0">Off (Do not auto-pause)</SelectItem>
                  <SelectItem value="15">15 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes</SelectItem>
                  <SelectItem value="60">1 Hour</SelectItem>
                  <SelectItem value="120">2 Hours</SelectItem>
                  <SelectItem value="1440">24 Hours</SelectItem>
                  <SelectItem value="-1">Permanent Takeover (Manual resume required)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">
                Pauses the AI bot when a human agent replies to a message, preventing double responses.
              </p>
            </div>

            {/* Response Delay */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Simulated Response Delay</Label>
              <Select value={responseDelay} onValueChange={(val) => setResponseDelay(val ?? "0")}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-foreground">
                  <SelectItem value="0">Instant reply</SelectItem>
                  <SelectItem value="2">2 Seconds</SelectItem>
                  <SelectItem value="4">4 Seconds</SelectItem>
                  <SelectItem value="6">6 Seconds</SelectItem>
                  <SelectItem value="8">8 Seconds</SelectItem>
                  <SelectItem value="10">10 Seconds</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">
                Simulates typing by introducing a slight delay before sending messages on WhatsApp.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Form Actions ── */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/15 px-6"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" /> Saving...
              </>
            ) : (
              "Save Configurations"
            )}
          </Button>
          {hasConfig && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-950 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4 mr-2" /> Reset Chatbot Settings
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Instructions Sidebar ── */}
      <div>
        <Card className="bg-card border-slate-700">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <p className="text-primary font-semibold mb-1 flex items-center gap-1">
                <Zap className="size-3.5" /> 1. Connect API Credentials
              </p>
              <p>
                Provide an API key for your chosen AI model. We strongly recommend xAI (Grok AI) or
                OpenAI GPT-4o-mini for high-speed, cost-effective intake.
              </p>
            </div>

            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <p className="text-primary font-semibold mb-1 flex items-center gap-1">
                <BookOpen className="size-3.5" /> 2. Add Business Knowledge
              </p>
              <p>
                Explain what treatments, prices, or answers you support. For Genesys Voyage, paste the
                full categorized treatment list (Oncology, Cardiology, Orthopaedics) and specify the step-by-step
                qualification questions (Reports, Country, Passport).
              </p>
            </div>

            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <p className="text-primary font-semibold mb-1 flex items-center gap-1">
                <Sliders className="size-3.5" /> 3. Test & Enable
              </p>
              <p>
                Turn on the switch at the top. Test by messaging your WhatsApp number from a test phone.
                Check the CRM inbox in real-time to monitor the replies!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
