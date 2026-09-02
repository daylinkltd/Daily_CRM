"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, Barcode as BarcodeIcon } from "lucide-react";
import { toast } from "sonner";
import { sanitizeErrorMessage, generateCode128Pattern } from "@/lib/commerce/barcode-utils";
import { IconAction } from "@/components/ui/icon-action";

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
  workspaceName = "Dailybuz Store",
}: BarcodeTagModalProps) {
  const [tagWidth, setTagWidth] = useState(50); // mm
  const [tagHeight, setTagHeight] = useState(30); // mm (Standard thermal tag 50x30mm)

  if (!isOpen || !product) return null;

  const displayBarcode = product.barcode || product.sku;
  const price = Number(product.selling_price || 0).toFixed(2);
  const mrpPrice = Number(product.mrp || product.selling_price || 0).toFixed(2);
  const barcodeBars = generateCode128Pattern(displayBarcode);

  const handlePrint = () => {
    try {
      const barsHtml = barcodeBars
        .map(
          (isBar) =>
            `<div style="height:100%; flex:1; min-width:1px; background-color:${
              isBar ? "#000000" : "#ffffff"
            } !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;"></div>`
        )
        .join("");

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Tag - ${product.sku}</title>
  <style>
    @page {
      size: ${tagWidth}mm ${tagHeight}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${tagWidth}mm;
      height: ${tagHeight}mm;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      overflow: hidden;
    }
    .tag-container {
      width: ${tagWidth}mm;
      height: ${tagHeight}mm;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      background: #ffffff;
      color: #000000;
    }
    .store-name {
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-title {
      font-size: 9.5px;
      font-weight: bold;
      line-height: 1.1;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .sku-code {
      font-size: 7.5px;
      color: #333;
      font-family: monospace;
    }
    .barcode-box {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 1px 0;
    }
    .barcode-bars {
      display: flex;
      height: 28px;
      width: 100%;
      max-width: 180px;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #000;
      padding: 1px;
    }
    .barcode-str {
      font-size: 8.5px;
      font-family: monospace;
      font-weight: bold;
      letter-spacing: 1px;
      margin-top: 1px;
    }
    .price-box {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 1px;
      font-size: 9px;
    }
    .mrp {
      text-decoration: line-through;
      color: #555;
      font-size: 8px;
    }
    .price {
      font-weight: bold;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="tag-container">
    <div class="store-name">${workspaceName}</div>
    <div>
      <div class="product-title">${product.name}</div>
      <div class="sku-code">SKU: ${product.sku}</div>
    </div>
    <div class="barcode-box">
      <div class="barcode-bars">
        ${barsHtml}
      </div>
      <div class="barcode-str">${displayBarcode}</div>
    </div>
    <div class="price-box">
      ${mrpPrice !== price ? `<span class="mrp">MRP: ₹${mrpPrice}</span>` : ""}
      <span class="price">Price: ₹${price}</span>
    </div>
  </div>
</body>
</html>`;

      // Try opening standalone print window (Ideal for thermal barcode printers like TSC TE244)
      const printWin = window.open("", "_blank", "width=500,height=500");
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          printWin.close();
        }, 300);
      } else {
        // Fallback if popups blocked: print using iframe
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.width = "400px";
        iframe.style.height = "400px";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }, 300);
        }
      }

      toast.success(`Printing Barcode Tag (${tagWidth}x${tagHeight}mm)`);
    } catch (e: any) {
      const msg = sanitizeErrorMessage(e, "Failed to print barcode tag");
      toast.error(msg);
    }
  };

  return (
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

        {/* Printable Tag Container Preview */}
        <div className="flex justify-center p-4 bg-background border border-border rounded-2xl">
          <div
            className="bg-white text-black p-3 rounded-lg border border-border shadow-md flex flex-col justify-between items-center text-center select-none"
            style={{
              width: `${tagWidth * 5}px`,
              height: `${tagHeight * 5}px`,
            }}
          >
            <div className="w-full h-full flex flex-col justify-between items-center text-center">
              <div className="text-[10px] font-extrabold tracking-wider uppercase border-b border-black/20 pb-0.5 w-full truncate">
                {workspaceName}
              </div>

              <div className="my-1 w-full">
                <div className="text-xs font-bold leading-tight truncate max-w-[200px] mx-auto">
                  {product.name}
                </div>
                <div className="text-[9px] text-gray-600 font-mono mt-0.5">
                  SKU: {product.sku}
                </div>
              </div>

              {/* 32px Standard Code 128 Scanner Barcode Container */}
              <div className="w-full flex flex-col items-center my-1">
                <div className="flex items-center justify-center h-[32px] bg-white p-0.5 w-full max-w-[210px] rounded-sm overflow-hidden border border-black/10">
                  <div className="flex h-full items-center justify-center w-full px-1 bg-white">
                    {barcodeBars.map((isBar, idx) => (
                      <div
                        key={idx}
                        className="h-full flex-1"
                        style={{
                          minWidth: "1px",
                          backgroundColor: isBar ? "#000000" : "#ffffff",
                        }}
                      />
                    ))}
                  </div>
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
          <IconAction
            label="Print 32px Barcode Tag"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl gap-2 text-xs"
          />
        </div>
      </div>
    </div>
  );
}




