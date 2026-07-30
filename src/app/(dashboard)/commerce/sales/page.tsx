"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Receipt,
  RefreshCw,
  Search,
  Printer,
  Eye,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  BookOpen,
  Calendar,
  User,
  ShoppingBag,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function SalesPage() {
  const { activeWorkspace } = useWorkspace();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const fetchOrders = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/commerce/sales?workspace_id=${activeWorkspace.id}&query=${encodeURIComponent(query)}`
      );
      const json = await res.json();
      if (res.ok && json.sales_orders) {
        setOrders(json.sales_orders);
      }
    } catch {
      toast.error("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeWorkspace?.id, query]);

  const totalRevenue = orders.reduce(
    (acc, order) => acc + Number(order.grand_total || 0),
    0
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-[#00aef0]" />
            Sales Orders & Tax Invoices
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View real-time completed POS checkout transactions, B2B sales invoices, and customer receipts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
              Total Invoiced Revenue
            </span>
            <span className="text-lg font-extrabold text-[#00aef0]">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Button
            onClick={fetchOrders}
            variant="outline"
            className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Orders
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Order #, Invoice Series, Customer Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-950/80 border-slate-800 text-white rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Sales Orders Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Order / Invoice #</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4 text-right">Tax Total</th>
                <th className="py-3.5 px-4 text-right">Grand Total</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    Loading Sales Orders & Invoices...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    No sales orders logged yet. Complete a checkout on the POS Terminal to view live invoices here.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const customerName = order.customer
                    ? `${order.customer.first_name} ${order.customer.last_name || ""}`
                    : order.is_walkin_customer
                    ? "Walk-in Retail Customer"
                    : order.customer_mobile || "Guest Customer";

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white font-mono">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowInvoiceModal(true);
                          }}
                          className="text-[#00aef0] hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          #{order.order_number}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300 font-medium">
                        {customerName}
                        {order.customer_mobile && (
                          <span className="block text-[11px] text-slate-500">
                            {order.customer_mobile}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-xs font-bold text-[#00aef0]">
                        <span className="bg-[#00aef0]/10 px-2 py-0.5 rounded-lg border border-[#00aef0]/20">
                          {order.channel || "POS"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          {order.payment_method === "CASH" && <Banknote className="h-3.5 w-3.5 text-emerald-400" />}
                          {order.payment_method === "UPI" && <Smartphone className="h-3.5 w-3.5 text-purple-400" />}
                          {order.payment_method === "CARD" && <CreditCard className="h-3.5 w-3.5 text-sky-400" />}
                          {order.payment_method === "KHATA_CREDIT" && <BookOpen className="h-3.5 w-3.5 text-amber-400" />}
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-400">
                        ₹{Number(order.tax_total || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-white">
                        ₹{Number(order.grand_total).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {order.payment_status || "PAID"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowInvoiceModal(true);
                          }}
                          className="border-slate-800 hover:border-[#00aef0] bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-[#00aef0] text-xs rounded-xl gap-1.5 h-8"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#00aef0]" />
                          View Invoice
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8 text-slate-100 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="bg-[#00aef0]/10 text-[#00aef0] px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                  <Receipt className="h-3.5 w-3.5" /> Tax Invoice #{selectedOrder.order_number}
                </span>
                <h2 className="text-xl font-extrabold text-white tracking-tight mt-1">
                  POS Sales Receipt
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">
                    Payment Status: {selectedOrder.payment_status || "PAID"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer & Counter Banner */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Customer Information</span>
                <span className="font-bold text-white block mt-0.5">
                  {selectedOrder.customer
                    ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name || ""}`
                    : selectedOrder.is_walkin_customer
                    ? "Walk-in Retail Customer"
                    : selectedOrder.customer_mobile || "Guest Customer"}
                </span>
                {selectedOrder.customer_gstin && (
                  <span className="text-[11px] text-slate-400 block font-mono">
                    GSTIN: {selectedOrder.customer_gstin}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Billing Details</span>
                <span className="font-bold text-[#00aef0] block mt-0.5 uppercase">
                  Counter: {selectedOrder.counter_number || "COUNTER-1"} ({selectedOrder.channel || "POS"})
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Payment Mode: {selectedOrder.payment_method}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">GST %</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(selectedOrder.items || []).map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {item.product?.name || `Product ID #${item.product_id}`}
                        {item.product?.sku && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            SKU: {item.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        ₹{Number(item.selling_price || item.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-400 font-mono">
                        {item.tax_rate || 0}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-white">
                        ₹{Number(item.total_price || item.quantity * item.selling_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>₹{Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST Tax Total</span>
                <span>₹{Number(selectedOrder.tax_total || 0).toFixed(2)}</span>
              </div>
              {Number(selectedOrder.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Discount Applied</span>
                  <span>-₹{Number(selectedOrder.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-extrabold text-white">
                <span>Grand Total</span>
                <span className="text-[#00aef0] text-base">
                  ₹{Number(selectedOrder.grand_total).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-[11px] text-slate-500">
                Daily CRM Enterprise POS Billing System
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.print();
                    toast.success("Printing invoice receipt...");
                  }}
                  className="border-slate-800 hover:border-[#00aef0] text-slate-300 hover:text-[#00aef0] gap-1.5 rounded-xl text-xs h-10"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </Button>
                <Button
                  onClick={() => setShowInvoiceModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs h-10 px-5"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
