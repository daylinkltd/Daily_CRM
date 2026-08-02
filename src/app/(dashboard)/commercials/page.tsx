"use client";

/**
 * Commercials — the internal costing/terms stage of the CRM chain:
 *
 *   Contacts -> Pipelines -> COMMERCIALS -> Quotations -> Invoices
 *
 * Costs, margins and discounts are negotiated and approved here,
 * INTERNALLY; converting to a quotation copies selling prices only.
 *
 * Lifecycle: draft -> review -> approved | rejected -> converted.
 * Editing is allowed in draft/review; approval is admin-only; an
 * approved commercial converts into a draft quotation
 * (/api/commercials/[id]).
 *
 * The backing table ships in migration 075 — until it's applied the
 * page shows a setup notice instead of crashing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Handshake, Plus, Search, Database, Loader2, Pencil, Trash2,
  SendHorizonal, Check, X, FileText,
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

const COMMERCIAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted to Quotation" },
] as const;

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted/10 text-muted-foreground border-border/20",
  review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  converted: "bg-[#00aef0]/10 text-[#00aef0] border-[#00aef0]/20",
};

interface Commercial {
  id: string;
  reference: string | null;
  title: string | null;
  status: string;
  currency: string;
  total_cost: number;
  total_value: number;
  margin_percent: number | null;
  valid_until: string | null;
  payment_terms: string | null;
  notes: string | null;
  converted_quotation_id: string | null;
  updated_at: string;
  deal?: { id: string; title: string | null } | null;
  contact?: { id: string; name: string | null; company: string | null } | null;
}

interface ContactOption { id: string; name: string | null; company: string | null }
interface DealOption { id: string; title: string | null }

interface DraftItem {
  name: string;
  description: string;
  quantity: string;
  unit_cost: string;
  unit_price: string;
  discount_percent: string;
}

const BLANK_ITEM: DraftItem = {
  name: "", description: "", quantity: "1", unit_cost: "0", unit_price: "0", discount_percent: "0",
};

interface EditorState {
  id?: string;
  title: string;
  contact_id: string;
  deal_id: string;
  valid_until: string;
  payment_terms: string;
  items: DraftItem[];
}

const BLANK_EDITOR: EditorState = {
  title: "", contact_id: "", deal_id: "", valid_until: "", payment_terms: "",
  items: [{ ...BLANK_ITEM }],
};

function isMissingTableError(err: { code?: string; message?: string }): boolean {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /could not find the table|relation .* does not exist/i.test(err?.message ?? "")
  );
}

export default function CommercialsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, activeRole, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;
  const isAdmin = activeRole === "owner" || activeRole === "admin";

  const [rows, setRows] = useState<Commercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Editor
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);

  const fetchCommercials = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commercials")
        .select(
          `id, reference, title, status, currency, total_cost, total_value, margin_percent,
           valid_until, payment_terms, notes, converted_quotation_id, updated_at,
           deal:deals(id, title),
           contact:contacts(id, name, company)`,
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          setTableMissing(true);
          setRows([]);
          return;
        }
        throw error;
      }
      setTableMissing(false);
      setRows((data as unknown as Commercial[]) || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void fetchCommercials();
  }, [fetchCommercials]);

  // Pickers load lazily on first editor open.
  useEffect(() => {
    if (!editor || !workspaceId || contacts.length > 0) return;
    void (async () => {
      const [{ data: cs }, { data: ds }] = await Promise.all([
        supabase.from("contacts").select("id, name, company").eq("workspace_id", workspaceId).order("name").limit(500),
        supabase.from("deals").select("id, title").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200),
      ]);
      setContacts((cs as ContactOption[]) || []);
      setDeals((ds as DealOption[]) || []);
    })();
  }, [editor, workspaceId, contacts.length, supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.reference, r.title, r.deal?.title, r.contact?.name, r.contact?.company]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const editorTotals = useMemo(() => {
    if (!editor) return { cost: 0, value: 0, margin: 0 };
    let cost = 0;
    let value = 0;
    for (const it of editor.items) {
      const qty = Number(it.quantity) || 0;
      cost += qty * (Number(it.unit_cost) || 0);
      value += qty * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_percent) || 0) / 100);
    }
    return { cost, value, margin: value === 0 ? 0 : ((value - cost) / value) * 100 };
  }, [editor]);

  function setItem(i: number, patch: Partial<DraftItem>) {
    setEditor((prev) =>
      prev ? { ...prev, items: prev.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : prev
    );
  }

  async function openForEdit(c: Commercial) {
    const { data: items } = await supabase
      .from("commercial_line_items")
      .select("name, description, quantity, unit_cost, unit_price, discount_percent")
      .eq("commercial_id", c.id)
      .order("position");
    setEditor({
      id: c.id,
      title: c.title ?? "",
      contact_id: c.contact?.id ?? "",
      deal_id: c.deal?.id ?? "",
      valid_until: c.valid_until ?? "",
      payment_terms: c.payment_terms ?? "",
      items:
        (items ?? []).map((it) => ({
          name: it.name ?? "",
          description: it.description ?? "",
          quantity: String(it.quantity ?? 1),
          unit_cost: String(it.unit_cost ?? 0),
          unit_price: String(it.unit_price ?? 0),
          discount_percent: String(it.discount_percent ?? 0),
        })) || [{ ...BLANK_ITEM }],
    });
  }

  async function handleSave() {
    if (!workspaceId || !editor) return;
    const items = editor.items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        description: it.description.trim() || undefined,
        quantity: Number(it.quantity) || 0,
        unit_cost: Number(it.unit_cost) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount_percent: Number(it.discount_percent) || 0,
      }));
    if (items.length === 0) {
      toast.error("Add at least one line item with a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        title: editor.title || null,
        contact_id: editor.contact_id || null,
        deal_id: editor.deal_id || null,
        valid_until: editor.valid_until || null,
        payment_terms: editor.payment_terms || null,
        items,
      };
      const res = editor.id
        ? await fetch(`/api/commercials/${editor.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", ...payload }),
          })
        : await fetch("/api/commercials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save commercial");
      toast.success(editor.id ? "Commercial updated" : `Commercial ${json.commercial.reference} created`);
      setEditor(null);
      await fetchCommercials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save commercial");
    } finally {
      setSaving(false);
    }
  }

  async function act(c: Commercial, action: "submit" | "approve" | "reject" | "convert") {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/commercials/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${action}`);
      if (action === "convert") {
        toast.success("Quotation created from commercial");
        router.push(`/quotations/${json.quotation_id}/edit`);
        return;
      }
      toast.success(action === "submit" ? "Submitted for review" : `Commercial ${action}d`);
      await fetchCommercials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Commercials"
        description="Negotiate cost, discount and margin internally, then approve to generate a quotation. Costs never appear on customer documents."
        actions={
          <Button disabled={tableMissing} onClick={() => setEditor({ ...BLANK_EDITOR, items: [{ ...BLANK_ITEM }] })}>
            <Plus /> New Commercial
          </Button>
        }
      />

      {tableMissing ? (
        <EmptyState
          icon={Database}
          title="Commercials table not set up yet"
          description="The commercials schema migration hasn't been applied to this database. Once it's run, this page will list every commercial in the workspace."
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
                  placeholder="Search by reference, deal or customer..."
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue>
                    {(v: string) =>
                      v === "all" || !v
                        ? "All Statuses"
                        : COMMERCIAL_STATUSES.find((s) => s.value === v)?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent searchPlaceholder="Search statuses...">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {COMMERCIAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
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
                icon={Handshake}
                title={rows.length === 0 ? "No commercials yet" : "No matches"}
                description={
                  rows.length === 0
                    ? "Create a commercial to start negotiating pricing and terms."
                    : "No commercial matches your search or status filter."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const busy = busyId === r.id;
                    const margin = Number(r.margin_percent ?? 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.reference || "—"}
                          {r.title && (
                            <p className="mt-0.5 text-xs font-normal text-muted-foreground">{r.title}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.deal?.title || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.contact?.company || r.contact?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(Number(r.total_cost ?? 0), r.currency || defaultCurrency, { decimals: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(r.total_value ?? 0), r.currency || defaultCurrency, { decimals: 2 })}
                        </TableCell>
                        <TableCell className={`text-right ${margin < 0 ? "text-red-400" : margin < 15 ? "text-yellow-400" : "text-emerald-400"}`}>
                          {margin.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${
                              STATUS_CLASSES[r.status] ?? STATUS_CLASSES.draft
                            }`}
                          >
                            {COMMERCIAL_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {["draft", "review"].includes(r.status) && (
                              <IconAction
                                label="Edit"
                                icon={<Pencil />}
                                variant="ghost"
                                disabled={busy}
                                onClick={() => openForEdit(r)}
                              />
                            )}
                            {r.status === "draft" && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r, "submit")}>
                                <SendHorizonal /> Submit
                              </Button>
                            )}
                            {r.status === "review" && isAdmin && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r, "approve")}>
                                  <Check /> Approve
                                </Button>
                                <IconAction
                                  label="Reject"
                                  icon={<X />}
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => act(r, "reject")}
                                />
                              </>
                            )}
                            {r.status === "approved" && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r, "convert")}>
                                {busy ? <Loader2 className="animate-spin" /> : <FileText />} To Quotation
                              </Button>
                            )}
                            {r.status === "converted" && r.converted_quotation_id && (
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => router.push(`/quotations/${r.converted_quotation_id}/preview`)}
                              >
                                <FileText /> View Quote
                              </Button>
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

      {/* ── editor dialog ─────────────────────────────────── */}
      <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Edit Commercial" : "New Commercial"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                    placeholder="e.g. Acme retainer proposal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Valid until</label>
                  <Input
                    type="date"
                    value={editor.valid_until}
                    onChange={(e) => setEditor({ ...editor, valid_until: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Customer</label>
                  <Select value={editor.contact_id} onValueChange={(v) => v && setEditor({ ...editor, contact_id: v })}>
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
                  <label className="text-xs font-medium text-muted-foreground">Deal</label>
                  <Select value={editor.deal_id} onValueChange={(v) => v && setEditor({ ...editor, deal_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link a deal (optional)" />
                    </SelectTrigger>
                    <SelectContent searchPlaceholder="Search deals...">
                      {deals.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.title ?? "—"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_4rem_6rem_6rem_5rem_2.5rem] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit cost</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Disc %</span>
                  <span />
                </div>
                {editor.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_4rem_6rem_6rem_5rem_2.5rem] items-center gap-2">
                    <Input
                      placeholder="Item name"
                      value={it.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                    />
                    <Input className="text-right" type="number" min="0" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                    <Input className="text-right" type="number" min="0" value={it.unit_cost} onChange={(e) => setItem(i, { unit_cost: e.target.value })} />
                    <Input className="text-right" type="number" min="0" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: e.target.value })} />
                    <Input className="text-right" type="number" min="0" max="100" value={it.discount_percent} onChange={(e) => setItem(i, { discount_percent: e.target.value })} />
                    <IconAction
                      label="Remove line"
                      icon={<Trash2 />}
                      variant="ghost"
                      disabled={editor.items.length === 1}
                      onClick={() =>
                        setEditor((prev) =>
                          prev ? { ...prev, items: prev.items.filter((_, j) => j !== i) } : prev
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  size="sm" variant="outline"
                  onClick={() =>
                    setEditor((prev) => (prev ? { ...prev, items: [...prev.items, { ...BLANK_ITEM }] } : prev))
                  }
                >
                  <Plus /> Add line
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Payment terms</label>
                <Input
                  value={editor.payment_terms}
                  onChange={(e) => setEditor({ ...editor, payment_terms: e.target.value })}
                  placeholder="e.g. 50% advance, 50% on delivery"
                />
              </div>

              <div className="flex items-center justify-end gap-4 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Cost <span className="font-medium text-foreground">{formatCurrency(editorTotals.cost, defaultCurrency, { decimals: 2 })}</span>
                </span>
                <span className="text-muted-foreground">
                  Value <span className="font-medium text-foreground">{formatCurrency(editorTotals.value, defaultCurrency, { decimals: 2 })}</span>
                </span>
                <span
                  className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${
                    editorTotals.margin < 0
                      ? "border-red-500/20 bg-red-500/10 text-red-400"
                      : editorTotals.margin < 15
                        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  Margin {editorTotals.margin.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} {editor?.id ? "Save Changes" : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
