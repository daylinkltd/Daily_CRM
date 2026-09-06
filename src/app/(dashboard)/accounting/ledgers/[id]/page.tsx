"use client";

/**
 * Ledger statement — one account, every movement, running balance.
 *
 * The page a click on any ledger lands on (Daylink's ledger detail,
 * ported): voucher-by-voucher rows with the COUNTERPART account named on
 * each line — "₹5,000 debit against SBI Current" reads as a story;
 * "₹5,000 debit" reads as homework — and a running balance computed by
 * the account's nature (debit-normal for assets/expenses, credit-normal
 * for the rest), the way an accountant expects a ledger to read.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  nature: string | null;
  opening_balance: number | null;
  parent_account_id: string | null;
}

interface StatementRow {
  entryId: string;
  referenceType: string | null;
  date: string;
  voucherNumber: string;
  narration: string;
  counterparts: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function LedgerStatementPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const { accountRole } = useAuth();
  const { activeWorkspace, defaultCurrency, can } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  // Same ABAC key as everywhere accounting deletes happen. Owner/admin
  // permission maps carry no CRUD keys, so the role check comes first;
  // the API re-checks via has_workspace_permission.
  const canVoid =
    accountRole === "owner" || accountRole === "admin" || can("accounting:delete");

  const [account, setAccount] = useState<Account | null>(null);
  const [parent, setParent] = useState<Account | null>(null);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [voiding, setVoiding] = useState<StatementRow | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId || !id) return;
    setLoading(true);
    try {
      const { data: acc } = await supabase
        .from("commerce_chart_of_accounts")
        .select("id, account_code, account_name, account_type, nature, opening_balance, parent_account_id")
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .maybeSingle();
      if (!acc) {
        setAccount(null);
        return;
      }
      setAccount(acc as Account);

      if (acc.parent_account_id) {
        const { data: par } = await supabase
          .from("commerce_chart_of_accounts")
          .select("id, account_code, account_name, account_type, nature, opening_balance, parent_account_id")
          .eq("id", acc.parent_account_id)
          .maybeSingle();
        setParent((par as Account) ?? null);
      } else setParent(null);

      // This ledger's lines, with each voucher's header embedded.
      const { data: lines } = await supabase
        .from("commerce_journal_lines")
        .select(
          "journal_entry_id, debit_amount, credit_amount, entry:commerce_journal_entries!inner(id, voucher_number, voucher_date, narration, reference_type, created_at, deleted_at)",
        )
        .eq("account_id", id)
        .is("entry.deleted_at", null)
        .limit(2000);

      type LineRow = {
        journal_entry_id: string;
        debit_amount: number;
        credit_amount: number;
        entry: {
          id: string;
          voucher_number: string;
          voucher_date: string | null;
          narration: string | null;
          reference_type: string | null;
          created_at: string;
        };
      };
      const myLines = ((lines as unknown as LineRow[]) || []).map((l) => ({
        ...l,
        entry: Array.isArray(l.entry) ? l.entry[0] : l.entry,
      }));

      // Counterparts: the OTHER side of each voucher, named. One query
      // for all sibling lines, one for their account names.
      const entryIds = [...new Set(myLines.map((l) => l.journal_entry_id))];
      const siblingsByEntry: Record<string, { account_id: string; debit_amount: number }[]> = {};
      const accountNames: Record<string, string> = {};
      if (entryIds.length) {
        const { data: sibs } = await supabase
          .from("commerce_journal_lines")
          .select("journal_entry_id, account_id, debit_amount")
          .in("journal_entry_id", entryIds)
          .neq("account_id", id);
        for (const s of (sibs as { journal_entry_id: string; account_id: string; debit_amount: number }[]) || []) {
          (siblingsByEntry[s.journal_entry_id] ??= []).push(s);
        }
        const sibAccountIds = [...new Set(Object.values(siblingsByEntry).flat().map((s) => s.account_id))];
        if (sibAccountIds.length) {
          const { data: accs } = await supabase
            .from("commerce_chart_of_accounts")
            .select("id, account_name")
            .in("id", sibAccountIds);
          for (const a of (accs as { id: string; account_name: string }[]) || []) {
            accountNames[a.id] = a.account_name;
          }
        }
      }

      // Oldest first for the running balance; the debit-normal natures
      // grow on the debit side, everything else on the credit side.
      const debitNormal = ["ASSET", "EXPENSE"].includes((acc.nature ?? acc.account_type ?? "").toUpperCase());
      const sorted = myLines.sort((a, b) => {
        const da = a.entry.voucher_date ?? a.entry.created_at.slice(0, 10);
        const dbb = b.entry.voucher_date ?? b.entry.created_at.slice(0, 10);
        return da.localeCompare(dbb) || a.entry.created_at.localeCompare(b.entry.created_at);
      });

      let balance = Number(acc.opening_balance) || 0;
      const out: StatementRow[] = [];
      for (const l of sorted) {
        const date = l.entry.voucher_date ?? l.entry.created_at.slice(0, 10);
        if (fromDate && date < fromDate) {
          // Movements before the window still shift the opening balance —
          // a filtered statement must not pretend history didn't happen.
          balance += debitNormal
            ? Number(l.debit_amount) - Number(l.credit_amount)
            : Number(l.credit_amount) - Number(l.debit_amount);
          continue;
        }
        if (toDate && date > toDate) continue;

        balance += debitNormal
          ? Number(l.debit_amount) - Number(l.credit_amount)
          : Number(l.credit_amount) - Number(l.debit_amount);

        out.push({
          entryId: l.journal_entry_id,
          referenceType: l.entry.reference_type,
          date,
          voucherNumber: l.entry.voucher_number,
          narration: l.entry.narration ?? "",
          counterparts: (siblingsByEntry[l.journal_entry_id] ?? [])
            .map((s) => accountNames[s.account_id] ?? "?")
            .join(", "),
          debit: Number(l.debit_amount) || 0,
          credit: Number(l.credit_amount) || 0,
          balance,
        });
      }
      // Statement reads newest first, like the transactions page.
      setRows(out.reverse());
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId, id, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      debit: rows.reduce((s, r) => s + r.debit, 0),
      credit: rows.reduce((s, r) => s + r.credit, 0),
    }),
    [rows],
  );
  const closing = rows[0]?.balance ?? (Number(account?.opening_balance) || 0);

  async function handleVoid() {
    if (!workspaceId || !voiding) return;
    setVoidBusy(true);
    try {
      const res = await fetch(
        `/api/accounting/journal/${voiding.entryId}?workspace_id=${workspaceId}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || "Failed to void voucher");
        return;
      }
      toast.success(`Voided ${voiding.voucherNumber} — statement updated`);
      setVoiding(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setVoidBusy(false);
    }
  }

  if (!loading && !account) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Ledger not found in this workspace.
        <div className="mt-4">
          <Link href="/accounting/ledgers" className="text-primary hover:underline">
            Back to ledgers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/accounting/ledgers"
          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Back to ledgers"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={account ? `${account.account_name}` : "Ledger"}
          description={
            account
              ? `${account.account_code} · ${account.account_type}${parent ? ` · ${parent.account_name}` : ""}`
              : ""
          }
        />
        {account && (
          <div className="ml-auto text-right">
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
              Closing balance
            </span>
            <span className="text-2xl font-black text-foreground">
              {formatCurrency(closing, defaultCurrency)}
            </span>
            <Badge variant="outline" className="ml-2 text-[10px]">
              {["ASSET", "EXPENSE"].includes((account.nature ?? "").toUpperCase()) ? "Dr" : "Cr"} normal
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" aria-label="From date" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" aria-label="To date" />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} movement{rows.length === 1 ? "" : "s"} · Dr {formatCurrency(totals.debit, defaultCurrency)} · Cr {formatCurrency(totals.credit, defaultCurrency)}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Building statement…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No movements on this ledger{fromDate || toDate ? " in the selected window" : ""}.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-2 py-3">Voucher</th>
                  <th className="px-2 py-3">Narration</th>
                  <th className="px-2 py-3">Against</th>
                  <th className="px-2 py-3 text-right">Debit</th>
                  <th className="px-2 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  {canVoid && <th className="w-10 px-2 py-3" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.entryId}-${i}`} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{r.date}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <code className="text-xs text-muted-foreground">{r.voucherNumber}</code>
                    </td>
                    <td className="max-w-sm truncate px-2 py-2.5 text-muted-foreground" title={r.narration}>
                      {r.narration || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-2.5 text-muted-foreground" title={r.counterparts}>
                      {r.counterparts || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-foreground">
                      {r.debit > 0 ? formatCurrency(r.debit, defaultCurrency) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-foreground">
                      {r.credit > 0 ? formatCurrency(r.credit, defaultCurrency) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-foreground">
                      {formatCurrency(r.balance, defaultCurrency)}
                    </td>
                    {canVoid && (
                      <td className="px-2 py-2.5 text-right">
                        {(r.referenceType === "MANUAL_JOURNAL" || !r.referenceType) && (
                          <IconAction
                            label={`Void ${r.voucherNumber}`}
                            icon={<Trash2 />}
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => setVoiding(r)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30 font-semibold text-foreground">
                  <td className="px-4 py-3" colSpan={4}>
                    Totals{fromDate || toDate ? " (window)" : ""}
                  </td>
                  <td className="px-2 py-3 text-right">{formatCurrency(totals.debit, defaultCurrency)}</td>
                  <td className="px-2 py-3 text-right">{formatCurrency(totals.credit, defaultCurrency)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(closing, defaultCurrency)}</td>
                  {canVoid && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
      {/* Void confirmation — soft delete; the voucher leaves every
          balance but stays in the books marked voided. */}
      <Dialog open={!!voiding} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-400" />
              Void voucher
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Void{" "}
            <span className="font-semibold text-foreground">{voiding?.voucherNumber}</span>?
            Both sides of the entry disappear from every ledger and report, but the
            voucher stays in the books marked as voided — nothing is erased.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)} disabled={voidBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleVoid}
              disabled={voidBusy}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {voidBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Void voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
