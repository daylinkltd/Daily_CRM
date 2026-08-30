"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, Smartphone, Save, CheckCircle2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, ConsoleCard } from "@/components/saas-admin/console-ui";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Channel credentials, edited in the console instead of the deployment
 * environment — rotating an SMTP password should not need the Coolify
 * login and a restart.
 *
 * SECRETS ARE WRITE-ONLY. The form never receives a secret back, masked
 * or otherwise; it only knows "set" / "not set". Leaving a secret field
 * blank keeps the stored value, typing replaces it, and a single "-"
 * clears it back to the env fallback. Non-secret values round-trip
 * normally, because editing a hostname requires seeing it.
 */

interface FieldState {
  key: string;
  label: string;
  channel: "email" | "whatsapp" | "sms";
  secret: boolean;
  required: boolean;
  placeholder: string;
  set: boolean;
  value: string | null;
  source: "settings" | "env" | null;
}

interface ChannelInfo {
  channel: "email" | "whatsapp" | "sms";
  configured: boolean;
  identity: string | null;
}

const CHANNEL_META = {
  email: { icon: Mail, label: "Email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp (Meta Cloud API)" },
  sms: { icon: Smartphone, label: "SMS (MSG91)" },
} as const;

interface GraphCheck {
  step: string;
  ok: boolean;
  detail: string;
}

interface Diagnosis {
  provider: string;
  mx: string[];
  advice: string;
  credential: {
    length: number;
    hasSurroundingWhitespace: boolean;
    looksTruncatedAtQuote: boolean;
  };
  attempts: { host: string; port: number; label: string; ok: boolean; error?: string }[];
}

