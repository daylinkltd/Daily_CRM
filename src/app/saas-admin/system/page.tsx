"use client";

import { Settings2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  StatCard,
  useConsoleData,
} from "@/components/saas-admin/console-ui";

interface ConfigItem {
  key: string;
  label: string;
  purpose: string;
  configured: boolean;
  length: number;
  required: boolean;
}

interface SystemData {
  config: Record<string, ConfigItem[]>;
  health: {
    database: "ok" | "error";
    databaseError: string | null;
    dbLatencyMs: number;
    environment: string;
    missingRequired: string[];
  };
}

export default function SystemPage() {
  const { data, loading, error } = useConsoleData<SystemData>("/api/saas-admin/system");

  if (loading && !data) return <LoadingRow label="Checking configuration…" />;
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-rose-400">{error ?? "Failed to load"}</p>;
  }

  const { config, health } = data;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" /> System
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Database"
          value={health.database === "ok" ? "Healthy" : "Error"}
          tone={health.database === "ok" ? "good" : "bad"}
          hint={health.database === "ok" ? `${health.dbLatencyMs}ms round trip` : health.databaseError ?? undefined}
        />
        <StatCard label="Environment" value={health.environment} />
        <StatCard
          label="Required config"
          value={health.missingRequired.length === 0 ? "Complete" : `${health.missingRequired.length} missing`}
          tone={health.missingRequired.length === 0 ? "good" : "bad"}
          hint={health.missingRequired.join(", ") || undefined}
        />
      </div>

      {/*
        Secrets are shown as configured/missing ONLY. No values, no masked
        previews, no last-four. The API never sends them, so nothing here
        could render one even by mistake — that property is worth more
        than the convenience of eyeballing a key.
      */}
      {Object.entries(config).map(([group, items]) => (
        <ConsoleCard key={group} title={group}>
          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {item.configured ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : item.required ? (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {item.label}
                    <code className="text-[10px] text-muted-foreground">{item.key}</code>
                  </span>
                  <span className="mt-0.5 block pl-6 text-[11px] text-muted-foreground">
                    {item.purpose}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.configured && (
                    <span className="text-[10px] text-muted-foreground">{item.length} chars</span>
                  )}
                  <Badge tone={item.configured ? "good" : item.required ? "bad" : "neutral"}>
                    {item.configured ? "configured" : item.required ? "MISSING" : "not set"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ConsoleCard>
      ))}

      <p className="text-[11px] text-muted-foreground">
        Values are never displayed here, by design. To rotate a secret, change it in the
        deployment environment (Coolify) and redeploy — this page will confirm the new
        value arrived by its length.
      </p>
    </div>
  );
}
