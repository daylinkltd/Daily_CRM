"use client";

/**
 * Balance Sheet — Assets against Equity + Liabilities as on the
 * period end. "Reserves & Surplus" is the automatic plug from the
 * P&L: cumulative net profit computed from the books, no year-end
 * closing entry needed. Assets = Liabilities + Equity + R&S, and the
 * header badge proves it on every load.
 */

import { Landmark } from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BalancedBadge, PeriodBar, ReportLoading, useFinancialReport,
} from "@/components/accounting/report-shell";

interface BsSection {
  rows: { account: { id: string; account_code: string; account_name: string }; balance: number }[];
  total: number;
}

interface BsReport {
  assets: BsSection;
  liabilities: BsSection;
  equity: BsSection;
  reservesAndSurplus: number;
  isBalanced: boolean;
  difference: number;
}

export default function BalanceSheetPage() {
  const { report, loading, start, end, setPeriod, defaultCurrency } =
    useFinancialReport<BsReport>("balance_sheet");
  const fmt = (v: number) => formatCurrency(v, defaultCurrency, { decimals: 2 });

  const empty =
    report &&
    report.assets.rows.length === 0 &&
    report.liabilities.rows.length === 0 &&
    report.equity.rows.length === 0 &&
    report.reservesAndSurplus === 0;

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Balance Sheet"
        description="As on the period end. Reserves & Surplus carries the P&L automatically — no closing entries."
        badge={
          report ? (
            <BalancedBadge
              balanced={report.isBalanced}
              label={report.isBalanced ? "Balanced" : `Off by ${fmt(Math.abs(report.difference))}`}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <PeriodBar start={start} end={end} onChange={setPeriod} />

          {loading || !report ? (
            <ReportLoading />
          ) : empty ? (
            <EmptyState
              icon={Landmark}
              title="Nothing to report"
              description="No balance-sheet activity in the books yet."
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* ── assets ── */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assets</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.assets.rows.map((r) => (
                    <TableRow key={r.account.id}>
                      <TableCell>
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{r.account.account_code}</span>
                        {r.account.account_name}
                      </TableCell>
                      <TableCell className="text-right">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total Assets</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(report.assets.total)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              {/* ── equity + liabilities ── */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equity & Liabilities</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.equity.rows.map((r) => (
                    <TableRow key={r.account.id}>
                      <TableCell>
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{r.account.account_code}</span>
                        {r.account.account_name}
                      </TableCell>
                      <TableCell className="text-right">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      Reserves &amp; Surplus
                      <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">auto from P&amp;L</span>
                    </TableCell>
                    <TableCell className={`text-right ${report.reservesAndSurplus < 0 ? "text-red-400" : ""}`}>
                      {fmt(report.reservesAndSurplus)}
                    </TableCell>
                  </TableRow>
                  {report.liabilities.rows.map((r) => (
                    <TableRow key={r.account.id}>
                      <TableCell>
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{r.account.account_code}</span>
                        {r.account.account_name}
                      </TableCell>
                      <TableCell className="text-right">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total Equity &amp; Liabilities</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(report.equity.total + report.liabilities.total + report.reservesAndSurplus)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
