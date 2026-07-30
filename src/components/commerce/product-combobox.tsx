"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Barcode, Check, ChevronDown, Package } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProductComboboxProps {
  products: any[];
  selectedProductId: string;
  onSelect: (product: any | null) => void;
  placeholder?: string;
}

export function ProductCombobox({
  products,
  selectedProductId,
  onSelect,
  placeholder = "Type name, SKU, or scan barcode...",
}: ProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = products.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input / Display */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={
            isOpen
              ? query
              : selectedProduct
              ? `${selectedProduct.name} (${selectedProduct.sku})`
              : query
          }
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          placeholder={placeholder}
          className="pl-9 pr-8 h-10 bg-background border-border text-foreground rounded-xl text-xs font-semibold focus:border-[#00aef0] focus:ring-1 focus:ring-[#00aef0]"
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[100] left-0 mt-1 min-w-[320px] sm:min-w-[380px] w-full max-h-64 overflow-y-auto overflow-x-hidden bg-background border border-border rounded-2xl shadow-2xl divide-y divide-border text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-xs">
              No products found matching &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = p.id === selectedProductId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`p-3 hover:bg-muted/90 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? "bg-muted/80 border-l-4 border-l-[#00aef0]" : ""
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5 truncate">
                      <Package className="h-4 w-4 text-[#00aef0] shrink-0" />
                      <span className="truncate text-foreground">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-foreground flex items-center gap-2 flex-wrap">
                      <span className="font-mono bg-card px-1.5 py-0.5 rounded text-foreground border border-border">
                        SKU: {p.sku}
                      </span>
                      {p.barcode && (
                        <span className="text-[#00aef0] font-mono flex items-center gap-1 bg-[#00aef0]/10 px-1.5 py-0.5 rounded border border-[#00aef0]/20">
                          <Barcode className="h-3 w-3" /> {p.barcode}
                        </span>
                      )}
                      <span className="text-muted-foreground">Unit: {p.unit || "Pcs"}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-emerald-400 text-sm">
                      ₹{Number(p.selling_price || p.purchase_price || 0).toFixed(2)}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-[#00aef0] ml-auto mt-0.5" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
