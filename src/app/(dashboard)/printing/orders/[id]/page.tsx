"use client";

/**
 * Printing job detail — the flow chart as a working page.
 *
 * The status strip across the top IS the bulk-client flow: Enquiry →
 * Quoted → Approved → Production (Design → Print → Finishing) →
 * Completed → Invoiced → Delivered. Each stage exposes exactly the
 * actions the chart gives it: quote it, record the customer's approval,
 * take an advance, walk the production stages, generate the invoice
 * (into the existing `invoices` chain — payments and accounting posting
 * live there), and close the job on delivery.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  IndianRupee,
  Loader2,
  Printer,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import {
  STATUS_FLOW,
  STATUS_META,
  STAGE_LABELS,
  attributeSummary,
  isCancellable,
  nextStage,
  type OrderStatus,
  type ProductionStage,
} from "@/lib/printing/orders";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  order_no: string;
  contact_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  production_stage: ProductionStage | null;
  order_date: string;
  delivery_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  advance_paid: number;
  invoice_id: string | null;
  notes: string | null;
  contact: { id: string; name: string; company: string | null } | null;
}

interface Item {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  rate: number;
  amount: number;
  size: string | null;
  paper_type: string | null;
  gsm: string | null;
  print_type: string | null;
  color_mode: string | null;
  finishing: string | null;
  special_instructions: string | null;
  position: number;
}

export default function PrintingOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId || !id) return;
    setLoading(true);
    try {
      const [{ data: o }, { data: lines }] = await Promise.all([
        supabase
          .from("printing_orders")
          .select("*, contact:contacts(id, name, company)")
          .eq("workspace_id", workspaceId)
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("printing_order_items")
          .select("*")
          .eq("order_id", id)
          .order("position"),
      ]);
      setOrder((o as unknown as Order) ?? null);
      setItems((lines as Item[]) || []);
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** One narrow update helper; every action funnels through it. */
  async function update(patch: Record<string, unknown>, success: string) {
    if (!workspaceId || !order) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("printing_orders")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", order.id);
      if (error) throw error;
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordAdvance() {
    const amt = Number(advanceAmount);
    if (!order || !(amt > 0)) {
      toast.error("Enter a positive amount");
      return;
    }
    const total = Number(order.advance_paid) + amt;
    if (total > Number(order.grand_total)) {
      toast.error("That would exceed the job total — record the excess separately.");
      return;
    }
    setAdvanceOpen(false);
    setAdvanceAmount("");
    await update({ advance_paid: total }, `Advance of ${formatCurrency(amt, defaultCurrency)} recorded`);
  }

  async function generateInvoice() {
    if (!workspaceId || !order) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          source: "printing",
          contact_id: order.contact_id,
          tax_rate: Number(order.tax_rate) || 0,
          items: items.map((it) => ({
            description: [it.description, attributeSummary(it)].filter(Boolean).join(" — "),
            quantity: Number(it.quantity),
            unit_price: Number(it.rate),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate the invoice");
      const { error } = await supabase
        .from("printing_orders")
        .update({ invoice_id: json.invoice.id, status: "INVOICED", updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", order.id);
      if (error) throw error;
      toast.success(`Invoice ${json.invoice.invoice_number} created — record payments there`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate the invoice");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Job not found in this workspace.
        <div className="mt-4">
          <Link href="/printing" className="text-primary hover:underline">Back to job orders</Link>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[order.status];
  const balance = Math.max(0, Number(order.grand_total) - Number(order.advance_paid));
  const flowIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="space-y-6 p-(--page-padding-desktop)">
      <div className="flex items-start gap-3">
        <Link
          href="/printing"
          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Back to job orders"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          title={order.order_no}
          description={`${order.contact?.name || order.customer_name || "Walk-in"}${order.customer_phone ? ` · ${order.customer_phone}` : ""} · ordered ${order.order_date}${order.delivery_date ? ` · deliver by ${order.delivery_date}` : ""}`}
        />
        <span className={`ml-auto inline-flex h-7 items-center gap-1 border px-2.5 text-xs font-medium ${meta.className}`}>
          {meta.label}
          {order.status === "IN_PRODUCTION" && order.production_stage && (
            <span className="opacity-70">· {STAGE_LABELS[order.production_stage]}</span>
          )}
        </span>
      </div>

      {/* The flow, as a strip. Cancelled jobs show the badge above instead. */}
      {order.status !== "CANCELLED" && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {STATUS_FLOW.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground/50" />}
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  i < flowIndex
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : i === flowIndex
                      ? STATUS_META[s].className
                      : "border-border text-muted-foreground/60"
                }`}
              >
                {i < flowIndex && <Check className="mr-0.5 inline size-3" />}
                {STATUS_META[s].label}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Items */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-2 py-3 text-right">Qty</th>
                  <th className="px-2 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const attrs = attributeSummary(it);
                  return (
                    <tr key={it.id} className="border-b border-border/50 align-top">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{it.description}</span>
                        {attrs && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{attrs}</span>
                        )}
                        {it.special_instructions && (
                          <span className="mt-0.5 block text-xs italic text-amber-400/80">
                            {it.special_instructions}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-muted-foreground">
                        {Number(it.quantity).toLocaleString()} {it.unit ?? ""}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-muted-foreground">
                        {formatCurrency(Number(it.rate), defaultCurrency, { decimals: 2 })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(Number(it.amount), defaultCurrency, { decimals: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="px-4 py-2 text-right text-foreground">{formatCurrency(Number(order.subtotal), defaultCurrency, { decimals: 2 })}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground">GST ({Number(order.tax_rate)}%)</td>
                  <td className="px-4 py-1 text-right text-foreground">{formatCurrency(Number(order.tax_amount), defaultCurrency, { decimals: 2 })}</td>
                </tr>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={3} className="px-4 py-2 text-right text-foreground">Total</td>
                  <td className="px-4 py-2 text-right text-foreground">{formatCurrency(Number(order.grand_total), defaultCurrency, { decimals: 2 })}</td>
                </tr>
              </tfoot>
            </table>
            {order.notes && (
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{order.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Money + the stage's actions */}
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Advance received</span>
                <span className="text-emerald-400">{formatCurrency(Number(order.advance_paid), defaultCurrency, { decimals: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground">
                <span>Balance due</span>
                <span className={balance > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {formatCurrency(balance, defaultCurrency, { decimals: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {order.status === "ENQUIRY" && (
                <Button className="w-full" disabled={busy} onClick={() => update({ status: "QUOTED" }, "Marked as quoted — share it with the customer")}>
                  <FileText className="mr-1.5 size-3.5" /> Mark as quoted
                </Button>
              )}
              {order.status === "QUOTED" && (
                <Button className="w-full" disabled={busy} onClick={() => update({ status: "APPROVED" }, "Customer approval recorded")}>
                  <Check className="mr-1.5 size-3.5" /> Customer approved
                </Button>
              )}
              {(order.status === "APPROVED" || order.status === "IN_PRODUCTION" || order.status === "COMPLETED") && balance > 0 && (
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => setAdvanceOpen(true)}>
                  <IndianRupee className="mr-1.5 size-3.5" /> Record advance payment
                </Button>
              )}
              {order.status === "APPROVED" && (
                <Button className="w-full" disabled={busy} onClick={() => update({ status: "IN_PRODUCTION", production_stage: "DESIGN" }, "Job moved into production — Design")}>
                  <Printer className="mr-1.5 size-3.5" /> Start production
                </Button>
              )}
              {order.status === "IN_PRODUCTION" && (
                <>
                  {nextStage(order.production_stage) ? (
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() => {
                        const stage = nextStage(order.production_stage)!;
                        void update({ production_stage: stage }, `Production moved to ${STAGE_LABELS[stage]}`);
                      }}
                    >
                      <ChevronRight className="mr-1.5 size-3.5" />
                      Move to {STAGE_LABELS[nextStage(order.production_stage)!]}
                    </Button>
                  ) : null}
                  <Button
                    variant={nextStage(order.production_stage) ? "outline" : "default"}
                    className="w-full"
                    disabled={busy}
                    onClick={() => update({ status: "COMPLETED", production_stage: null }, "Job marked completed")}
                  >
                    <Check className="mr-1.5 size-3.5" /> Mark completed
                  </Button>
                </>
              )}
              {order.status === "COMPLETED" && (
                <Button className="w-full" disabled={busy} onClick={generateInvoice}>
                  <FileText className="mr-1.5 size-3.5" /> Generate invoice
                </Button>
              )}
              {order.status === "INVOICED" && (
                <>
                  <Link href="/invoices" className="block">
                    <Button variant="outline" className="w-full">
                      <FileText className="mr-1.5 size-3.5" /> Open invoices — record payment
                    </Button>
                  </Link>
                  <Button className="w-full" disabled={busy} onClick={() => update({ status: "DELIVERED" }, "Delivered — job closed")}>
                    <Check className="mr-1.5 size-3.5" /> Mark delivered & close
                  </Button>
                </>
              )}
              {isCancellable(order.status) && (
                <Button
                  variant="outline"
                  className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10"
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="mr-1.5 size-3.5" /> Cancel job
                </Button>
              )}
              {order.status === "DELIVERED" && (
                <p className="text-center text-xs text-muted-foreground">
                  Job delivered and closed. 🎉
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advance payment */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record advance payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="number"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              placeholder={`Up to ${formatCurrency(balance, defaultCurrency, { decimals: 2 })}`}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Recorded against the job. The tax invoice and its payments are generated when
              the job completes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={recordAdvance} disabled={busy}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this job?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {order.order_no} will be marked cancelled. Jobs already in production can&apos;t be
            cancelled from here.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep job</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={async () => {
                setCancelOpen(false);
                await update({ status: "CANCELLED", production_stage: null }, "Job cancelled");
              }}
            >
              Cancel job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
