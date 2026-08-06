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
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [parent, setParent] = useState<Account | null>(null);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
          "journal_entry_id, debit_amount, credit_amount, entry:commerce_journal_entries!inner(id, voucher_number, voucher_date, narration, created_at, deleted_at)",
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
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
