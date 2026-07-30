"use client";

/**
 * Commercials — the internal costing/terms record that sits between a
 * pipeline deal and a customer-facing quotation:
 *
 *   Contacts -> Pipelines -> COMMERCIALS -> Quotations -> Invoices
 *
 * A commercial is where pricing is actually negotiated and approved
 * internally (cost, discount, margin, payment terms) before anything is
 * sent to the customer. Approving one is what unlocks generating the
 * quotation from it.
 *
 * The backing `commercials` table ships in its own migration. Until that
 * migration is applied this page renders a setup notice rather than
 * crashing — see `tableMissing` below.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Handshake, Plus, Search, Database, Loader2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Lifecycle of a commercial. `converted` = a quotation was generated. */
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

/**
 * Shape kept local rather than added to `@/types` until the migration
 * that defines the table has landed, so the shared types never describe
 * a table that doesn't exist.
 */
interface Commercial {
  id: string;
  reference: string | null;
  title: string | null;
  status: string;
  total_value: number | null;
  margin_percent: number | null;
  updated_at: string;
  deal?: { id: string; title: string | null } | null;
  contact?: { id: string; name: string | null; company: string | null } | null;
}

/** Postgres "relation does not exist" / PostgREST "table not in schema". */
function isMissingTableError(err: { code?: string; message?: string }): boolean {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /could not find the table|relation .* does not exist/i.test(err?.message ?? "")
  );
}

export default function CommercialsPage() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [rows, setRows] = useState<Commercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchCommercials = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commercials")
        .select(
          `id, reference, title, status, total_value, margin_percent, updated_at,
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.reference, r.title, r.deal?.title, r.contact?.name, r.contact?.company]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Commercials"
        description="Negotiate cost, discount and margin internally, then approve to generate a quotation."
        actions={
          <Button disabled={tableMissing}>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-56">
                  {/* Item labels only register on first open; render the
                      label for the current value explicitly. */}
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
                    ? "Create a commercial from a deal to start negotiating pricing and terms."
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
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.reference || r.title || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.deal?.title || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.contact?.company || r.contact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(r.total_value ?? 0), defaultCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.margin_percent == null ? "—" : `${r.margin_percent}%`}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${
                            STATUS_CLASSES[r.status] ?? STATUS_CLASSES.draft
                          }`}
                        >
                          {COMMERCIAL_STATUSES.find((s) => s.value === r.status)?.label ??
                            r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
