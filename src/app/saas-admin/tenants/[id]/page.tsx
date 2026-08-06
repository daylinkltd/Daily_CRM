"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { toast } from "sonner";

import { PLANS } from "@/config/plans";
import {
  Badge,
  ConsoleCard,
  LoadingRow,
  StatCard,
  useConsoleData,
} from "@/components/saas-admin/console-ui";
import { SubscriptionControls } from "@/components/saas-admin/subscription-controls";

interface TenantDetail {
  workspace: {
    id: string;
    name: string;
    plan: string;
    plan_limits: Record<string, unknown> | null;
    created_at: string;
    company_email: string | null;
    gstin: string | null;
    state_code: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
  };
  members: {
    id: string;
    user_id: string;
    role: string;
    created_at: string;
    profiles: { full_name: string | null; email: string; status: string | null } | null;
  }[];
  flags: Record<string, boolean | string> | null;
  usage: { messages30d: number };
}

/** Console-editable feature toggles, labelled for humans. */
const FLAGS: { key: string; label: string }[] = [
  { key: "enable_crm", label: "CRM & Inbox" },
  { key: "enable_hr", label: "HR & Payroll" },
  { key: "enable_retail", label: "Retail & POS" },
  { key: "enable_projects", label: "Projects" },
  { key: "enable_manufacturing", label: "Manufacturing" },
  { key: "enable_wms", label: "Warehouse (WMS)" },
  { key: "enable_services", label: "Services" },
];

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useConsoleData<TenantDetail>(
    `/api/saas-admin/tenants/${id}`,
  );

  const [saving, setSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState<string | null>(null);
  const [seatsDraft, setSeatsDraft] = useState<string | null>(null);
  const [flagsDraft, setFlagsDraft] = useState<Record<string, boolean>>({});

  if (loading && !data) return <LoadingRow label="Loading tenant…" />;
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-rose-400">{error ?? "Not found"}</p>;
  }

  const w = data.workspace;
  const limits = (w.plan_limits ?? {}) as { max_members?: number | null; max_messages?: number | null };
  const plan = planDraft ?? (w.plan || "free");
  const seats = seatsDraft ?? String(limits.max_members ?? "");

  const flagValue = (key: string): boolean => {
    if (key in flagsDraft) return flagsDraft[key];
    return Boolean(data.flags?.[key] ?? true);
  };

  const dirty =
    planDraft !== null ||
    seatsDraft !== null ||
    Object.keys(flagsDraft).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (planDraft !== null) body.plan = planDraft;
      if (seatsDraft !== null && seatsDraft !== "") {
        body.plan_limits = { max_members: Math.max(1, Number(seatsDraft) || 1) };
      }
      if (Object.keys(flagsDraft).length > 0) body.flags = flagsDraft;

      const res = await fetch(`/api/saas-admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      toast.success("Tenant updated");
      setPlanDraft(null);
      setSeatsDraft(null);
      setFlagsDraft({});
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/saas-admin/tenants")}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
            aria-label="Back to tenants"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> {w.name}
          </h1>
          <Badge tone={w.plan === "business" ? "good" : "neutral"}>{w.plan || "free"}</Badge>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Members" value={data.members.length} hint={`Seat limit: ${limits.max_members ?? "—"}`} />
        <StatCard label="Messages (30d)" value={data.usage.messages30d.toLocaleString()} />
        <StatCard label="Created" value={new Date(w.created_at).toLocaleDateString()} hint={w.gstin ? `GSTIN ${w.gstin}` : "No GSTIN set"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ConsoleCard title="Plan & seats">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlanDraft(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Seats (max members)
              </span>
              <input
                type="number"
                min={1}
                value={seats}
                onChange={(e) => setSeatsDraft(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Overrides what checkout sold them. Changes are audit-logged with the before value.
              </span>
            </label>
          </div>
        </ConsoleCard>

        <ConsoleCard title="Subscription">
          <SubscriptionControls
            workspaceId={id}
            status={w.subscription_status}
            trialEndsAt={w.trial_ends_at}
            currentPeriodEnd={w.current_period_end}
            onChanged={reload}
          />
        </ConsoleCard>

        <ConsoleCard title="Module access">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FLAGS.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 hover:border-border"
              >
                <span className="text-sm text-foreground">{f.label}</span>
                <input
                  type="checkbox"
                  checked={flagValue(f.key)}
                  onChange={(e) => setFlagsDraft((d) => ({ ...d, [f.key]: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </ConsoleCard>
      </div>

      <ConsoleCard title={`Members (${data.members.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2.5 pr-4">Name</th>
                <th className="pb-2.5 pr-4">Email</th>
                <th className="pb-2.5 pr-4">Role</th>
                <th className="pb-2.5 pr-4">Status</th>
                <th className="pb-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-4 font-semibold text-foreground">
                    {m.profiles?.full_name ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{m.profiles?.email ?? "—"}</td>
                  <td className="py-2.5 pr-4"><Badge tone={m.role === "owner" ? "info" : "neutral"}>{m.role}</Badge></td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={m.profiles?.status === "blocked" ? "bad" : "good"}>
                      {m.profiles?.status ?? "active"}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ConsoleCard>
    </div>
  );
}
