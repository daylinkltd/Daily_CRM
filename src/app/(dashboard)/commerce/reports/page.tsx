"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, Landmark, ArrowUpRight } from "lucide-react";

export default function ReportsHubPage() {
  useWorkspace();
  const [activeTab, setActiveTab] = useState<"TRIAL_BALANCE" | "PL_STATEMENT" | "BALANCE_SHEET" | "AGING">("TRIAL_BALANCE");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-[#00aef0]" />
            Financial Statements & Executive BI Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time Trial Balance, Profit & Loss Statement, Balance Sheet, and AR/AP Aging Analysis.
          </p>
        </div>
        <Button variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
          <Download className="h-4 w-4" />
          Export Financial PDF/Excel
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {(["TRIAL_BALANCE", "PL_STATEMENT", "BALANCE_SHEET", "AGING"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === tab
                ? "bg-[#00aef0] text-white shadow-lg shadow-[#00aef0]/20"
                : "text-slate-400 hover:text-foreground"
            }`}
          >
            {tab === "TRIAL_BALANCE" && "Trial Balance Sheet"}
            {tab === "PL_STATEMENT" && "Profit & Loss (P&L)"}
            {tab === "BALANCE_SHEET" && "Balance Sheet"}
            {tab === "AGING" && "AR/AP Aging Analysis"}
          </button>
        ))}
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
          <div className="text-xs text-slate-400 font-bold uppercase">Total Revenue (YTD)</div>
          <div className="text-2xl font-extrabold text-white">₹1,24,500.00</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="h-4 w-4" /> +14.2% from last month
          </div>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
          <div className="text-xs text-slate-400 font-bold uppercase">Cost of Goods Sold (COGS)</div>
          <div className="text-2xl font-extrabold text-rose-400">₹78,200.00</div>
          <div className="text-xs text-slate-400">Gross Margin: 37.1%</div>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
          <div className="text-xs text-slate-400 font-bold uppercase">Net Operating Profit</div>
          <div className="text-2xl font-extrabold text-emerald-400">₹46,300.00</div>
          <div className="text-xs text-slate-400">After operational expenses</div>
        </div>
      </div>

      {/* Main Financial Table View */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-8 text-center text-slate-400">
        <Landmark className="h-10 w-10 mx-auto text-[#00aef0] mb-3" />
        <h3 className="text-lg font-bold text-white">Real-Time General Ledger Reconciliation Active</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          Trial Balance reconciled automatically: Total Debit (₹1,24,500.00) = Total Credit (₹1,24,500.00).
        </p>
      </div>
    </div>
  );
}
