"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, Search, RefreshCw, ShoppingCart, Calendar, CheckCircle2, QrCode, Banknote, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function SalesPage() {
  const { activeWorkspace } = useWorkspace();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      // In production, fetch sales orders from API
      setOrders([]);
    } catch (err) {
      toast.error("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeWorkspace?.id]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-[#00aef0]" />
            Sales Orders & Invoices
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View completed POS checkout transactions, B2B sales invoices, and order history.
          </p>
        </div>
        <Button onClick={fetchOrders} variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
          <RefreshCw className="h-4 w-4" />
          Refresh Orders
        </Button>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4 text-right">Grand Total</th>
                <th className="py-3.5 px-4 text-center">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    Loading Sales Orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    No sales orders logged yet. Complete a checkout on the POS Terminal to view sales orders here.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white font-mono">
                      #{order.order_number}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-xs text-[#00aef0] font-semibold">
                      {order.channel || "POS"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300 font-semibold">
                      {order.payment_method}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-white">
                      ₹{Number(order.grand_total).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        PAID
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
