"use client";

/**
 * Shared plumbing for the financial report pages (Trial Balance,
 * P&L, Balance Sheet): period selection defaulting to the Indian
 * financial year, fetch-on-change, and the header bar.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { defaultPeriod } from "@/lib/accounting/reports";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function useFinancialReport<T>(type: "trial_balance" | "pnl" | "balance_sheet") {
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [{ start, end }, setPeriod] = useState(() => defaultPeriod(new Date()));
  const [report, setReport] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accounting/reports?workspace_id=${workspaceId}&type=${type}&start=${start}&end=${end}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load report");
      setReport(json.report as T);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, type, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  return { report, loading, start, end, setPeriod, defaultCurrency, reload: load };
}

export function PeriodBar({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (p: { start: string; end: string }) => void;
}) {
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} className="w-40" />
      </div>
      <Button
        variant="outline"
        onClick={() => draftStart && draftEnd && onChange({ start: draftStart, end: draftEnd })}
      >
        Apply
      </Button>
    </div>
  );
}

export function ReportLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

export function BalancedBadge({ balanced, label }: { balanced: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${
        balanced
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/20 bg-red-500/10 text-red-400"
      }`}
    >
      {label ?? (balanced ? "Balanced" : "Out of balance")}
    </span>
  );
}
