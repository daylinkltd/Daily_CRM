"use client";

/**
 * New Entry — manual journal voucher (daylink-style).
 *
 * Multi-line Dr/Cr grid with a live balance indicator; posting goes
 * through /api/accounting/journal → the posting engine, so the same
 * balance validation and voucher numbering apply as to system
 * postings. The DB's deferred trigger is the final arbiter.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, Plus, Trash2, Loader2, Scale } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconAction } from "@/components/ui/icon-action";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface Line {
  account_id: string;
  debit: string;
  credit: string;
}

const BLANK_LINE: Line = { account_id: "", debit: "", credit: "" };

export default function NewEntryPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }, { ...BLANK_LINE }]);
  const [posting, setPosting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("commerce_chart_of_accounts")
      .select("id, account_code, account_name, account_type")
      .eq("workspace_id", workspaceId)
      .order("account_code");
    setAccounts((data as Account[]) || []);
  }, [supabase, workspaceId]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function handlePost() {
    if (!workspaceId) return;
    if (!narration.trim()) {
      toast.error("A narration is required");
      return;
    }
    const filled = lines.filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (filled.length < 2) {
      toast.error("A journal entry needs at least two lines");
      return;
    }
    if (!totals.balanced) {
      toast.error("Debits and credits must balance before posting");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          narration: narration.trim(),
          voucher_date: voucherDate,
          lines: filled.map((l) => ({
            account_id: l.account_id,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to post entry");
      toast.success(`Voucher ${json.voucher.voucher_number} posted`);
      setNarration("");
      setLines([{ ...BLANK_LINE }, { ...BLANK_LINE }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post entry");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="New Journal Entry"
        description="Post a manual voucher. Debits and credits must balance — the ledger enforces it."
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Voucher date</label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Narration</label>
              <Textarea plain
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="What is this entry for?"
                rows={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_8rem_2.5rem] gap-2 text-xs font-medium text-muted-foreground">
              <span>Account</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem_8rem_2.5rem] items-center gap-2">
                <Select value={l.account_id} onValueChange={(v) => v && setLine(i, { account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent searchPlaceholder="Search accounts...">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_code} — {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="text-right"
                  type="number" min="0" placeholder="0.00"
                  value={l.debit}
                  onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                />
                <Input
                  className="text-right"
                  type="number" min="0" placeholder="0.00"
                  value={l.credit}
                  onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                />
                <IconAction
                  label="Remove line"
                  icon={<Trash2 />}
                  variant="ghost"
                  disabled={lines.length <= 2}
                  onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, { ...BLANK_LINE }])}>
              <Plus /> Add line
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div
              className={`inline-flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium ${
                totals.balanced
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
              }`}
            >
              <Scale className="size-3.5" />
              {totals.balanced
                ? "Balanced"
                : `Off by ${formatCurrency(Math.abs(totals.debit - totals.credit), defaultCurrency, { decimals: 2 })}`}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Dr <span className="font-medium text-foreground">{formatCurrency(totals.debit, defaultCurrency, { decimals: 2 })}</span>
              </span>
              <span className="text-muted-foreground">
                Cr <span className="font-medium text-foreground">{formatCurrency(totals.credit, defaultCurrency, { decimals: 2 })}</span>
              </span>
              <Button onClick={handlePost} disabled={posting || !totals.balanced}>
                {posting ? <Loader2 className="animate-spin" /> : <BookOpenCheck />} Post Voucher
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
