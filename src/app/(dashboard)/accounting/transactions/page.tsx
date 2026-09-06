"use client";

/**
 * Transactions — every journal voucher, newest first.
 *
 * The Daylink accounting module's transactions list, ported. The day
 * book answers "what happened on a date"; this answers "show me
 * everything, let me search it" — voucher number, narration search, a
 * date window, and each voucher expandable to its Dr/Cr lines with
 * account names that link into the ledger statement.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  ArrowRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
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

interface Entry {
  id: string;
  voucher_number: string;
  voucher_type: string | null;
  voucher_date: string | null;
  narration: string | null;
  reference_type: string | null;
  created_at: string;
}

interface Line {
  journal_entry_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
}

interface Account {
  id: string;
  account_code: string;
  account_name: string;
}

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const supabase = createClient();
  const { accountRole } = useAuth();
  const { activeWorkspace, defaultCurrency, can } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  // ABAC: same key as ledger deletion. Owner/admin permission maps don't
  // carry CRUD keys, so the role check comes first; the API re-checks
  // via has_workspace_permission either way.
  const canVoid =
    accountRole === "owner" || accountRole === "admin" || can("accounting:delete");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [linesByEntry, setLinesByEntry] = useState<Record<string, Line[]>>({});
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [voiding, setVoiding] = useState<Entry | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      let q = supabase
        .from("commerce_journal_entries")
        .select("id, voucher_number, voucher_type, voucher_date, narration, reference_type, created_at", {
          count: "exact",
        })
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("voucher_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (fromDate) q = q.gte("voucher_date", fromDate);
      if (toDate) q = q.lte("voucher_date", toDate);
      if (query.trim()) {
        const safe = query.trim().replace(/[,()]/g, " ");
        q = q.or(`voucher_number.ilike.%${safe}%,narration.ilike.%${safe}%`);
      }

      const { data: entryRows, count } = await q;
      const list = (entryRows as Entry[]) || [];
      setEntries(list);
      setTotal(count ?? 0);

      if (list.length) {
        // Lines + account names for the visible page, two round trips
        // total rather than one per voucher.
        const ids = list.map((e) => e.id);
        const { data: lineRows } = await supabase
          .from("commerce_journal_lines")
          .select("journal_entry_id, account_id, debit_amount, credit_amount")
          .in("journal_entry_id", ids);
        const grouped: Record<string, Line[]> = {};
        for (const l of (lineRows as Line[]) || []) {
          (grouped[l.journal_entry_id] ??= []).push(l);
        }
        setLinesByEntry(grouped);

        const accountIds = [...new Set(((lineRows as Line[]) || []).map((l) => l.account_id))];
        if (accountIds.length) {
          const { data: accRows } = await supabase
            .from("commerce_chart_of_accounts")
            .select("id, account_code, account_name")
            .in("id", accountIds);
          setAccounts(Object.fromEntries(((accRows as Account[]) || []).map((a) => [a.id, a])));
        }
      } else {
        setLinesByEntry({});
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId, page, fromDate, toDate, query]);

  useEffect(() => {
    // Debounced: the narration search is an ilike; one query per pause,
    // not one per keystroke.
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const entryTotal = useMemo(
    () => (id: string) =>
      (linesByEntry[id] ?? []).reduce((s, l) => s + (Number(l.debit_amount) || 0), 0),
    [linesByEntry],
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleVoid() {
    if (!workspaceId || !voiding) return;
    setVoidBusy(true);
    try {
      const res = await fetch(
        `/api/accounting/journal/${voiding.id}?workspace_id=${workspaceId}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || "Failed to void voucher");
        return;
      }
      toast.success(`Voided ${voiding.voucher_number} — balances updated`);
      setVoiding(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every voucher in the books, newest first — search by number or narration, expand for the lines."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Voucher no. or narration…"
            className="w-64 pl-9"
          />
        </div>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(0);
          }}
          className="w-40"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(0);
          }}
          className="w-40"
          aria-label="To date"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {total.toLocaleString()} voucher{total === 1 ? "" : "s"}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading transactions…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No vouchers match. Post one from New Entry or Bulk Entry.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Voucher</th>
                  <th className="px-2 py-3">Narration</th>
                  <th className="px-2 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {canVoid && <th className="w-10 px-2 py-3" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const open = expanded[e.id];
                  const lines = linesByEntry[e.id] ?? [];
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => setExpanded((x) => ({ ...x, [e.id]: !x[e.id] }))}
                        className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-medium text-foreground">
                          {e.voucher_date ?? e.created_at.slice(0, 10)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3">
                          <code className="text-xs text-foreground">{e.voucher_number}</code>
                        </td>
                        <td className="max-w-md truncate px-2 py-3 text-muted-foreground" title={e.narration ?? undefined}>
                          {e.narration ?? "—"}
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {e.reference_type ?? e.voucher_type ?? "JOURNAL"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(entryTotal(e.id), defaultCurrency)}
                        </td>
                        {canVoid && (
                          <td className="px-2 py-3 text-right">
                            {/* Only manual journals are voidable — system
                                postings mirror a source document, and the
                                API refuses them anyway. */}
                            {(e.reference_type === "MANUAL_JOURNAL" || !e.reference_type) && (
                              <IconAction
                                label={`Void ${e.voucher_number}`}
                                icon={<Trash2 />}
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setVoiding(e);
                                }}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                      {open && (
                        <tr className="border-b border-border/50 bg-muted/20">
                          <td />
                          <td colSpan={canVoid ? 6 : 5} className="px-2 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  <th className="py-1 text-left">Account</th>
                                  <th className="py-1 text-right">Debit</th>
                                  <th className="py-1 text-right">Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((l, i) => {
                                  const acc = accounts[l.account_id];
                                  return (
                                    <tr key={i} className="border-t border-border/40">
                                      <td className="py-1.5">
                                        <Link
                                          href={`/accounting/ledgers/${l.account_id}`}
                                          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
                                          onClick={(ev) => ev.stopPropagation()}
                                        >
                                          {acc ? `${acc.account_name} (${acc.account_code})` : l.account_id.slice(0, 8)}
                                          <ArrowRight className="h-3 w-3 opacity-50" />
                                        </Link>
                                      </td>
                                      <td className="py-1.5 text-right text-foreground">
                                        {Number(l.debit_amount) > 0 ? formatCurrency(Number(l.debit_amount), defaultCurrency) : "—"}
                                      </td>
                                      <td className="py-1.5 text-right text-foreground">
                                        {Number(l.credit_amount) > 0 ? formatCurrency(Number(l.credit_amount), defaultCurrency) : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Void confirmation — a soft delete: the voucher drops out of
          every balance and report but the rows stay for the audit
          trail. */}
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
            <span className="font-semibold text-foreground">{voiding?.voucher_number}</span>
            {voiding?.narration ? ` (“${voiding.narration.slice(0, 80)}”)` : ""}? It will
            disappear from every balance and report, but stays in the books marked as
            voided — nothing is erased.
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

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
