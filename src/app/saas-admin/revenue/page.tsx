"use client";

import { IndianRupee, AlertTriangle } from "lucide-react";

import {
  Badge,
  ConsoleCard,
  LoadingRow,
  StatCard,
  useConsoleData,
} from "@/components/saas-admin/console-ui";

interface LedgerRow {
  id: number;
  workspace_id: string | null;
  workspace_name: string | null;
  user_email: string | null;
  plan_id: string;
  seats: number;
  billing_period: string;
  base_paise: number;
  gst_paise: number;
  total_paise: number;
  coupon_code: string | null;
  discount_paise: number;
  razorpay_payment_id: string;
  created_at: string;
}

interface HubPayment {
  id: string;
  order_id: string | null;
  amount: number;
  amount_refunded: number;
  status: string;
  method: string | null;
  email: string | null;
  created_at: number;
}

interface RevenueData {
  ledger: {
    totalPaise: number;
    monthPaise: number;
    gstPaise: number;
    count: number;
    rows: LedgerRow[];
  };
  gateway: {
    available: boolean;
    capturedPaise: number;
    refundedPaise: number;
    payments: HubPayment[];
    unmatched: HubPayment[];
  };
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function RevenuePage() {
  const { data, loading, error } = useConsoleData<RevenueData>("/api/saas-admin/revenue");

  if (loading && !data) return <LoadingRow label="Adding up the money…" />;
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-rose-400">{error ?? "Failed to load"}</p>;
  }

  const { ledger, gateway } = data;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-foreground flex items-center gap-2">
        <IndianRupee className="h-5 w-5 text-primary" /> Revenue
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected (all time)" value={inr(ledger.totalPaise)} tone="good"
          hint={`${ledger.count} payments, GST inclusive`} />
        <StatCard label="This month" value={inr(ledger.monthPaise)} />
        <StatCard label="GST collected" value={inr(ledger.gstPaise)}
          hint="Owed onward, not income" />
        <StatCard
          label="Razorpay (live)"
          value={gateway.available ? inr(gateway.capturedPaise) : "unavailable"}
          tone={gateway.available ? "default" : "warn"}
          hint={
            gateway.available
              ? gateway.refundedPaise > 0
                ? `${inr(gateway.refundedPaise)} refunded`
                : "last 100 captured payments"
              : "Payment hub unreachable"
          }
        />
      </div>

      {gateway.available && gateway.unmatched.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-200">
            <strong>{gateway.unmatched.length} captured payment{gateway.unmatched.length === 1 ? "" : "s"}</strong>{" "}
            exist in Razorpay with no matching row in the income ledger — payments made
            before the ledger existed, or verifications that never completed. Cross-check in
            the Razorpay dashboard:{" "}
            {gateway.unmatched.slice(0, 5).map((p) => (
              <code key={p.id} className="mr-2 text-xs">{p.id}</code>
            ))}
          </div>
        </div>
      )}

      <ConsoleCard title={`Income ledger (${ledger.count})`}>
        {ledger.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No payments recorded yet. Every payment verified from now on lands here
            automatically, with its tenant, seat count and GST split.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4">When</th>
                  <th className="pb-2.5 pr-4">Tenant</th>
                  <th className="pb-2.5 pr-4">What</th>
                  <th className="pb-2.5 pr-4 text-right">Base</th>
                  <th className="pb-2.5 pr-4 text-right">GST</th>
                  <th className="pb-2.5 pr-4 text-right">Total</th>
                  <th className="pb-2.5">Payment</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-foreground">{r.workspace_name ?? "—"}</span>
                      <span className="block text-[11px] text-muted-foreground">{r.user_email}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs text-foreground">
                        {r.plan_id} · {r.seats} seat{r.seats === 1 ? "" : "s"} · {r.billing_period}
                      </span>
                      {r.coupon_code && (
                        <span className="ml-1.5 inline-block">
                          <Badge tone="info">{r.coupon_code} −{inr(r.discount_paise)}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-xs text-muted-foreground">{inr(r.base_paise)}</td>
                    <td className="py-2.5 pr-4 text-right text-xs text-muted-foreground">{inr(r.gst_paise)}</td>
                    <td className="py-2.5 pr-4 text-right font-bold text-foreground">{inr(r.total_paise)}</td>
                    <td className="py-2.5">
                      <code className="text-[11px] text-muted-foreground">{r.razorpay_payment_id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ConsoleCard>

      {gateway.available && (
        <ConsoleCard title="Razorpay — last captured payments (ground truth)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4">When</th>
                  <th className="pb-2.5 pr-4">Payment</th>
                  <th className="pb-2.5 pr-4">Method</th>
                  <th className="pb-2.5 pr-4">Payer</th>
                  <th className="pb-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {gateway.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(p.created_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4"><code className="text-[11px] text-foreground">{p.id}</code></td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{p.method ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="py-2.5 text-right font-semibold text-foreground">
                      {inr(p.amount)}
                      {p.amount_refunded > 0 && (
                        <span className="block text-[11px] text-rose-400">−{inr(p.amount_refunded)} refunded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ConsoleCard>
      )}
    </div>
  );
}