export function ChannelSettings({ onChanged }: { onChanged?: () => void }) {
  const [fields, setFields] = useState<FieldState[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [graphChecks, setGraphChecks] = useState<GraphCheck[] | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/saas-admin/messaging/settings");
      const json = await res.json();
      if (res.ok) {
        setFields(json.fields);
        setChannels(json.channels);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const changed = Object.fromEntries(
      Object.entries(drafts).filter(([, v]) => v !== ""),
    );
    if (Object.keys(changed).length === 0) {
      toast.info("Nothing changed.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/saas-admin/messaging/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success("Channel settings saved — they apply to the next send.");
      setDrafts({});
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Send one email to the admin's own address. Debugging a mailbox
   * otherwise means triggering a real password reset and reading the
   * log — slow, and it emails a customer to do it.
   */
  const sendTest = async () => {
    setTesting(true);
    setTestError(null);
    setDiagnosis(null);
    setGraphChecks(null);
    try {
      const res = await fetch("/api/saas-admin/messaging/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setTestError(json.error ?? "Test send failed");
        setDiagnosis(json.diagnosis ?? null);
        setGraphChecks(json.graphChecks ?? null);
        return;
      }
      setDiagnosis(null);
      toast.success(`Test sent to ${json.to} via ${json.host}:${json.port}`);
    } catch {
      setTestError("Could not reach the server");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return null;

  return (
    <ConsoleCard
      title="Channel settings"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={testing}
            onClick={sendTest}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {testing ? "Sending…" : "Send test email"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      {testError && (
        <div className="mb-4 space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <div>
            <p className="text-xs font-bold text-red-400">The mailbox rejected the test</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-red-300">
              {testError}
            </p>
          </div>

          {graphChecks && (
            <div className="space-y-2 rounded-md bg-background/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Microsoft Graph — checked field by field
              </p>
              {graphChecks.map((c) => (
                <p key={c.step} className="text-xs">
                  {c.ok ? (
                    <span className="text-emerald-400">ok</span>
                  ) : (
                    <span className="text-red-400">failed</span>
                  )}{" "}
                  <span className="font-medium text-foreground">{c.step}</span>
                  <span className="block pl-8 text-muted-foreground">{c.detail}</span>
                </p>
              ))}
            </div>
          )}

          {diagnosis && (
            <div className="space-y-2 rounded-md bg-background/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                What we checked
              </p>

              {/* Who really hosts this domain. A mailbox pointed at the
                  wrong provider fails identically to a bad password. */}
              <p className="text-xs text-foreground">
                <span className="text-muted-foreground">Mail host for this domain:</span>{" "}
                <strong>{diagnosis.provider}</strong>
                {diagnosis.mx?.[0] && (
                  <span className="text-muted-foreground"> ({diagnosis.mx[0]})</span>
                )}
              </p>

              {/* Shape only — never the secret itself. */}
              <p className="text-xs text-foreground">
                <span className="text-muted-foreground">Stored password:</span>{" "}
                {diagnosis.credential.length} characters
                {diagnosis.credential.hasSurroundingWhitespace && (
                  <strong className="text-amber-400"> · has leading/trailing whitespace</strong>
                )}
                {diagnosis.credential.looksTruncatedAtQuote && (
                  <strong className="text-amber-400"> · looks cut off at a quote</strong>
                )}
              </p>

              {diagnosis.attempts?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Endpoints tried:</p>
                  {diagnosis.attempts.map((a) => (
                    <p key={`${a.host}:${a.port}`} className="pl-3 text-xs">
                      {a.ok ? (
                        <span className="text-emerald-400">accepted</span>
                      ) : (
                        <span className="text-red-400">refused</span>
                      )}{" "}
                      <span className="text-foreground">
                        {a.host}:{a.port}
                      </span>{" "}
                      <span className="text-muted-foreground">— {a.label}</span>
                    </p>
                  ))}
                </div>
              )}

              <p className="text-xs leading-relaxed text-amber-300">{diagnosis.advice}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {(["email", "whatsapp", "sms"] as const).map((ch) => {
          const meta = CHANNEL_META[ch];
          const info = channels.find((c) => c.channel === ch);
          return (
            <div key={ch} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <meta.icon className="h-4 w-4 text-primary" /> {meta.label}
                </span>
                {info?.configured && (
                  <Badge tone="good">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> ready
                  </Badge>
                )}
              </div>
              {fields
                .filter((f) => f.channel === ch)
                .filter((f) => {
                  // Email shows one provider's fields at a time. The
                  // selector row itself always shows.
                  if (ch !== "email" || f.key === "email_provider") return true;
                  const provider = (
                    drafts.email_provider ??
                    fields.find((x) => x.key === "email_provider")?.value ??
                    "smtp"
                  ).toLowerCase();
                  const isMs = f.key.startsWith("ms_");
                  return provider === "microsoft" ? isMs : !isMs;
                })
                .map((f) =>
                  f.key === "email_provider" ? (
                    <label key={f.key} className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                        Provider
                      </span>
                      <NativeSelect
                        value={drafts.email_provider ?? f.value ?? "smtp"}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, email_provider: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="smtp">SMTP (any mailbox)</option>
                        <option value="microsoft">Microsoft 365 / Outlook (Graph)</option>
                      </NativeSelect>
                    </label>
                  ) : (
                  <label key={f.key} className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>
                        {f.label}
                        {f.required && " *"}
                      </span>
                      {f.secret && f.set && (
                        <span className="text-emerald-400">set{f.source === "env" ? " (env)" : ""}</span>
                      )}
                      {!f.secret && f.source === "env" && (
                        <span className="text-muted-foreground">from env</span>
                      )}
                    </span>
                    <input
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      value={drafts[f.key] ?? (f.secret ? "" : f.value ?? "")}
                      onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={
                        f.secret && f.set ? "•••••• (leave blank to keep)" : f.placeholder
                      }
                      className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </label>
                  ),
                )}
              {ch === "email" &&
                (drafts.email_provider ??
                  fields.find((x) => x.key === "email_provider")?.value ??
                  "smtp") === "microsoft" && (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Needs an Entra app registration with the <em>application</em> permission
                    Mail.Send and admin consent. No user signs in — the app sends as the
                    mailbox above. Consider an ApplicationAccessPolicy to restrict the app
                    to that one mailbox.
                  </p>
                )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Secrets are encrypted at rest and never shown again — leave a secret blank to keep
        it, or enter a single <code>-</code> to clear it. Values saved here override
        environment variables on the next send.
      </p>
    </ConsoleCard>
  );
}
