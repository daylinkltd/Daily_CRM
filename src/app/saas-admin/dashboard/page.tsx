"use client";

import Link from "next/link";
import { LayoutDashboard, ArrowRight, IndianRupee, Users, Building2, Radio } from "lucide-react";

import {
  ConsoleCard,
  LoadingRow,
  StatCard,
  useConsoleData,
} from "@/components/saas-admin/console-ui";

/**
 * The console front page.
 *
 * This used to be an 1,148-line single-page admin that fetched every
 * profile, workspace and prospect in full and managed them inline. That
 * work now lives on dedicated pages (Tenants, Users, Prospects,
 * Announcements, Logs, System) with pagination and server-side search;
 * the front page's only job is the numbers and the shortcuts.
 */

interface Overview {
  tenants: { total: number; new30d: number; byPlan: Record<string, number> };
  users: { total: number; new7d: number; activeSessions: number };
  revenue: { estimatedMrr: number; paidSeats: number; currency: string };
  pipeline: { prospects: number; open: number };
}

const SHORTCUTS = [
  { href: "/saas-admin/tenants", label: "Manage tenants", desc: "Plans, seats, module access", icon: Building2 },
  { href: "/saas-admin/users", label: "Manage users", desc: "Block, sign out, reset passwords", icon: Users },
  { href: "/saas-admin/logs", label: "Review logs", desc: "Every sign-in and admin action", icon: Radio },
];

export default function AdminOverviewPage() {
  const { data, loading, error } = useConsoleData<Overview>("/api/saas-admin/overview");

  if (loading && !data) return <LoadingRow label="Loading overview…" />;
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-rose-400">{error ?? "Failed to load"}</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-primary" /> Overview
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tenants"
          value={data.tenants.total.toLocaleString()}
          hint={`${data.tenants.new30d} new in 30 days`}
        />
        <StatCard
          label="Users"
          value={data.users.total.toLocaleString()}
          hint={`${data.users.new7d} new this week`}
        />
        <StatCard
          label="Signed in right now"
          value={data.users.activeSessions.toLocaleString()}
          tone="good"
          hint="Active device sessions (one per user, enforced)"
        />
        <StatCard
          label="Estimated MRR"
          value={
            <span className="inline-flex items-center">
              <IndianRupee className="h-5 w-5" />
              {data.revenue.estimatedMrr.toLocaleString("en-IN")}
            </span>
          }
          hint={`${data.revenue.paidSeats} paid seats · estimate from plan data, not settlements`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ConsoleCard title="Tenants by plan">
          {Object.keys(data.tenants.byPlan).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tenants yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(data.tenants.byPlan)
                .sort(([, a], [, b]) => b - a)
                .map(([plan, count]) => {
                  const pct = Math.round((count / Math.max(1, data.tenants.total)) * 100);
                  return (
                    <div key={plan}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{plan || "free"}</span>
                        <span className="text-muted-foreground">{count} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-card">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </ConsoleCard>

        <ConsoleCard title="Shortcuts">
          <div className="space-y-2.5">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:border-primary"
              >
                <span className="flex items-center gap-3">
                  <s.icon className="h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{s.desc}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Sales pipeline: {data.pipeline.open} open of {data.pipeline.prospects} prospects —{" "}
              <Link href="/saas-admin/prospects" className="text-primary hover:underline">
                manage
              </Link>
              .
            </p>
          </div>
        </ConsoleCard>
      </div>
    </div>
  );
}
