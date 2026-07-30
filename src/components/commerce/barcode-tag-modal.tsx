"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, Barcode as BarcodeIcon } from "lucide-react";
import { toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/commerce/barcode-utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  mrp?: number;
  unit?: string;
  category?: { name: string };
  attributes?: Record<string, any>;
}

interface BarcodeTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  workspaceName?: string;
}

export function BarcodeTagModal({
  isOpen,
  onClose,
  product,
  workspaceName = "Daily CRM Store",
}: BarcodeTagModalProps) {
  const [printCopies] = useState(1);
  const [tagWidth, setTagWidth] = useState(50); // mm
  const [tagHeight, setTagHeight] = useState(30); // mm (Optimized for 32px barcode height)

  if (!isOpen || !product) return null;

  const displayBarcode = product.barcode || product.sku;
  const price = Number(product.selling_price || 0).toFixed(2);
  const mrpPrice = Number(product.mrp || product.selling_price || 0).toFixed(2);

  const handlePrint = () => {
    try {
      window.print();
      toast.success(`Printing ${printCopies} Barcode Tag(s)`);
    } catch (e: any) {
      const msg = sanitizeErrorMessage(e, "Failed to print barcode tag");
      toast.error(msg);
    }
  };

  return (
    <>
      {/* Scoped @media print CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > *:not(.tag-print-modal-container) {
                display: none !important;
              }
              .tag-print-modal-container {
                display: block !important;
                position: absolute !important;
                top: 0; left: 0; width: 100%;
                background: #ffffff !important;
                color: #000000 !important;
              }
              @page {
                margin: 0;
                size: ${tagWidth}mm ${tagHeight}mm;
              }
            }
          `,
        }}
      />

      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl text-foreground">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarcodeIcon className="h-5 w-5 text-[#00aef0]" />
              Barcode Tag Generator (32px High-Precision Scan)
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Printable Tag Container */}
          <div className="flex justify-center p-4 bg-background border border-border rounded-2xl">
            <div
              className="tag-print-modal-container bg-white text-black p-3 rounded-lg border border-border shadow-md flex flex-col justify-between items-center text-center select-none"
              style={{
                width: `${tagWidth * 5}px`,
                height: `${tagHeight * 6}px`,
              }}
            >
              <div className="text-[10px] font-extrabold tracking-wider uppercase border-b border-black/20 pb-0.5 w-full truncate">
                {workspaceName}
              </div>

              <div className="my-1">
                <div className="text-xs font-bold leading-tight truncate max-w-[200px]">
                  {product.name}
                </div>
                <div className="text-[9px] text-gray-600 font-mono mt-0.5">
                  SKU: {product.sku}
                </div>
              </div>

              {/* 32px Standard Scanner Barcode Container with Quiet Zones */}
              <div className="w-full flex flex-col items-center my-1">
                {/* 32px Height High-Contrast Barcode Bars */}
                <div className="flex items-center justify-center h-[32px] gap-[1.5px] bg-black p-1 w-full max-w-[190px] rounded-sm">
                  {/* Quiet Zone Left */}
                  <div className="bg-white h-full w-[4px]" />
                  {/* Barcode Bars */}
                  <div className="bg-white h-full w-[2px]" />
                  <div className="bg-black h-full w-[1px]" />
                  <div className="bg-white h-full w-[3px]" />
                  <div className="bg-black h-full w-[1px]" />
                  <div className="bg-white h-full w-[2px]" />
                  <div className="bg-black h-full w-[2px]" />
                  <div className="bg-white h-full w-[4px]" />
                  <div className="bg-black h-full w-[1px]" />
                  <div className="bg-white h-full w-[3px]" />
                  <div className="bg-black h-full w-[2px]" />
                  <div className="bg-white h-full w-[2px]" />
                  {/* Quiet Zone Right */}
                  <div className="bg-white h-full w-[4px]" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-black mt-1">
                  {displayBarcode}
                </span>
              </div>

              <div className="w-full flex items-center justify-between border-t border-black/20 pt-1 text-[11px]">
                {mrpPrice !== price && (
                  <span className="line-through text-gray-500 text-[10px]">
                    MRP: ₹{mrpPrice}
                  </span>
                )}
                <span className="font-extrabold text-black text-sm">
                  Price: ₹{price}
                </span>
              </div>
            </div>
          </div>

          {/* Configuration controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-muted-foreground">Tag Width (mm)</label>
              <input
                type="number"
                value={tagWidth}
                onChange={(e) => setTagWidth(Number(e.target.value))}
                className="w-full bg-background border border-border text-foreground rounded-lg px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground">Tag Height (mm)</label>
              <input
                type="number"
                value={tagHeight}
                onChange={(e) => setTagHeight(Number(e.target.value))}
                className="w-full bg-background border border-border text-foreground rounded-lg px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground rounded-xl text-xs"
            >
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold rounded-xl gap-2 text-xs"
            >
              <Printer className="h-4 w-4" />
              Print 32px Barcode Tag
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
