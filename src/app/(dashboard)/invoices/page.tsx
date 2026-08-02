"use client";

/**
 * Unified invoices — CRM, project and retail invoices in one list,
 * backed by the `invoices` table from migration 075 (replacing the
 * project-only `project_invoices`, whose creation UI was dead code).
 *
 * Lifecycle: draft → sent (posts to accounting) → partially_paid /
 * paid (each payment posts individually) — plus void for drafts.
 * Status and amount_paid are DB-derived from payment rows; this page
 * never writes either (the old page's client-side counter bump lost
 * concurrent payments).
 *
 * Until 075 is applied the table doesn't exist in production, so the
 * page detects the missing relation and shows a setup notice instead
 * of crashing (same guard as /commercials).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Receipt, Plus, Search, Send, Banknote, Database, Loader2, Trash2, X,
} from "lucide-react";

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

const STATUS_META: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-muted/10 text-muted-foreground border-border/20" },
  sent: { label: "Sent", classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  partially_paid: { label: "Partially Paid", classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  paid: { label: "Paid", classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  overdue: { label: "Overdue", classes: "bg-red-500/10 text-red-400 border-red-500/20" },
  void: { label: "Void", classes: "bg-muted/10 text-muted-foreground border-border/20 line-through" },
};

interface InvoiceRow {
  id: string;
  invoice_number: string;
  source: string;
  status: string;
  currency: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  quotation_id: string | null;
  contact?: { id: string; name: string | null; company: string | null } | null;
  project?: { id: string; name: string | null } | null;
}

interface ContactOption { id: string; name: string | null; company: string | null }
interface DraftItem { description: string; quantity: string; unit_price: string }

function isMissingTableError(err: { code?: string; message?: string }): boolean {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /could not find the table|relation .* does not exist/i.test(err?.message ?? "")
  );
}

export default function InvoicesPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [newContactId, setNewContactId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("0");
  const [newDiscount, setNewDiscount] = useState("0");
  const [newItems, setNewItems] = useState<DraftItem[]>([
    { description: "", quantity: "1", unit_price: "0" },
  ]);

  // Payment dialog
  const [payFor, setPayFor] = useState<InvoiceRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`id, invoice_number, source, status, currency, issue_date, due_date,
                 total_amount, amount_paid, quotation_id,
                 contact:contacts(id, name, company),
                 project:projects(id, name)`)
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (isMissingTableError(error)) {
          setTableMissing(true);
          return;
        }
        throw error;
      }
      setTableMissing(false);
      setRows((data as unknown as InvoiceRow[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  // Contacts load lazily when the create dialog first opens.
  useEffect(() => {
    if (!createOpen || !workspaceId || contacts.length > 0) return;
    void supabase
      .from("contacts")
      .select("id, name, company")
      .eq("workspace_id", workspaceId)
      .order("name")
      .limit(500)
      .then(({ data }) => setContacts((data as ContactOption[]) || []));
  }, [createOpen, workspaceId, contacts.length, supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.invoice_number, r.contact?.name, r.contact?.company, r.project?.name]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const outstanding = useMemo(
    () =>
      rows
        .filter((r) => ["sent", "partially_paid", "overdue"].includes(r.status))
        .reduce((acc, r) => acc + (Number(r.total_amount) - Number(r.amount_paid)), 0),
    [rows]
  );

  const draftTotal = useMemo(
    () =>
      newItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [newItems]
  );

  async function handleCreate() {
    if (!workspaceId) return;
    const items = newItems
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      }))
      .filter((it) => it.description);
    if (items.length === 0) {
      toast.error("Add at least one line item with a description");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          contact_id: newContactId || null,
          due_date: newDueDate || null,
          tax_rate: Number(newTaxRate) || 0,
          discount_amount: Number(newDiscount) || 0,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create invoice");
      toast.success(`Invoice ${json.invoice.invoice_number} created`);
      setCreateOpen(false);
      setNewContactId("");
      setNewDueDate("");
      setNewTaxRate("0");
      setNewDiscount("0");
      setNewItems([{ description: "", quantity: "1", unit_price: "0" }]);
      await fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(inv: InvoiceRow) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send invoice");
      toast.success(`${inv.invoice_number} sent and posted to accounting`);
      await fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setBusyId(null);
    }
  }

  async function handleVoid(inv: InvoiceRow) {
    setBusyId(inv.id);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", inv.id)
        .eq("status", "draft"); // only drafts are voidable client-side
      if (error) throw error;
      toast.success(`${inv.invoice_number} voided`);
      await fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void invoice");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecordPayment() {
    if (!payFor) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${payFor.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payAmount),
          mode: payMode,
          reference_number: payRef || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      toast.success("Payment recorded and posted to accounting");
      setPayFor(null);
      setPayAmount("");
      setPayRef("");
      await fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Invoices"
        description="Bill customers and track payments — every sent invoice and recorded payment posts to accounting automatically."
        badge={
          outstanding > 0 ? (
            <span className="inline-flex h-6 items-center border border-yellow-500/20 bg-yellow-500/10 px-2 text-xs font-medium text-yellow-400">
              {formatCurrency(outstanding, defaultCurrency, { decimals: 2 })} outstanding
            </span>
          ) : undefined
        }
        actions={
          <IconAction label="New Invoice" icon={<Plus />} onClick={() => setCreateOpen(true)} disabled={tableMissing} />
        }
      />

      {tableMissing ? (
        <EmptyState
          icon={Database}
          title="Invoices table not set up yet"
          description="Migration 075 hasn't been applied to this database. Once it's run, invoices created here replace the old project-only invoices."
        />
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by number, customer or project..."
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="sm:w-56">
                  {/* Item labels only register on first open; render the
                      label for the current value explicitly. */}
                  <SelectValue>
                    {(v: string) =>
                      v === "all" || !v ? "All Statuses" : STATUS_META[v]?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
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
                icon={Receipt}
                title={rows.length === 0 ? "No invoices yet" : "No matches"}
                description={
                  rows.length === 0
                    ? "Create an invoice here, or generate one from an accepted quotation."
                    : "No invoice matches your search or status filter."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const meta = STATUS_META[inv.status] ?? STATUS_META.draft;
                    const busy = busyId === inv.id;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.invoice_number}
                          {inv.quotation_id && (
                            <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">from quote</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.contact?.company || inv.contact?.name || inv.project?.name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.issue_date}</TableCell>
                        <TableCell className="text-muted-foreground">{inv.due_date || "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(inv.total_amount), inv.currency, { decimals: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(Number(inv.amount_paid), inv.currency, { decimals: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "draft" && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleSend(inv)}>
                                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Send
                                </Button>
                                <IconAction
                                  label="Void invoice"
                                  icon={<X />}
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleVoid(inv)}
                                />
                              </>
                            )}
                            {["sent", "partially_paid", "overdue"].includes(inv.status) && (
                              <IconAction label="Record Payment" icon={<Banknote />} variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setPayFor(inv);
                                  setPayAmount(
                                    (Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2)
                                  );
                                }} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── create dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Customer</label>
                <Select value={newContactId} onValueChange={(v) => v && setNewContactId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent searchPlaceholder="Search customers...">
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company ? `${c.name ?? "—"} (${c.company})` : c.name ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Due date</label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tax rate %</label>
                <Input type="number" min="0" max="100" value={newTaxRate} onChange={(e) => setNewTaxRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Discount amount</label>
                <Input type="number" min="0" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Line items</label>
              {newItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) =>
                      setNewItems((prev) => prev.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)))
                    }
                  />
                  <Input
                    className="w-20"
                    type="number" min="0" placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) =>
                      setNewItems((prev) => prev.map((p, j) => (j === i ? { ...p, quantity: e.target.value } : p)))
                    }
                  />
                  <Input
                    className="w-28"
                    type="number" min="0" placeholder="Unit price"
                    value={it.unit_price}
                    onChange={(e) =>
                      setNewItems((prev) => prev.map((p, j) => (j === i ? { ...p, unit_price: e.target.value } : p)))
                    }
                  />
                  <IconAction
                    label="Remove line"
                    icon={<Trash2 />}
                    variant="ghost"
                    disabled={newItems.length === 1}
                    onClick={() => setNewItems((prev) => prev.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <IconAction label="Add line" icon={<Plus />} variant="outline"
                onClick={() => setNewItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "0" }])} />
            </div>

            <p className="text-right text-sm text-muted-foreground">
              Subtotal: <span className="font-medium text-foreground">{formatCurrency(draftTotal, defaultCurrency, { decimals: 2 })}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />} Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── payment dialog ────────────────────────────────── */}
      <Dialog open={!!payFor} onOpenChange={(open) => !open && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {payFor?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Outstanding:{" "}
              <span className="font-medium text-foreground">
                {payFor &&
                  formatCurrency(Number(payFor.total_amount) - Number(payFor.amount_paid), payFor.currency, { decimals: 2 })}
              </span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount</label>
              <Input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mode</label>
              <Select value={payMode} onValueChange={(v) => v && setPayMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Reference / UTR (optional)</label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={paying || !payAmount}>
              {paying ? <Loader2 className="animate-spin" /> : <Banknote />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
