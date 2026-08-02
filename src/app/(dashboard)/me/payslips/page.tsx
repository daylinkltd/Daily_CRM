"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";

const money = (v: unknown) =>
  v == null ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(v));

/** The employee's own payslips. Reads only their own row. */
export default function MyPayslipsPage() {
  return (
    <MyRecordsList
      title="My Payslips"
      description="Your pay history. Only your own payslips are visible here."
      table="payslips"
      columns="id, net_payable, total_earnings, total_deductions, generated_at"
      orderBy="generated_at"
      emptyMessage="Payslips appear here once payroll has been processed."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {new Date(String(r.generated_at)).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              Earnings {money(r.total_earnings)} · Deductions {money(r.total_deductions)}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm font-semibold">{money(r.net_payable)}</p>
        </div>
      )}
    />
  );
}
