"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { PLANS } from "@/config/plans";
import {
  Badge,
  ConsoleCard,
  LoadingRow,
  Pager,
  SearchBox,
  useConsoleData,
} from "@/components/saas-admin/console-ui";
import { NativeSelect } from "@/components/ui/native-select";

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  company_email: string | null;
  gstin: string | null;
  member_count: number;
}

interface TenantList {
  tenants: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PLAN_TONE: Record<string, "good" | "info" | "neutral" | "warn"> = {
  business: "good",
  custom: "info",
  free: "neutral",
};

export default function TenantsPage() {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(0);

  const { data, loading, error } = useConsoleData<TenantList>(
    `/api/saas-admin/tenants/list?q=${encodeURIComponent(q)}&plan=${plan}&page=${page}`,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Tenants
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Name or email…" />
          <NativeSelect
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All plans</option>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <ConsoleCard>
        {loading && !data ? (
          <LoadingRow label="Loading tenants…" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2.5 pr-4">Workspace</th>
                    <th className="pb-2.5 pr-4">Plan</th>
                    <th className="pb-2.5 pr-4 text-right">Members</th>
                    <th className="pb-2.5 pr-4">GSTIN</th>
                    <th className="pb-2.5 pr-4">Created</th>
                    <th className="pb-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.tenants ?? []).map((t) => (
                    <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-foreground">{t.name}</span>
                        {t.company_email && (
                          <span className="block text-[11px] text-muted-foreground">{t.company_email}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={PLAN_TONE[t.plan] ?? "neutral"}>{t.plan || "free"}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-foreground">{t.member_count}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{t.gstin ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/saas-admin/tenants/${t.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          Manage <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(data?.tenants ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No tenants match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </ConsoleCard>
    </div>
  );
}
