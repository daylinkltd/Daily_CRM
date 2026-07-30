"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Plus,
  ArrowLeftRight,
  Search,
  CheckCircle2,
  X,
  FileText,
  Info,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { ProductCombobox } from "@/components/commerce/product-combobox";

export default function ReturnsPage() {
  const { activeWorkspace } = useWorkspace();
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [returnReason, setReturnReason] = useState<
    "DEFECTIVE" | "EXPIRED" | "WRONG_ITEM" | "CUSTOMER_MIND_CHANGE" | "OTHER"
  >("CUSTOMER_MIND_CHANGE");
  const [refundMode, setRefundMode] = useState<"CASH" | "BANK" | "KHATA_CREDIT">("CASH");
  const [refundAmount, setRefundAmount] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantityReturned, setQuantityReturned] = useState("1");
  const [restockInventory, setRestockInventory] = useState(true);

  const fetchReturnsData = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [retRes, salesRes, prodRes] = await Promise.all([
        fetch(`/api/commerce/returns?workspace_id=${activeWorkspace.id}`),
        fetch(`/api/commerce/sales?workspace_id=${activeWorkspace.id}`),
        fetch(`/api/commerce/products?workspace_id=${activeWorkspace.id}`),
      ]);

      const retJson = await retRes.json();
      const salesJson = await salesRes.json();
      const prodJson = await prodRes.json();

      if (retRes.ok) setReturnsList(retJson.returns || []);
      if (salesRes.ok) setSalesOrders(salesJson.sales_orders || []);
      if (prodRes.ok) setProducts(prodJson.products || []);
    } catch {
      toast.error("Failed to load returns data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnsData();
  }, [activeWorkspace?.id]);

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !refundAmount) {
      toast.error("Refund amount is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          sales_order_id: selectedOrderId || undefined,
          return_reason: returnReason,
          refund_mode: refundMode,
          total_refund_amount: Number(refundAmount),
          product_id: selectedProductId || undefined,
          quantity_returned: Number(quantityReturned || 1),
          restock_inventory: restockInventory,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to process return");

      toast.success(
        restockInventory
          ? "Return processed & Item restocked into inventory!"
          : "Return ticket logged!"
      );
      setShowAddModal(false);
      setSelectedOrderId("");
      setRefundAmount("");
      setSelectedProductId("");
      fetchReturnsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setSaving(false);
    }
  };

  const filtered = returnsList.filter(
    (r) =>
      r.return_number?.toLowerCase().includes(query.toLowerCase()) ||
      r.sales_order?.order_number?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <RefreshCw className="h-6 w-6 text-[#00aef0]" />
            Sales &amp; Purchase Returns
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Process customer sales returns, credit notes, and restock returned products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchReturnsData}
            variant="outline"
            className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11"
          >
            <Plus className="h-4 w-4" />
            Process Return
          </Button>
        </div>
      </div>

      {/* Business Workflow Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center gap-3 text-xs text-slate-300">
        <Info className="h-5 w-5 text-[#00aef0] shrink-0" />
        <div>
          <strong className="text-white block font-bold text-sm">
            Sales Returns Workflow:
          </strong>
          Select Ref Invoice → Choose return reason &amp; refund mode → Selecting{" "}
          <span className="text-emerald-400 font-bold">Restock Inventory</span> automatically adds returned items back into active stock!
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Return # or Ref Invoice #..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-950/80 border-slate-800 text-white rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Return #</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Ref Order #</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Refund Mode</th>
                <th className="py-3.5 px-4 text-right">Refund Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                    Loading Return Tickets...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-sm space-y-3">
                    <ArrowLeftRight className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-slate-300 font-semibold">No Sales Returns Logged</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Issue credit notes for sales returns or record damaged stock returns.
                    </p>
                    <Button
                      onClick={() => setShowAddModal(true)}
                      className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl gap-2 mt-2"
                    >
                      <Plus className="h-4 w-4" />
                      Process First Return
                    </Button>
                  </td>
                </tr>
              ) : (
                filtered.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      #{ret.return_number}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(ret.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#00aef0]">
                      {ret.sales_order?.order_number ? `#${ret.sales_order.order_number}` : "Direct Return"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300 font-medium">
                      {ret.return_reason?.replace(/_/g, " ")}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-300">
                      {ret.refund_mode}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-rose-400">
                      ₹{Number(ret.total_refund_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        PROCESSED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Return Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-100 my-8 overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[#00aef0]" />
                Process Sales Return &amp; Credit Note
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProcessReturn} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Select Ref Sales Order / Invoice</Label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const o = salesOrders.find((so) => so.id === e.target.value);
                    if (o) setRefundAmount(String(o.grand_total || 0));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl h-10 px-3 text-xs"
                >
                  <option value="">-- Direct Retail Return --</option>
                  {salesOrders.map((so) => (
                    <option key={so.id} value={so.id}>
                      Invoice #{so.order_number} (₹{Number(so.grand_total).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Return Reason</Label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl h-10 px-2 text-xs"
                  >
                    <option value="CUSTOMER_MIND_CHANGE">Customer Mind Change</option>
                    <option value="DEFECTIVE">Defective Product</option>
                    <option value="EXPIRED">Expired Product</option>
                    <option value="WRONG_ITEM">Wrong Item Billed</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Refund Mode</Label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl h-10 px-2 text-xs font-bold"
                  >
                    <option value="CASH">CASH (Refund from Drawer)</option>
                    <option value="BANK">BANK / UPI Refund</option>
                    <option value="KHATA_CREDIT">KHATA CREDIT (Reduce Balance)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Product to Restock (Optional)</Label>
                  <ProductCombobox
                    products={products}
                    selectedProductId={selectedProductId}
                    onSelect={(p) => setSelectedProductId(p ? p.id : "")}
                    placeholder="Search product to restock..."
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Refund Amount (₹) *</Label>
                  <Input
                    required
                    type="number"
                    placeholder="Enter amount..."
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs font-bold"
                  />
                </div>
              </div>

              {selectedProductId && (
                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="restockCheck"
                    checked={restockInventory}
                    onChange={(e) => setRestockInventory(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-[#00aef0]"
                  />
                  <Label htmlFor="restockCheck" className="text-xs text-slate-300 cursor-pointer">
                    Restock returned item into active Inventory stock
                  </Label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-800 text-slate-300 rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl h-10 px-5">
                  {saving ? "Processing..." : "Process Return"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
