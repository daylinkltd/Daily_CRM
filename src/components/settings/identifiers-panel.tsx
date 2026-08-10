"use client";

import { useState } from "react";
import { Copy, Check, Fingerprint } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

/**
 * The three identifiers anyone integrating, debugging or filing a support
 * ticket needs, in one place — nobody should have to open devtools to
 * find their own workspace id.
 *
 * Tenant ID and Workspace ID show the SAME value on purpose, labelled as
 * such: in Dailybiz a tenant IS a workspace (one row in `workspaces`),
 * and pretending there is a second hidden identifier would send people
 * hunting for something that does not exist. The API and every table use
 * this one UUID.
 */
export function IdentifiersPanel() {
  const { user } = useAuth();
  const { activeWorkspace, activeMember } = useWorkspace();
  const [copied, setCopied] = useState<string | null>(null);

  const rows = [
    {
      label: "Tenant ID / Workspace ID",
      hint: "One and the same — a tenant is a workspace. Used by the API and every export.",
      value: activeWorkspace?.id ?? "—",
    },
    {
      label: "Your User ID",
      hint: "Your account, the same across every workspace you belong to.",
      value: user?.id ?? "—",
    },
    {
      label: "Your Member ID",
      hint: "You inside this workspace — attendance, timesheets and assignments key on this.",
      value: activeMember?.id ?? "—",
    },
  ];

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked (permissions, http); the value is
      // visible and selectable either way.
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/20 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Fingerprint className="h-4 w-4 text-primary" /> Identifiers
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        For API calls, imports and support requests.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3"
          >
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">{r.label}</span>
              <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
                {r.value}
              </code>
              <button
                type="button"
                onClick={() => copy(r.label, r.value)}
                aria-label={`Copy ${r.label}`}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {copied === r.label ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
