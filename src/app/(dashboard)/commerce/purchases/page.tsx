"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Truck,
  Plus,
  Package,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Building2,
  Info,
  ArrowDownLeft,
} from "lucide-react";
import { toast } from "sonner";

import { ProductCombobox } from "@/components/commerce/product-combobox";
import { IconAction } from "@/components/ui/icon-action";

interface POItemInput {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

export default function PurchasesPage() {
  const { activeWorkspace } = useWorkspace();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poStatus, setPoStatus] = useState<"ORDERED" | "RECEIVED">("RECEIVED");
  const [notes, setNotes] = useState("");
  const [poItems, setPoItems] = useState<POItemInput[]>([]);

  // Item Selector State inside modal
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("10");
  const [itemCost, setItemCost] = useState("");

  const fetchPurchasesData = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [poRes, suppRes, prodRes] = await Promise.all([
        fetch(`/api/commerce/purchases?workspace_id=${activeWorkspace.id}`),
        fetch(`/api/commerce/suppliers?workspace_id=${activeWorkspace.id}`),
        fetch(`/api/commerce/products?workspace_id=${activeWorkspace.id}`),
      ]);

      const poJson = await poRes.json();
      const suppJson = await suppRes.json();
      const prodJson = await prodRes.json();

      if (poRes.ok) setPurchaseOrders(poJson.purchase_orders || []);
      if (suppRes.ok) setSuppliers(suppJson.suppliers || []);
      if (prodRes.ok) setProducts(prodJson.products || []);
    } catch {
      toast.error("Failed to load purchase orders data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchasesData();
  }, [activeWorkspace?.id]);

  const handleAddItemToPO = () => {
    if (!selectedProductId) {
      toast.error("Please select a product from catalog");
      return;
    }
    const matchedProd = products.find((p) => p.id === selectedProductId);
    if (!matchedProd) return;

    const qtyNum = Number(itemQty || 1);
    const costNum = Number(itemCost || matchedProd.purchase_price || 0);

    const newItem: POItemInput = {
      id: `${Date.now()}-${Math.random()}`,
      product_id: matchedProd.id,
      product_name: matchedProd.name,
      quantity: qtyNum,
      unit_cost: costNum,
    };

    setPoItems((prev) => [...prev, newItem]);
    setSelectedProductId("");
    setItemQty("10");
    setItemCost("");
    toast.success(`Added ${matchedProd.name} to order`);
  };

  const handleRemoveItemFromPO = (id: string) => {
    setPoItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;
    if (poItems.length === 0) {
      toast.error("Please add at least one product item to the purchase order");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          supplier_id: selectedSupplierId || undefined,
          status: poStatus,
          notes,
          items: poItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create Purchase Order");

      toast.success(
        poStatus === "RECEIVED"
          ? "Purchase Order created & Stock Inward logged into Inventory!"
          : "Purchase Order created!"
      );
      setShowAddModal(false);
      setSelectedSupplierId("");
      setNotes("");
      setPoItems([]);
      fetchPurchasesData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const grandTotalPO = poItems.reduce(
    (acc, item) => acc + item.quantity * item.unit_cost,
    0
  );

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.po_number?.toLowerCase().includes(query.toLowerCase()) ||
      po.supplier?.company_name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-[#00aef0]" />
            Purchase Orders & Goods Inward
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage procurement, supplier purchase orders, and stock inward bills.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconAction label="Refresh" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchPurchasesData}
            variant="outline"
            className="border-border text-foreground gap-1.5 rounded-xl h-11" />
          <IconAction label="Create Purchase Order" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11" />
        </div>
      </div>

      {/* Business Workflow Banner */}
      <div className="bg-card/90 border border-border p-4 rounded-2xl flex items-center gap-3 text-xs text-foreground">
        <Info className="h-5 w-5 text-[#00aef0] shrink-0" />
        <div>
          <strong className="text-foreground block font-bold text-sm">
            Procurement & Stock Inward Workflow:
          </strong>
          Select a Supplier → Add catalog products & purchase costs → Setting status to{" "}
          <span className="text-emerald-400 font-bold">RECEIVED</span> automatically updates inventory stock levels across your catalog!
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-card/80 p-3 rounded-2xl border border-border backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by PO Number or Supplier Name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-background/80 border-border text-foreground rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4">PO #</th>
                <th className="py-3.5 px-4 hidden sm:table-cell">Date</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-center hidden md:table-cell">Items Count</th>
                <th className="py-3.5 px-4 text-right">Total Cost</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Purchase Orders...
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm space-y-3">
                    <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-foreground font-semibold">No Purchase Orders Created Yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Create purchase orders to order stock from suppliers and track inward stock receipts.
                    </p>
                    <IconAction label="Create First Purchase Order" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}
                      className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl gap-2 mt-2" />
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      #{po.po_number}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(po.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-foreground">
                      {po.supplier?.company_name || "Direct Vendor"}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-bold text-[#00aef0] hidden md:table-cell">
                      {po.items?.length || 0} Items
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-foreground">
                      ₹{Number(po.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {po.status === "RECEIVED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          RECEIVED (Stock Inward)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" />
                          {po.status || "ORDERED"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-foreground my-8 overflow-x-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#00aef0]" />
                Create Purchase Order &amp; Stock Inward
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              {/* Supplier & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground">Select Supplier / Vendor</Label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-background border border-border text-foreground rounded-xl h-10 px-3 text-xs"
                  >
                    <option value="">-- Direct Supplier / Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name} ({s.contact_person || "Vendor"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-foreground">PO Status</Label>
                  <select
                    value={poStatus}
                    onChange={(e) => setPoStatus(e.target.value as any)}
                    className="w-full bg-background border border-border text-foreground rounded-xl h-10 px-3 text-xs font-bold"
                  >
                    <option value="RECEIVED">RECEIVED (Auto Inward Stock into Catalog)</option>
                    <option value="ORDERED">ORDERED (Pending Goods Receipt)</option>
                  </select>
                </div>
              </div>

              {/* Add Items Builder Card */}
              <div className="bg-background p-4 rounded-2xl border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00aef0] flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Add Catalog Items to PO
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">Search &amp; Select Product</Label>
                    <div className="mt-1">
                      <ProductCombobox
                        products={products}
                        selectedProductId={selectedProductId}
                        onSelect={(p) => {
                          if (p) {
                            setSelectedProductId(p.id);
                            setItemCost(String(p.purchase_price || p.selling_price || 0));
                          } else {
                            setSelectedProductId("");
                          }
                        }}
                        placeholder="Type name, SKU, or scan barcode..."
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Inward Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="bg-card border-border text-foreground rounded-xl h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Unit Purchase Price (₹)</Label>
                    <Input
                      type="number"
                      placeholder="Cost price..."
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                      className="bg-card border-border text-foreground rounded-xl h-9 text-xs mt-1"
                    />
                  </div>
                </div>
                <IconAction label="Add Line Item" icon={<Plus className="h-3.5 w-3.5" />} type="button"
                  onClick={handleAddItemToPO}
                  className="bg-[#00aef0]/10 hover:bg-[#00aef0]/20 text-[#00aef0] font-bold rounded-xl text-xs h-8 w-full gap-1" />
              </div>

              {/* Added Line Items Table */}
              {poItems.length > 0 && (
                <div className="rounded-2xl border border-border bg-background overflow-hidden">
                  <table className="w-full text-left text-xs text-foreground">
                    <thead className="bg-card font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Cost</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {poItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-semibold text-foreground">
                            {item.product_name}
                          </td>
                          <td className="py-2 px-3 text-center font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right">
                            ₹{item.unit_cost.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#00aef0]">
                            ₹{(item.quantity * item.unit_cost).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromPO(item.id)}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-card/90 text-right text-xs font-bold text-foreground border-t border-border">
                    Grand Total: <span className="text-[#00aef0] text-sm font-extrabold ml-2">₹{grandTotalPO.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs text-foreground">Notes / Remarks</Label>
                <Input
                  type="text"
                  placeholder="e.g. Stock batch received at Main Warehouse"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-border text-foreground rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl h-10 px-5">
                  {saving ? "Saving PO..." : "Save Purchase Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
