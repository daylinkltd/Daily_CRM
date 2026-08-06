"use client";

import { useState } from "react";
import { CalendarPlus, Power } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/saas-admin/console-ui";

/**
 * Subscription overrides for one tenant, inside the platform console.
 *
 * These are support levers, not billing operations: extending a trial for
 * a promising prospect, reviving a workspace while a payment dispute
 * settles, or ending one that should not be running. No money moves here
 * — money only ever moves through checkout — and every change lands in
 * the admin audit with its before value.
 */
export function SubscriptionControls({
  workspaceId,
  status,
  trialEndsAt,
  currentPeriodEnd,
  onChanged,
}: {
  workspaceId: string;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [extendDays, setExtendDays] = useState("7");

  const patch = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/saas-admin/tenants/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success("Subscription updated");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const tone =
    status === "active" ? "good" : status === "cancelled" ? "bad" : "info";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tone}>{status ?? "unset"}</Badge>
        {trialEndsAt && (
          <span className="text-xs text-muted-foreground">
            trial ends {new Date(trialEndsAt).toLocaleDateString()}
          </span>
        )}
        {currentPeriodEnd && (
          <span className="text-xs text-muted-foreground">
            paid until {new Date(currentPeriodEnd).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Extend trial by (days)
          </span>
          <input
            type="number"
            min={1}
            max={90}
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !Number(extendDays)}
          onClick={() =>
            patch(
              { extend_trial_days: Number(extendDays) },
              `Extend this workspace's trial by ${extendDays} days? It becomes (or stays) a live trial.`,
            )
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Extend
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "active" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch(
                { subscription_status: "active" },
                "Mark this subscription active? Use for payment disputes resolved in the customer's favour — no money moves.",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" /> Force active
          </button>
        )}
        {status !== "cancelled" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch(
                { subscription_status: "cancelled" },
                "Cancel this workspace's subscription? Access runs to its period end, then it pauses.",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Changes are audit-logged with before values. Money never moves from
        here — only checkout can charge.
      </p>
    </div>
  );
}
