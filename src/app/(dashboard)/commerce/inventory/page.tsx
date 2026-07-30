"use client";

import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus, ArrowUpRight, RefreshCw, Search, AlertTriangle, Barcode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const { activeWorkspace } = useWorkspace();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showStockModal, setShowStockModal] = useState(false);

  // Form State for Adding Stock
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductObj, setSelectedProductObj] = useState<any | null>(null);
  const [movementType, setMovementType] = useState<"INWARD" | "ADJUSTMENT">("INWARD");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Barcode Scanner Global Keyboard Stream Listener
  const barcodeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const fetchInventory = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/inventory?workspace_id=${activeWorkspace.id}`);
      const json = await res.json();
      if (res.ok && json.inventory) {
        setInventory(json.inventory);
      }
    } catch {
      toast.error("Failed to load inventory levels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [activeWorkspace?.id]);

  // Global Barcode Scan Listener (Zero-Click Modal Opening)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkey F3 to open stock modal
      if (e.key === "F3") {
        e.preventDefault();
        setShowStockModal(true);
        return;
      }

      // Detect hardware barcode scanner stream (rapid key presses < 30ms apart ending in Enter)
      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (diff > 50) {
        barcodeBufferRef.current = "";
      }

      if (e.key === "Enter") {
        const scannedCode = barcodeBufferRef.current.trim();
        if (scannedCode.length >= 4) {
          const matched = inventory.find(
            (item) =>
              (item.barcode && item.barcode.toLowerCase() === scannedCode.toLowerCase()) ||
              item.sku.toLowerCase() === scannedCode.toLowerCase()
          );

          if (matched) {
            e.preventDefault();
            setSelectedProductId(matched.id);
            setSelectedProductObj(matched);
            setBarcodeSearch(scannedCode);
            setShowStockModal(true);
            toast.success(`Barcode Scanned: ${matched.name}`);
            setTimeout(() => {
              quantityInputRef.current?.focus();
            }, 100);
          }
        }
        barcodeBufferRef.current = "";
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inventory]);

  useEffect(() => {
    if (showStockModal) {
      setTimeout(() => {
        if (!selectedProductId) {
          barcodeInputRef.current?.focus();
        } else {
          quantityInputRef.current?.focus();
        }
      }, 100);
    }
  }, [showStockModal, selectedProductId]);

  // Handle Barcode Scan / Quick Search Match inside Modal
  const handleBarcodeOrQueryChange = (val: string) => {
    setBarcodeSearch(val);
    if (!val.trim()) {
      setSelectedProductId("");
      setSelectedProductObj(null);
      return;
    }

    const matched = inventory.find(
      (item) =>
        (item.barcode && item.barcode.toLowerCase() === val.trim().toLowerCase()) ||
        item.sku.toLowerCase() === val.trim().toLowerCase() ||
        item.name.toLowerCase().includes(val.trim().toLowerCase())
    );

    if (matched) {
      setSelectedProductId(matched.id);
      setSelectedProductObj(matched);
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 50);
    }
  };

  const handleSelectProductDropdown = (id: string) => {
    setSelectedProductId(id);
    const matched = inventory.find((item) => item.id === id);
    setSelectedProductObj(matched || null);
    if (matched) {
      setBarcodeSearch(matched.barcode || matched.sku || matched.name);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !selectedProductId || !quantity) {
      toast.error("Please scan a valid product and enter quantity");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          product_id: selectedProductId,
          movement_type: movementType,
          quantity: Number(quantity),
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add stock");

      toast.success(`Stock updated for ${selectedProductObj?.name || 'Product'}!`);
      setShowStockModal(false);
      setSelectedProductId("");
      setSelectedProductObj(null);
      setBarcodeSearch("");
      setQuantity("");
      setNotes("");
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    item.sku.toLowerCase().includes(query.toLowerCase()) ||
    (item.barcode && item.barcode.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-[#00aef0]" />
            Inventory & Stock Movements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track real-time stock levels, reorder thresholds, and log stock additions via barcode scan or F3 hotkey.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchInventory} variant="outline" className="border-border text-foreground gap-1.5 rounded-xl h-11">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setBarcodeSearch("");
              setSelectedProductId("");
              setSelectedProductObj(null);
              setQuantity("");
              setNotes("");
              setShowStockModal(true);
            }}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11"
          >
            <Plus className="h-4 w-4" />
            Add / Adjust Stock (F3)
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-card/80 p-3 rounded-2xl border border-border backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search stock by Product Name, SKU, or Barcode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-background/80 border-border text-foreground rounded-xl focus:border-[#00aef0]"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-background/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">SKU / Barcode</th>
                <th className="py-3.5 px-4 text-center">Unit</th>
                <th className="py-3.5 px-4 text-right">Current Stock</th>
                <th className="py-3.5 px-4 text-right">Reorder Threshold</th>
                <th className="py-3.5 px-4 text-center">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    Loading Stock Levels...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    No inventory records found. Add products in the Master Catalog first, then click &quot;Add / Adjust Stock&quot;.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const currentQty = item.current_stock || 0;
                  const isLowStock = currentQty <= (item.reorder_level || 10);
                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        <div>{item.sku}</div>
                        {item.barcode && (
                          <div className="text-[11px] text-[#00aef0] flex items-center gap-1 mt-0.5">
                            <Barcode className="h-3 w-3" /> {item.barcode}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center uppercase text-xs text-muted-foreground font-mono">
                        {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-base text-foreground">
                        {currentQty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                        {item.reorder_level || 10} {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ArrowUpRight className="h-3 w-3" />
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Adjust Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#00aef0]" />
              Add / Adjust Stock
            </h2>

            <form onSubmit={handleAddStock} className="space-y-4">
              {/* 1-Scan Barcode Input */}
              <div className="space-y-1.5 bg-background p-3 rounded-2xl border border-border">
                <Label className="text-xs font-bold text-[#00aef0] flex items-center gap-1.5">
                  <Barcode className="h-4 w-4" /> 1-Scan Barcode / Search Product
                </Label>
                <div className="relative">
                  <Input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan product barcode here with scanner..."
                    value={barcodeSearch}
                    onChange={(e) => handleBarcodeOrQueryChange(e.target.value)}
                    className="bg-card border-border text-foreground h-10 rounded-xl px-3 text-xs font-mono focus:border-[#00aef0]"
                  />
                </div>

                {selectedProductObj && (
                  <div className="mt-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-extrabold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Matched: {selectedProductObj.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        SKU: {selectedProductObj.sku} | Current Stock: {selectedProductObj.current_stock || 0} {selectedProductObj.unit}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Or Select Product from List *</Label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => handleSelectProductDropdown(e.target.value)}
                  className="w-full bg-background border border-border text-foreground h-10 rounded-xl px-3 text-sm focus:border-[#00aef0]"
                >
                  <option value="">-- Choose a Product --</option>
                  {inventory.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.sku}) — Current: {prod.current_stock || 0} {prod.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Action Type</Label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  className="w-full bg-background border border-border text-foreground h-10 rounded-xl px-3 text-sm focus:border-[#00aef0]"
                >
                  <option value="INWARD">Stock Inward (+ New Delivery)</option>
                  <option value="ADJUSTMENT">Stock Adjustment (+ Manual Addition)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Quantity to Add *</Label>
                <Input
                  ref={quantityInputRef}
                  type="number"
                  required
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-background border-border text-foreground h-10 rounded-xl font-bold text-base focus:border-[#00aef0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Notes / Invoice Ref</Label>
                <Input
                  type="text"
                  placeholder="e.g. Received from Supplier Bill #1042"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-background border-border text-foreground h-10 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowStockModal(false)}
                  className="border-border text-foreground rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !selectedProductId}
                  className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl px-6"
                >
                  {saving ? "Updating..." : "Add Stock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
