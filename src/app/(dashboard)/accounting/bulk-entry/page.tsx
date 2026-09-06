"use client";

/**
 * Bulk Entry — many vouchers in one sitting (Daylink's grid, ported).
 *
 * Each row is one complete two-legged voucher: date, narration, debit
 * ledger, credit ledger, amount. Rows post independently — a bad row
 * fails alone and stays in the grid with its error while the good rows
 * clear, so nobody re-keys thirteen vouchers to fix one.
 *
 * The paste box accepts spreadsheet rows (TSV or CSV):
 *   date, narration, debit ledger, credit ledger, amount
 * Ledgers match by code (L-0001) or by name, case-insensitively —
 * whichever the spreadsheet happens to carry.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, Trash2, Loader2, ClipboardPaste, CheckCircle2, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { QuickCreateLedger } from "@/components/shared/quick-create-ledger";
import { IconAction } from "@/components/ui/icon-action";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
}

interface Row {
  voucher_date: string;
  narration: string;
  debit_account_id: string | null;
  credit_account_id: string | null;
  amount: string;
  /** Set after a submit attempt. */
  result?: { ok: boolean; text: string };
}

const today = () => new Date().toISOString().slice(0, 10);
const blankRow = (prev?: Row): Row => ({
  // Date and narration carry forward from the row above — bulk keying is
  // usually one bank statement, one day at a time.
  voucher_date: prev?.voucher_date ?? today(),
  narration: "",
  debit_account_id: prev?.debit_account_id ?? null,
  credit_account_id: prev?.credit_account_id ?? null,
  amount: "",
});

