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
import { IconAction } from "@/components/ui/icon-action";

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
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-[#00aef0]" />
            Sales Orders & Tax Invoices
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View real-time completed POS checkout transactions, B2B sales invoices, and customer receipts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-card border border-border px-4 py-2 rounded-xl text-right">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
              Total Invoiced Revenue
            </span>
            <span className="text-lg font-extrabold text-[#00aef0]">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <IconAction label="Refresh Orders" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchOrders}
            variant="outline"
            className="border-border text-foreground gap-1.5 rounded-xl h-11" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-card/80 p-3 rounded-2xl border border-border backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Order #, Invoice Series, Customer Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-background/80 border-border text-foreground rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Sales Orders Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
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
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Sales Orders & Invoices...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
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
                    <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground font-mono">
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
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground font-medium">
                        {customerName}
                        {order.customer_mobile && (
                          <span className="block text-[11px] text-muted-foreground">
                            {order.customer_mobile}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-xs font-bold text-[#00aef0]">
                        <span className="bg-[#00aef0]/10 px-2 py-0.5 rounded-lg border border-[#00aef0]/20">
                          {order.channel || "POS"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground font-semibold">
                        <span className="flex items-center gap-1.5">
                          {order.payment_method === "CASH" && <Banknote className="h-3.5 w-3.5 text-emerald-400" />}
                          {order.payment_method === "UPI" && <Smartphone className="h-3.5 w-3.5 text-purple-400" />}
                          {order.payment_method === "CARD" && <CreditCard className="h-3.5 w-3.5 text-sky-400" />}
                          {order.payment_method === "KHATA_CREDIT" && <BookOpen className="h-3.5 w-3.5 text-amber-400" />}
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                        ₹{Number(order.tax_total || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-foreground">
                        ₹{Number(order.grand_total).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {order.payment_status || "PAID"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <IconAction label="View Invoice" icon={<Eye className="h-3.5 w-3.5 text-[#00aef0]" />} variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowInvoiceModal(true);
                          }}
                          className="border-border hover:border-[#00aef0] bg-card hover:bg-muted text-foreground hover:text-[#00aef0] text-xs rounded-xl gap-1.5 h-8" />
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
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8 text-foreground relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="bg-[#00aef0]/10 text-[#00aef0] px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                  <Receipt className="h-3.5 w-3.5" /> Tax Invoice #{selectedOrder.order_number}
                </span>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight mt-1">
                  POS Sales Receipt
                </h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
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
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer & Counter Banner */}
            <div className="grid grid-cols-2 gap-3 bg-background p-3.5 rounded-2xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block">Customer Information</span>
                <span className="font-bold text-foreground block mt-0.5">
                  {selectedOrder.customer
                    ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name || ""}`
                    : selectedOrder.is_walkin_customer
                    ? "Walk-in Retail Customer"
                    : selectedOrder.customer_mobile || "Guest Customer"}
                </span>
                {selectedOrder.customer_gstin && (
                  <span className="text-[11px] text-muted-foreground block font-mono">
                    GSTIN: {selectedOrder.customer_gstin}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block">Billing Details</span>
                <span className="font-bold text-[#00aef0] block mt-0.5 uppercase">
                  Counter: {selectedOrder.counter_number || "COUNTER-1"} ({selectedOrder.channel || "POS"})
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Payment Mode: {selectedOrder.payment_method}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-2xl border border-border overflow-hidden bg-background">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-card/90 font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">GST %</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(selectedOrder.items || []).map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {item.product?.name || `Product ID #${item.product_id}`}
                        {item.product?.sku && (
                          <span className="block text-[10px] text-muted-foreground font-mono">
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
                      <td className="py-2.5 px-3 text-right font-extrabold text-foreground">
                        ₹{Number(item.total_price || item.quantity * item.selling_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="bg-background p-4 rounded-2xl border border-border space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST Tax Total</span>
                <span>₹{Number(selectedOrder.tax_total || 0).toFixed(2)}</span>
              </div>
              {Number(selectedOrder.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Discount Applied</span>
                  <span>-₹{Number(selectedOrder.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-extrabold text-foreground">
                <span>Grand Total</span>
                <span className="text-[#00aef0] text-base">
                  ₹{Number(selectedOrder.grand_total).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-[11px] text-muted-foreground">
                Daily CRM Enterprise POS Billing System
              </span>
              <div className="flex items-center gap-2">
                <IconAction label="Print Receipt" icon={<Printer className="h-4 w-4" />} variant="outline"
                  onClick={() => {
                    window.print();
                    toast.success("Printing invoice receipt...");
                  }}
                  className="border-border hover:border-[#00aef0] text-foreground hover:text-[#00aef0] gap-1.5 rounded-xl text-xs h-10" />
                <Button
                  onClick={() => setShowInvoiceModal(false)}
                  className="bg-muted hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 px-5"
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
