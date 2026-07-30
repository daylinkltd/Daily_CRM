"use client";

/** Trial Balance — every ledger's period activity and closing
 *  Dr/Cr balance, with grand totals that must agree. */

import { Scale } from "lucide-react";

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

interface TrialReport {
  rows: {
    account: { id: string; account_code: string; account_name: string; account_type: string };
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
  }[];
  totals: { periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number };
  isBalanced: boolean;
}

export default function TrialBalancePage() {
  const { report, loading, start, end, setPeriod, defaultCurrency } =
    useFinancialReport<TrialReport>("trial_balance");
  const fmt = (v: number) => (v === 0 ? "—" : formatCurrency(v, defaultCurrency, { decimals: 2 }));

  return (
    <div className="p-(--page-padding-desktop)">
      <PageHeader
        title="Trial Balance"
        description="Closing balances of every ledger, computed from journal entries."
        badge={report ? <BalancedBadge balanced={report.isBalanced} /> : undefined}
      />

      <Card>
        <CardContent className="space-y-4">
          <PeriodBar start={start} end={end} onChange={setPeriod} />

          {loading || !report ? (
            <ReportLoading />
          ) : report.rows.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="Nothing to report"
              description="No journal activity in the books yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead className="text-right">Period Debit</TableHead>
                  <TableHead className="text-right">Period Credit</TableHead>
                  <TableHead className="text-right">Closing Dr</TableHead>
                  <TableHead className="text-right">Closing Cr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell className="font-mono text-xs">{r.account.account_code}</TableCell>
                    <TableCell className="font-medium">{r.account.account_name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(r.periodDebit)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(r.periodCredit)}</TableCell>
                    <TableCell className="text-right">{fmt(r.closingDebit)}</TableCell>
                    <TableCell className="text-right">{fmt(r.closingCredit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(report.totals.periodDebit)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(report.totals.periodCredit)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(report.totals.closingDebit)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(report.totals.closingCredit)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
