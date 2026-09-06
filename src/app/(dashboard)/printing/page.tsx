"use client";

/**
 * Printing Press — job orders list.
 *
 * The register a press owner scans every morning: every job with its
 * customer, where it sits in the flow (enquiry → quoted → approved →
 * production stage → completed → invoiced → delivered), what it's
 * worth and what's still owed. Everything else the flow chart shows —
 * customers, catalog, units, stock, purchases, suppliers, POS — already
 * lives in CRM/Retail; this module is only what's unique to a press.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Printer, Plus, Search, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import {
  ORDER_STATUSES,
  STATUS_META,
  STAGE_LABELS,
  type OrderStatus,
  type ProductionStage,
} from "@/lib/printing/orders";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconAction } from "@/components/ui/icon-action";

interface OrderRow {
  id: string;
  order_no: string;
  customer_name: string | null;
  status: OrderStatus;
  production_stage: ProductionStage | null;
  order_date: string;
  delivery_date: string | null;
  grand_total: number;
  advance_paid: number;
  contact: { id: string; name: string } | null;
}

export default function PrintingOrdersPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("printing_orders")
        .select(
          "id, order_no, customer_name, status, production_stage, order_date, delivery_date, grand_total, advance_paid, contact:contacts(id, name)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data as unknown as OrderRow[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load job orders");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.order_no, r.customer_name, r.contact?.name]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  // The numbers that matter at a glance: live jobs and money not yet in.
  const openJobs = rows.filter(
    (r) => !["DELIVERED", "CANCELLED"].includes(r.status),
  ).length;
  const outstanding = rows
    .filter((r) => !["CANCELLED"].includes(r.status))
    .reduce((s, r) => s + Math.max(0, Number(r.grand_total) - Number(r.advance_paid)), 0);

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Job Orders"
        description={`${openJobs} open job${openJobs === 1 ? "" : "s"} · ${formatCurrency(outstanding, defaultCurrency)} outstanding`}
        actions={
          <Link href="/printing/orders/new">
            <IconAction label="New Job / Enquiry" icon={<Plus />} />
          </Link>
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
                placeholder="Search by job number or customer..."
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue>
                  {(v: string) =>
                    v === "all" || !v ? "All statuses" : STATUS_META[v as OrderStatus]?.label ?? v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent searchable={false}>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
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
              icon={Printer}
              title={rows.length === 0 ? "No job orders yet" : "No matches"}
              description={
                rows.length === 0
                  ? "Every printing job starts as an enquiry — create the first one."
                  : "No job matches your filters."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  const balance = Math.max(0, Number(r.grand_total) - Number(r.advance_paid));
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/printing/orders/${r.id}`}
                          className="font-mono text-xs font-medium hover:text-primary hover:underline"
                        >
                          {r.order_no}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.order_date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.contact?.name || r.customer_name || "Walk-in"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex h-6 items-center gap-1 border px-2 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                          {r.status === "IN_PRODUCTION" && r.production_stage && (
                            <span className="opacity-70">· {STAGE_LABELS[r.production_stage]}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.delivery_date || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(r.grand_total), defaultCurrency, { decimals: 2 })}
                      </TableCell>
                      <TableCell className={`text-right ${balance > 0 && r.status !== "CANCELLED" ? "text-amber-400" : "text-muted-foreground"}`}>
                        {r.status === "CANCELLED"
                          ? "—"
                          : formatCurrency(balance, defaultCurrency, { decimals: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
