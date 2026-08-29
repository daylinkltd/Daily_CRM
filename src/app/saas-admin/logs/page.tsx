"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  Pager,
  SearchBox,
  useConsoleData,
} from "@/components/saas-admin/console-ui";
import { NativeSelect } from "@/components/ui/native-select";

interface LogRow {
  id: number;
  created_at: string;
  // activity
  event?: string;
  severity?: "info" | "warning" | "error";
  user_email?: string | null;
  // audit
  action?: string;
  actor_email?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
}

interface LogList {
  source: "activity" | "audit";
  rows: LogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const SEV_TONE = { info: "neutral", warning: "warn", error: "bad" } as const;

export default function LogsPage() {
  const [source, setSource] = useState<"activity" | "audit">("activity");
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(0);

  const { data, loading, error } = useConsoleData<LogList>(
    `/api/saas-admin/logs?source=${source}&q=${encodeURIComponent(q)}&severity=${severity}&page=${page}`,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" /> Logs
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(["activity", "audit"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSource(s); setPage(0); }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  source === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "activity" ? "Platform activity" : "Admin audit"}
              </button>
            ))}
          </div>
          {source === "activity" && (
            <NativeSelect
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(0); }}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Any severity</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </NativeSelect>
          )}
          <SearchBox
            value={q}
            onChange={(v) => { setQ(v); setPage(0); }}
            placeholder={source === "activity" ? "Event or email…" : "Action, admin or target…"}
          />
        </div>
      </div>

      <ConsoleCard>
        {loading && !data ? (
          <LoadingRow label="Loading logs…" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2.5 pr-4">When</th>
                    <th className="pb-2.5 pr-4">{source === "activity" ? "Event" : "Action"}</th>
                    <th className="pb-2.5 pr-4">{source === "activity" ? "User" : "Admin"}</th>
                    <th className="pb-2.5 pr-4">Details</th>
                    <th className="pb-2.5">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          <code className="text-xs font-semibold text-foreground">
                            {r.event ?? r.action}
                          </code>
                          {r.severity && r.severity !== "info" && (
                            <Badge tone={SEV_TONE[r.severity]}>{r.severity}</Badge>
                          )}
                        </span>
                        {r.target_type && (
                          <span className="block text-[11px] text-muted-foreground">
                            {r.target_type} {r.target_id?.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {r.user_email ?? r.actor_email ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <code className="block max-w-md overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground" title={JSON.stringify(r.details)}>
                          {JSON.stringify(r.details)}
                        </code>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{r.ip_address ?? "—"}</td>
                    </tr>
                  ))}
                  {(data?.rows ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={data?.pageSize ?? 100} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </ConsoleCard>
    </div>
  );
}
