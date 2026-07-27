"use client";

import { useState } from "react";
import { Truck, Plus, RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PurchasesPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-[#00aef0]" />
            Purchase Orders & Goods Inward
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage procurement, supplier purchase orders, and stock inward bills.
          </p>
        </div>
        <Button className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11">
          <Plus className="h-4 w-4" />
          Create Purchase Order
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-12 text-center text-slate-500">
        <Package className="h-10 w-10 mx-auto text-slate-600 mb-3" />
        <p className="text-base font-semibold text-slate-300">No Purchase Orders</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Create purchase orders to order stock from suppliers and track inward stock receipts.
        </p>
      </div>
    </div>
  );
}
