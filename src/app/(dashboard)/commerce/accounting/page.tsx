"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  RefreshCw,
  Landmark,
  Banknote,
  ArrowUpRight,
  FileCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export default function AccountingLedgerPage() {
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"DAYBOOK" | "ACCOUNTS">("DAYBOOK");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    cash_in_hand: number;
    bank_accounts: number;
    customer_khata: number;
    total_sales_revenue: number;
  }>({
    cash_in_hand: 0,
    bank_accounts: 0,
    customer_khata: 0,
    total_sales_revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/commerce/accounting?workspace_id=${activeWorkspace.id}`
      );
      const json = await res.json();
      if (res.ok) {
        setAccounts(json.accounts || []);
        setJournals(json.journal_vouchers || []);
        if (json.summary) {
          setSummary(json.summary);
        }
      }
    } catch {
      toast.error("Failed to load accounting ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeWorkspace?.id]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-[#00aef0]" />
            Automated Accounting & Double-Entry Ledger
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time journal vouchers posted automatically from POS billing payment modes.
          </p>
        </div>
        <Button
          onClick={fetchData}
          variant="outline"
          className="border-border text-foreground gap-1.5 rounded-xl h-11"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Books
        </Button>
      </div>

      {/* Account Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card/80 border border-border rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Cash in Hand</div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              ₹{Number(summary.cash_in_hand || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-card/80 border border-border rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Bank Accounts</div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              ₹{Number(summary.bank_accounts || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-card/80 border border-border rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Customer Khata (Receivable)</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
              ₹{Number(summary.customer_khata || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-card/80 border border-border rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Sales Revenue</div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              ₹{Number(summary.total_sales_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("DAYBOOK")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "DAYBOOK"
              ? "bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          General Daybook & Journal Vouchers ({journals.length})
        </button>
        <button
          onClick={() => setActiveTab("ACCOUNTS")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "ACCOUNTS"
              ? "bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Chart of Accounts (GL) ({accounts.length})
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === "DAYBOOK" ? (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card/50 rounded-2xl border border-border">
              Loading POS Journal Vouchers...
            </div>
          ) : journals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-12 text-center text-muted-foreground space-y-3">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">Automated Accounting Active</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Every sales transaction completed on the POS Terminal will automatically generate double-entry Debit & Credit vouchers and post to your General Ledger.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {journals.map((voucher) => (
                <div
                  key={voucher.id}
                  className="bg-card/80 border border-border rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-[#00aef0]/10 text-[#00aef0] px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold">
                        {voucher.voucher_number}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        Ref: <strong className="text-foreground font-mono">{voucher.reference_type}</strong>
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        POSTED
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(voucher.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-foreground font-medium">
                    {voucher.narration || "POS Sales Automated Double-Entry Voucher"}
                  </p>

                  {/* Journal Debit / Credit Breakdown */}
                  <div className="rounded-xl border border-border bg-background overflow-hidden">
                    <table className="w-full text-left text-xs text-foreground">
                      <thead className="bg-card/90 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2 px-3">GL Ledger Account</th>
                          <th className="py-2 px-3 text-right">Debit (Dr)</th>
                          <th className="py-2 px-3 text-right">Credit (Cr)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(voucher.items || []).map((item: any, idx: number) => (
                          <tr key={item.id || idx}>
                            <td className="py-2 px-3 font-semibold text-foreground">
                              <span className="font-mono text-[#00aef0] mr-2">
                                [{item.account?.account_code || "1000"}]
                              </span>
                              {item.account?.account_name || "General Ledger Account"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                              {Number(item.debit_amount || 0) > 0
                                ? `₹${Number(item.debit_amount).toFixed(2)}`
                                : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-400">
                              {Number(item.credit_amount || 0) > 0
                                ? `₹${Number(item.credit_amount).toFixed(2)}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Ledger Account Name</th>
                  <th className="py-3.5 px-4">Account Type</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {accounts.map((acc) => (
                  <tr key={acc.id || acc.account_code} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#00aef0]">
                      {acc.account_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {acc.account_name}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded-lg border border-border">
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs uppercase text-muted-foreground font-mono">
                      {acc.sub_category || acc.category || "GENERAL"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-foreground">
                      ₹{Number(acc.current_balance || acc.balance || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
