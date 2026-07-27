"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, RefreshCw, Search, Landmark, Banknote, QrCode, CreditCard, ArrowUpRight, ArrowDownRight, Layers } from "lucide-react";
import { toast } from "sonner";

export default function AccountingLedgerPage() {
  const { activeWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "DAYBOOK">("DAYBOOK");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const fetchData = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      // In production, fetch GL accounts & journal entries
      setAccounts([
        { code: "1010", name: "Cash in Hand Ledger", type: "ASSET", category: "CASH", balance: 12500 },
        { code: "1020", name: "SBI Current Bank Ledger", type: "ASSET", category: "BANK", balance: 45000 },
        { code: "1021", name: "HDFC Bank Ledger", type: "ASSET", category: "BANK", balance: 28000 },
        { code: "1030", name: "Cheque in Hand Ledger", type: "ASSET", category: "CHEQUE", balance: 5000 },
        { code: "1040", name: "Customer Khata (Receivable)", type: "ASSET", category: "KHATA", balance: 18500 },
        { code: "4010", name: "Sales Revenue Account", type: "REVENUE", category: "SALES", balance: 109000 },
      ]);
      setJournals([]);
    } catch (err) {
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-[#00aef0]" />
            Automated Accounting & Double-Entry Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time journal vouchers posted automatically from POS billing payment modes.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
          <RefreshCw className="h-4 w-4" />
          Refresh Books
        </Button>
      </div>

      {/* Account Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Cash in Hand</div>
            <div className="text-lg font-bold text-white mt-0.5">₹12,500.00</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Bank Accounts</div>
            <div className="text-lg font-bold text-white mt-0.5">₹73,000.00</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Customer Khata (Receivable)</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">₹18,500.00</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Total Sales Revenue</div>
            <div className="text-lg font-bold text-white mt-0.5">₹1,09,000.00</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("DAYBOOK")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "DAYBOOK"
              ? "bg-[#00aef0] text-white shadow-lg shadow-[#00aef0]/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          General Daybook & Journal Vouchers
        </button>
        <button
          onClick={() => setActiveTab("ACCOUNTS")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "ACCOUNTS"
              ? "bg-[#00aef0] text-white shadow-lg shadow-[#00aef0]/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Chart of Accounts (GL)
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === "ACCOUNTS" ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Ledger Account Name</th>
                  <th className="py-3.5 px-4">Account Type</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accounts.map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#00aef0]">{acc.code}</td>
                    <td className="py-3.5 px-4 font-semibold text-white">{acc.name}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{acc.type}</td>
                    <td className="py-3.5 px-4 text-xs uppercase text-slate-400">{acc.category}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-white">
                      ₹{acc.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-12 text-center text-slate-500 space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-slate-600" />
          <p className="text-base font-semibold text-slate-300">Automated Accounting Active</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Every sales transaction completed on the POS Terminal will automatically generate double-entry Debit & Credit vouchers and post to your General Ledger.
          </p>
        </div>
      )}
    </div>
  );
}
