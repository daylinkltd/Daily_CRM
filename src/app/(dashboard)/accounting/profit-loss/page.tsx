"use client";

/** Profit & Loss — period revenue vs expenses. The net figure is
 *  what the Balance Sheet carries into Reserves & Surplus. */

import { TrendingUp } from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PeriodBar, ReportLoading, useFinancialReport,
} from "@/components/accounting/report-shell";

interface PnlReport {
  revenue: { account: { id: string; account_code: string; account_name: string }; amount: number }[];
  expenses: { account: { id: string; account_code: string; account_name: string }; amount: number }[];
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
}

function Section({
  title,
  rows,
  total,
  currency,
}: {
  title: string;
  rows: PnlReport["revenue"];
  total: number;
  currency: string;
}) {
  const fmt = (v: number) => formatCurrency(v, currency, { decimals: 2 });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{title}</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="text-muted-foreground">No activity this period</TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.account.id}>
              <TableCell>
                <span className="mr-2 font-mono text-xs text-muted-foreground">{r.account.account_code}</span>
                {r.account.account_name}
              </TableCell>
              <TableCell className="text-right">{fmt(r.amount)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total {title}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export default function ProfitLossPage() {
  const { report, loading, start, end, setPeriod, defaultCurrency } =
    useFinancialReport<PnlReport>("pnl");

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Profit & Loss"
        description="Revenue against expenses for the period. Net profit flows into Reserves & Surplus on the Balance Sheet."
        badge={
          report ? (
            <span
              className={`inline-flex h-6 items-center border px-2 text-xs font-medium ${
                report.netProfit >= 0
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {report.netProfit >= 0 ? "Net Profit " : "Net Loss "}
              {formatCurrency(Math.abs(report.netProfit), defaultCurrency, { decimals: 2 })}
            </span>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <PeriodBar start={start} end={end} onChange={setPeriod} />

          {loading || !report ? (
            <ReportLoading />
          ) : report.revenue.length === 0 && report.expenses.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nothing to report"
              description="No revenue or expense activity in this period."
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Section title="Revenue" rows={report.revenue} total={report.revenueTotal} currency={defaultCurrency} />
              <Section title="Expenses" rows={report.expenses} total={report.expenseTotal} currency={defaultCurrency} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
