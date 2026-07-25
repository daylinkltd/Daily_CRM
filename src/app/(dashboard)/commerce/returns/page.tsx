"use client";

import { useState } from "react";
import { RefreshCw, Plus, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReturnsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <RefreshCw className="h-6 w-6 text-[#00aef0]" />
            Sales & Purchase Returns
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Process customer sales returns, credit notes, and supplier product returns.
          </p>
        </div>
        <Button className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11">
          <Plus className="h-4 w-4" />
          Process Return
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-12 text-center text-slate-500">
        <ArrowLeftRight className="h-10 w-10 mx-auto text-slate-600 mb-3" />
        <p className="text-base font-semibold text-slate-300">No Returns Logged</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Issue credit notes for sales returns or record damaged stock returns to suppliers.
        </p>
      </div>
    </div>
  );
}
