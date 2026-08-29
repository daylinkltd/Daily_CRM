"use client";

import { useState } from "react";
import { MessageSquareText, Mail, MessageCircle, Smartphone, Plus, Trash2, Send, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  useConsoleData,
} from "@/components/saas-admin/console-ui";
import { ChannelSettings } from "@/components/saas-admin/channel-settings";
import { extractVariables, smsSegments } from "@/lib/templates/catalog";
import { NativeSelect } from "@/components/ui/native-select";

interface ChannelStatus {
  channel: "email" | "whatsapp" | "sms";
  configured: boolean;
  missing: string[];
  identity: string | null;
}

interface Template {
  id: string;
  name: string;
  channel: "email" | "whatsapp" | "sms";
  subject: string | null;
  body: string;
  meta_template_name: string | null;
}

interface HistoryRow {
  id: number;
  channel: string;
  recipient: string;
  workspace_name: string | null;
  subject: string | null;
  body: string;
  status: "sent" | "failed";
  error: string | null;
  sent_by_email: string | null;
  created_at: string;
}

interface MessagingData {
  channels: ChannelStatus[];
  templates: Template[];
  history: HistoryRow[];
}

const CHANNEL_META = {
  email: { icon: Mail, label: "Email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  sms: { icon: Smartphone, label: "SMS" },
} as const;

const AUDIENCES = [
  { value: "owners", label: "All workspace owners" },
  { value: "trial_owners", label: "Owners on a live trial" },
  { value: "expired_owners", label: "Owners whose trial expired" },
  { value: "manual", label: "Manual list" },
];

export default function MessagingPage() {
  const { data, loading, error, reload } = useConsoleData<MessagingData>("/api/saas-admin/messaging");

  // Composer state
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [audience, setAudience] = useState("owners");
  const [manualList, setManualList] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  // Template creator state
  const [creating, setCreating] = useState(false);
  const [tName, setTName] = useState("");
  const [tChannel, setTChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [tSubject, setTSubject] = useState("");
  const [tBody, setTBody] = useState("");
  const [tMetaName, setTMetaName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Library browsing, mirroring the workspace template library: search
  // across name/subject/body, filter by channel.
  const [libQuery, setLibQuery] = useState("");
  const [libChannel, setLibChannel] = useState<"all" | "email" | "whatsapp" | "sms">("all");

  const channelTemplates = (data?.templates ?? []).filter((t) => t.channel === channel);
  const selectedTemplate = channelTemplates.find((t) => t.id === templateId) ?? null;
  const channelStatus = data?.channels.find((c) => c.channel === channel);

  const send = async () => {
    if (
      !window.confirm(
        `Send this ${channel} message to "${AUDIENCES.find((a) => a.value === audience)?.label}"? Sends are immediate and logged permanently.`,
      )
    )
      return;
    setSending(true);
    try {
      const res = await fetch("/api/saas-admin/messaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          audience,
          manual_recipients: audience === "manual"
            ? manualList.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : undefined,
          template_id: templateId || undefined,
          subject: templateId ? undefined : subject,
          body: templateId ? undefined : messageBody,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(`Sent ${json.sent} of ${json.recipients}${json.failed ? ` — ${json.failed} failed (see history)` : ""}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const createTemplate = async () => {
    setBusy("create");
    try {
      const res = await fetch("/api/saas-admin/messaging/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tName,
          channel: tChannel,
          subject: tSubject || undefined,
          body: tBody,
          meta_template_name: tMetaName || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success(`Template "${tName}" saved`);
      setTName(""); setTSubject(""); setTBody(""); setTMetaName(""); setCreating(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteTemplate = async (t: Template) => {
    if (!window.confirm(`Delete template "${t.name}"? Sent history keeps its copies.`)) return;
    setBusy(t.id);
    try {
      const res = await fetch(`/api/saas-admin/messaging/templates?id=${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <LoadingRow label="Loading messaging…" />;
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-rose-400">{error ?? "Failed to load"}</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <MessageSquareText className="h-5 w-5 text-primary" /> Messaging
      </h1>

      {/* Channel credentials, edited here — not in the deployment env. */}
      <ChannelSettings onChanged={reload} />

      {/* Composer */}
      <ConsoleCard title="Compose">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(["email", "whatsapp", "sms"] as const).map((c) => {
                const meta = CHANNEL_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setChannel(c); setTemplateId(""); }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                      channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                  </button>
                );
              })}
            </div>

            <NativeSelect
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">No template — write inline</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </NativeSelect>
          </div>

          {audience === "manual" && (
            <textarea
              value={manualList}
              onChange={(e) => setManualList(e.target.value)}
              placeholder={channel === "email" ? "One email per line" : "One phone number per line, with country code (91…)"}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          )}

          {selectedTemplate ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
              {selectedTemplate.subject && (
                <p className="text-sm font-bold text-foreground">{selectedTemplate.subject}</p>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedTemplate.body}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Variables fill per recipient: {"{{name}}, {{workspace}}, {{plan}}, {{trial_ends}}"}
                {selectedTemplate.meta_template_name && (
                  <> · Meta template: <code>{selectedTemplate.meta_template_name}</code></>
                )}
              </p>
            </div>
          ) : (
            <>
              {channel === "email" && (
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              )}
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  channel === "whatsapp"
                    ? "WhatsApp sends require a template with an approved Meta name — create one below."
                    : "Message. {{name}}, {{workspace}}, {{plan}} and {{trial_ends}} fill per recipient."
                }
                rows={5}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Every send is logged permanently with its rendered content and outcome.
            </p>
            <button
              type="button"
              disabled={sending || !channelStatus?.configured}
              onClick={send}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </ConsoleCard>

      {/* Templates */}
      <ConsoleCard
        title={`Templates (${data.templates.length})`}
        action={
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> New template
          </button>
        }
      >
        {creating && (
          <div className="mb-4 space-y-3 rounded-lg border border-border/60 p-4">
            <div className="flex flex-wrap gap-3">
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="Template name"
                className="h-9 w-56 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <NativeSelect
                value={tChannel}
                onChange={(e) => setTChannel(e.target.value as typeof tChannel)}
                className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </NativeSelect>
              {tChannel === "email" && (
                <input
                  value={tSubject}
                  onChange={(e) => setTSubject(e.target.value)}
                  placeholder="Subject"
                  className="h-9 flex-1 min-w-48 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              )}
              {tChannel === "whatsapp" && (
                <input
                  value={tMetaName}
                  onChange={(e) => setTMetaName(e.target.value)}
                  placeholder="Approved Meta template name"
                  className="h-9 flex-1 min-w-48 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              )}
            </div>
            <textarea
              value={tBody}
              onChange={(e) => setTBody(e.target.value)}
              placeholder="Body — {{name}}, {{workspace}}, {{plan}}, {{trial_ends}} fill per recipient"
              rows={4}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={busy === "create" || !tName || !tBody}
              onClick={createTemplate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              Save template
            </button>
          </div>
        )}

        {/* The library proper, mirroring the workspace template library:
            search, channel filter, variable chips extracted live from the
            body, and the SMS segment count that decides what a blast
            actually costs. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={libQuery}
              onChange={(e) => setLibQuery(e.target.value)}
              placeholder="Search templates…"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:w-64"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(["all", "email", "whatsapp", "sms"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setLibChannel(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  libChannel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const q = libQuery.trim().toLowerCase();
          const visible = data.templates.filter((t) => {
            if (libChannel !== "all" && t.channel !== libChannel) return false;
            if (!q) return true;
            return `${t.name} ${t.subject ?? ""} ${t.body}`.toLowerCase().includes(q);
          });

          if (visible.length === 0) {
            return (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {data.templates.length === 0
                  ? "No templates yet — migration 107 seeds the standard SaaS lifecycle set."
                  : "Nothing matches that search."}
              </p>
            );
          }

          return (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((t) => {
                const meta = CHANNEL_META[t.channel];
                const vars = extractVariables(t.subject, t.body);
                return (
                  <div key={t.id} className="flex flex-col rounded-lg border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                        <meta.icon className="h-3.5 w-3.5 shrink-0 text-primary" /> {t.name}
                        <Badge tone="neutral">{t.channel}</Badge>
                        {t.channel === "sms" && (
                          <Badge tone={smsSegments(t.body) > 1 ? "warn" : "neutral"}>
                            {smsSegments(t.body)} segment{smsSegments(t.body) === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {t.channel === "whatsapp" && !t.meta_template_name && (
                          <Badge tone="warn">no Meta template</Badge>
                        )}
                      </span>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setChannel(t.channel);
                            setTemplateId(t.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => deleteTemplate(t)}
                          aria-label={`Delete template ${t.name}`}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:border-rose-500 hover:text-rose-400 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {t.subject && (
                      <p className="mt-2 text-xs font-semibold text-foreground">{t.subject}</p>
                    )}
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {t.body}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                      {vars.map((v) => (
                        <code
                          key={v}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                        >
                          {"{{" + v + "}}"}
                        </code>
                      ))}
                      {t.channel === "whatsapp" && t.meta_template_name && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Meta: <code>{t.meta_template_name}</code>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </ConsoleCard>

      {/* History */}
      <ConsoleCard title="Send history (last 100)">
        {data.history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4">When</th>
                  <th className="pb-2.5 pr-4">Channel</th>
                  <th className="pb-2.5 pr-4">To</th>
                  <th className="pb-2.5 pr-4">Message</th>
                  <th className="pb-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id} className="border-b border-border/40 align-top last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4"><Badge tone="neutral">{h.channel}</Badge></td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs text-foreground">{h.recipient}</span>
                      {h.workspace_name && (
                        <span className="block text-[11px] text-muted-foreground">{h.workspace_name}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="block max-w-md truncate text-xs text-muted-foreground" title={h.body}>
                        {h.subject ? `${h.subject} — ` : ""}{h.body}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {h.status === "sent" ? (
                        <Badge tone="good">sent</Badge>
                      ) : (
                        <span title={h.error ?? undefined}><Badge tone="bad">failed</Badge></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ConsoleCard>
    </div>
  );
}