export default function BulkEntryPage() {
  const supabase = createClient();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [posting, setPosting] = useState(false);
  // Which row+side asked for a new ledger, so it lands back there.
  const [ledgerTarget, setLedgerTarget] = useState<{
    row: number;
    side: "debit_account_id" | "credit_account_id";
  } | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("commerce_chart_of_accounts")
      .select("id, account_code, account_name")
      .eq("workspace_id", workspaceId)
      .order("account_code");
    setAccounts((data as Account[]) || []);
  }, [supabase, workspaceId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const options = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: a.account_name,
        hint: a.account_code,
      })),
    [accounts],
  );

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch, result: undefined } : r)));

  const filled = rows.filter(
    (r) => r.debit_account_id && r.credit_account_id && r.narration.trim() && Number(r.amount) > 0,
  );
  const batchTotal = filled.reduce((s, r) => s + Number(r.amount), 0);

  function findAccount(token: string): Account | undefined {
    const t = token.trim().toLowerCase();
    if (!t) return undefined;
    return (
      accounts.find((a) => a.account_code.toLowerCase() === t) ??
      accounts.find((a) => a.account_name.toLowerCase() === t) ??
      accounts.find((a) => a.account_name.toLowerCase().includes(t))
    );
  }

  function handleParse() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const parsed: Row[] = [];
    const problems: string[] = [];
    lines.forEach((line, idx) => {
      // Tabs first (straight from a spreadsheet), commas as fallback.
      const parts = (line.includes("\t") ? line.split("\t") : line.split(",")).map((p) => p.trim());
      if (parts.length < 5) {
        problems.push(`Line ${idx + 1}: expected 5 columns (date, narration, debit, credit, amount)`);
        return;
      }
      const [date, narration, debitTok, creditTok, amountTok] = parts;
      const debit = findAccount(debitTok);
      const credit = findAccount(creditTok);
      if (!debit) problems.push(`Line ${idx + 1}: no ledger matches "${debitTok}"`);
      if (!credit) problems.push(`Line ${idx + 1}: no ledger matches "${creditTok}"`);
      const amount = Number(amountTok.replace(/[₹,\s]/g, ""));
      if (!(amount > 0)) problems.push(`Line ${idx + 1}: amount "${amountTok}" is not positive`);

      parsed.push({
        voucher_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
        narration,
        debit_account_id: debit?.id ?? null,
        credit_account_id: credit?.id ?? null,
        amount: amount > 0 ? String(amount) : "",
      });
    });

    setRows(parsed.length ? parsed : rows);
    setPasteOpen(false);
    setPasteText("");
    if (problems.length) {
      toast.warning(`Parsed with ${problems.length} problem${problems.length === 1 ? "" : "s"} — fix the highlighted rows`, {
        description: problems.slice(0, 3).join(" · "),
      });
    } else {
      toast.success(`Parsed ${parsed.length} row${parsed.length === 1 ? "" : "s"}`);
    }
  }

  async function handlePost() {
    if (!workspaceId || filled.length === 0) {
      toast.error("No complete rows to post");
      return;
    }
    setPosting(true);
    try {
      const submitted = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.debit_account_id && r.credit_account_id && r.narration.trim() && Number(r.amount) > 0);

      const res = await fetch("/api/accounting/journal/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          vouchers: submitted.map(({ r }) => ({
            voucher_date: r.voucher_date,
            narration: r.narration.trim(),
            debit_account_id: r.debit_account_id,
            credit_account_id: r.credit_account_id,
            amount: Number(r.amount),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bulk post failed");

      // Successful rows leave the grid; failures stay with their error
      // attached, ready to fix and repost.
      const failures: Row[] = [];
      json.results.forEach((result: { row: number; ok: boolean; voucher_number?: string; error?: string }, k: number) => {
        const original = submitted[k].r;
        if (!result.ok) {
          failures.push({ ...original, result: { ok: false, text: result.error ?? "Failed" } });
        }
      });
      const untouched = rows.filter(
        (r) => !(r.debit_account_id && r.credit_account_id && r.narration.trim() && Number(r.amount) > 0),
      );
      setRows(failures.length || untouched.length ? [...failures, ...untouched.filter((r) => r.narration || r.amount)] : [blankRow(), blankRow(), blankRow()]);

      if (json.failed === 0) toast.success(`${json.posted} voucher${json.posted === 1 ? "" : "s"} posted`);
      else toast.warning(`${json.posted} posted, ${json.failed} failed — failed rows kept below with their errors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk post failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Entry"
        description="One voucher per row — date, narration, debit ledger, credit ledger, amount. Paste straight from a spreadsheet."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" /> Paste rows
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, blankRow(prev[prev.length - 1])])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add row
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {filled.length} ready · batch total {formatCurrency(batchTotal, defaultCurrency)}
        </span>
        <IconAction
          label={posting ? "Posting…" : `Post ${filled.length || ""} voucher${filled.length === 1 ? "" : "s"}`}
          icon={posting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          onClick={handlePost}
          disabled={posting || filled.length === 0}
        />
      </div>

      {pasteOpen && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder={"One voucher per line, tab- or comma-separated:\n2026-08-01\tOffice rent August\tRent Expense\tSBI Current\t25000\n2026-08-02,Client receipt,Cash Book,L-0012,15000"}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleParse} disabled={!pasteText.trim()}>
                Parse into rows
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Ledgers match by code (L-0001) or name. Dates must be YYYY-MM-DD; anything else becomes today.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-36 px-3 py-3">Date</th>
                <th className="px-2 py-3">Narration</th>
                <th className="w-56 px-2 py-3">Debit ledger</th>
                <th className="w-56 px-2 py-3">Credit ledger</th>
                <th className="w-32 px-2 py-3 text-right">Amount</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 align-top ${r.result && !r.result.ok ? "bg-rose-500/5" : ""}`}>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={r.voucher_date}
                      onChange={(e) => setRow(i, { voucher_date: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={r.narration}
                      onChange={(e) => setRow(i, { narration: e.target.value })}
                      placeholder="What this voucher records"
                      className="h-9"
                    />
                    {r.result && !r.result.ok && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-rose-500">
                        <XCircle className="h-3 w-3" /> {r.result.text}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <SearchableSelect
                      options={options}
                      value={r.debit_account_id}
                      onChange={(v) => setRow(i, { debit_account_id: v })}
                      placeholder="Debit…"
                      ariaLabel={`Row ${i + 1} debit ledger`}
                      createLabel="Add ledger"
                      onCreate={() => setLedgerTarget({ row: i, side: "debit_account_id" })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <SearchableSelect
                      options={options}
                      value={r.credit_account_id}
                      onChange={(v) => setRow(i, { credit_account_id: v })}
                      placeholder="Credit…"
                      ariaLabel={`Row ${i + 1} credit ledger`}
                      createLabel="Add ledger"
                      onCreate={() => setLedgerTarget({ row: i, side: "credit_account_id" })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                      className="h-9 text-right"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                      aria-label={`Remove row ${i + 1}`}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:border-rose-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <QuickCreateLedger
        open={ledgerTarget !== null}
        onOpenChange={(open) => !open && setLedgerTarget(null)}
        workspaceId={workspaceId}
        onCreated={(ledger) => {
          void loadAccounts();
          if (ledgerTarget) setRow(ledgerTarget.row, { [ledgerTarget.side]: ledger.id });
          setLedgerTarget(null);
        }}
      />

      <p className="text-[11px] text-muted-foreground">
        Rows post independently through the same posting engine as New Entry — each becomes a
        numbered voucher, a failed row keeps its error here, and nothing is ever half-posted.
      </p>
    </div>
  );
}
