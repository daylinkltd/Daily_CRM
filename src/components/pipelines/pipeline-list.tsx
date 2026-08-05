"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";

import type { Deal, PipelineStage } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { useWorkspace } from "@/hooks/use-workspace";

type SortKey = "title" | "stage" | "value" | "close" | "contact";

/**
 * The same deals as the board, as a sortable table.
 *
 * The board is for moving a deal along; this is for the questions a board
 * cannot answer — what is the biggest open deal, what closes this month,
 * which deals have no contact attached. Sorting is client-side because the
 * page already holds every deal for the pipeline.
 */
export function PipelineList({
  stages,
  deals,
  onEditDeal,
}: {
  stages: PipelineStage[];
  deals: Deal[];
  onEditDeal: (deal: Deal) => void;
}) {
  const { defaultCurrency } = useWorkspace();
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [asc, setAsc] = useState(false);

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...deals].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "contact":
          return (
            dir *
            (a.contact?.name ?? "").localeCompare(b.contact?.name ?? "")
          );
        case "stage":
          return (
            dir *
            ((stageById.get(a.stage_id)?.position ?? 0) -
              (stageById.get(b.stage_id)?.position ?? 0))
          );
        case "close": {
          // Undated deals sort last in either direction: "no date" is not
          // earlier or later than a date, it is absent.
          if (!a.expected_close_date && !b.expected_close_date) return 0;
          if (!a.expected_close_date) return 1;
          if (!b.expected_close_date) return -1;
          return dir * a.expected_close_date.localeCompare(b.expected_close_date);
        }
        case "value":
        default:
          return dir * ((a.value ?? 0) - (b.value ?? 0));
      }
    });
  }, [deals, sortKey, asc, stageById]);

  const total = useMemo(
    () => deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
    [deals],
  );

  const header = (key: SortKey, text: string, className = "") => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setAsc((v) => !v);
          else {
            setSortKey(key);
            setAsc(false);
          }
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {text}
        <ArrowUpDown className={`size-3 ${sortKey === key ? "text-primary" : ""}`} />
      </button>
    </TableHead>
  );

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No deals in this pipeline yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {header("title", "Deal")}
            {header("contact", "Contact")}
            {header("stage", "Stage")}
            {header("close", "Expected close")}
            {header("value", "Value", "text-right")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((deal) => {
            const stage = stageById.get(deal.stage_id);
            return (
              <TableRow
                key={deal.id}
                onClick={() => onEditDeal(deal)}
                className="cursor-pointer border-border hover:bg-muted/50"
              >
                <TableCell className="font-medium text-foreground">{deal.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {deal.contact?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={
                      stage?.color
                        ? { borderColor: stage.color, color: stage.color }
                        : undefined
                    }
                  >
                    {stage?.name ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {deal.expected_close_date
                    ? new Date(deal.expected_close_date).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                  {formatCurrency(Number(deal.value) || 0, deal.currency || defaultCurrency)}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {deals.length} {deals.length === 1 ? "deal" : "deals"}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-bold text-foreground">
              {formatCurrency(total, defaultCurrency)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
