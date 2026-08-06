"use client";

import Link from "next/link";

/**
 * Ledgers — the chart of accounts manager (daylink-style): every
 * ledger with its type, group and live balance, filterable, with
 * create/edit. Balances come from the trial-balance report (derived
 * from journal lines — never stored on the account row).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Search, Loader2, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

const TYPE_CLASSES: Record<string, string> = {
  ASSET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  LIABILITY: "bg-red-500/10 text-red-400 border-red-500/20",
  EQUITY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  REVENUE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EXPENSE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

interface Ledger {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  ledger_group: string | null;
  opening_balance: number | null;
  is_system: boolean | null;
}

interface TrialRow {
  account: { id: string };
  closingDebit: number;
  closingCredit: number;
}

interface EditState {
  id?: string;
  account_code: string;
  account_name: string;
  account_type: string;
  ledger_group: string;
  opening_balance: string;
}

const BLANK: EditState = {
  account_code: "",
  account_name: "",
  account_type: "ASSET",
  ledger_group: "",
  opening_balance: "0",
};

export default function LedgersPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [{ data: accounts, error }, res] = await Promise.all([
        supabase
          .from("commerce_chart_of_accounts")
          .select("id, account_code, account_name, account_type, ledger_group, opening_balance, is_system")
          .eq("workspace_id", workspaceId)
          .order("account_code"),
        fetch(`/api/accounting/reports?workspace_id=${workspaceId}&type=trial_balance`),
      ]);
      if (error) throw error;
      setLedgers((accounts as Ledger[]) || []);
      if (res.ok) {
        const json = await res.json();
        const map = new Map<string, number>();
        for (const row of (json.report?.rows ?? []) as TrialRow[]) {
          map.set(row.account.id, row.closingDebit - row.closingCredit);
        }
        setBalances(map);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledgers");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const groups = useMemo(
    () => [...new Set(ledgers.map((l) => l.ledger_group).filter(Boolean))] as string[],
    [ledgers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledgers.filter((l) => {
      if (typeFilter !== "all" && l.account_type !== typeFilter) return false;
      if (groupFilter !== "all" && (l.ledger_group ?? "") !== groupFilter) return false;
      if (!q) return true;
      return [l.account_code, l.account_name, l.ledger_group]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [ledgers, search, typeFilter, groupFilter]);

  async function handleSave() {
    if (!workspaceId || !edit) return;
    if (!edit.account_code.trim() || !edit.account_name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        account_code: edit.account_code.trim(),
        account_name: edit.account_name.trim(),
        account_type: edit.account_type,
        ledger_group: edit.ledger_group.trim() || null,
        opening_balance: Number(edit.opening_balance) || 0,
      };
      if (edit.id) {
        const { error } = await supabase
          .from("commerce_chart_of_accounts")
          .update(payload)
          .eq("id", edit.id)
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        toast.success("Ledger updated");
      } else {
        const { error } = await supabase
          .from("commerce_chart_of_accounts")
          .insert({ ...payload, workspace_id: workspaceId, is_system: false });
        if (error) throw error;
        toast.success("Ledger created");
      }
      setEdit(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ledger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Ledgers"
        description="Manage the chart of accounts. Balances derive from journal entries and update live."
        actions={
          <IconAction label="Add Ledger" icon={<Plus />} onClick={() => setEdit({ ...BLANK })} />
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, name or group..."
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger className="sm:w-44">
                {/* Explicit renderer: item labels only register once the
                    popup opens, so the trigger would show the raw value. */}
                <SelectValue>
                  {(v: string) =>
                    v === "all" || !v ? "All Types" : v.charAt(0) + v.slice(1).toLowerCase()
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(v) => v && setGroupFilter(v)}>
              <SelectTrigger className="sm:w-52">
                <SelectValue>
                  {(v: string) => (v === "all" || !v ? "All Groups" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent searchPlaceholder="Search groups...">
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={ledgers.length === 0 ? "No ledgers yet" : "No matches"}
              description={
                ledgers.length === 0
                  ? "Default accounts are seeded on first posting, or add one manually."
                  : "No ledger matches your filters."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const bal = balances.get(l.id) ?? Number(l.opening_balance ?? 0);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.account_code}</TableCell>
                      <TableCell>
                        <span className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${TYPE_CLASSES[l.account_type] ?? ""}`}>
                          {l.account_type.charAt(0) + l.account_type.slice(1).toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.ledger_group || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {/* The whole reason ledgers exist is to be opened:
                            the name goes to the statement. */}
                        <Link
                          href={`/accounting/ledgers/${l.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {l.account_name}
                        </Link>
                        {l.is_system && (
                          <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">system</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right ${bal < 0 ? "text-red-400" : ""}`}>
                        {formatCurrency(Math.abs(bal), defaultCurrency, { decimals: 2 })}
                        <span className="ml-1 text-xs text-muted-foreground">{bal < 0 ? "Cr" : "Dr"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <IconAction
                          label={`Edit ${l.account_name}`}
                          icon={<Pencil />}
                          variant="ghost"
                          onClick={() =>
                            setEdit({
                              id: l.id,
                              account_code: l.account_code,
                              account_name: l.account_name,
                              account_type: l.account_type,
                              ledger_group: l.ledger_group ?? "",
                              opening_balance: String(l.opening_balance ?? 0),
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit Ledger" : "Add Ledger"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Code</label>
                  <Input
                    value={edit.account_code}
                    onChange={(e) => setEdit({ ...edit, account_code: e.target.value })}
                    placeholder="e.g. 6020"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select
                    value={edit.account_type}
                    onValueChange={(v) => v && setEdit({ ...edit, account_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent searchable={false}>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={edit.account_name}
                  onChange={(e) => setEdit({ ...edit, account_name: e.target.value })}
                  placeholder="e.g. Office Rent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Group (optional)</label>
                  <Input
                    value={edit.ledger_group}
                    onChange={(e) => setEdit({ ...edit, ledger_group: e.target.value })}
                    placeholder="e.g. Fixed Assets"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Opening balance</label>
                  <Input
                    type="number"
                    value={edit.opening_balance}
                    onChange={(e) => setEdit({ ...edit, opening_balance: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <IconAction label="Save" icon={saving ? <Loader2 className="animate-spin" /> : <Plus />} onClick={handleSave} disabled={saving} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
