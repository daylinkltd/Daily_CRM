'use client';

import React from 'react';
import { Printer, Download, X, CheckCircle2, ReceiptText, Building2, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ReceiptItem {
  name: string;
  portion: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ThermalReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isProforma?: boolean;
  invoiceNumber: string;
  date: string;
  tableNumber: string;
  sectionName?: string;
  serverName?: string;
  paymentMethod?: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  items: ReceiptItem[];
}

export function ThermalReceiptModal({
  open,
  onOpenChange,
  isProforma = false,
  invoiceNumber,
  date,
  tableNumber,
  sectionName = 'Main Floor',
  serverName = 'Rahul M.',
  paymentMethod = 'CASH',
  subtotal,
  taxAmount,
  grandTotal,
  items,
}: ThermalReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            {isProforma ? 'Proforma Bill Preview' : 'Tax Invoice & Thermal Receipt'}
          </DialogTitle>
        </DialogHeader>

        {/* Printable Receipt Paper Container (80mm Thermal Style) */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4 bg-white text-black font-mono text-xs printable-receipt">
          {/* Header */}
          <div className="text-center space-y-1 border-b border-dashed border-gray-300 pb-3">
            <h2 className="font-bold text-base tracking-tight uppercase">DAILY CRM BAR & RESTAURANT</h2>
            <p className="text-[11px] text-gray-600">No. 420 MG Road, Brigade Junction, Bengaluru</p>
            <p className="text-[10px] text-gray-600">GSTIN: 29AAAAA0000A1Z5 | FSSAI: 11223344556677</p>
            <p className="text-[10px] text-gray-600">CL-9 Excise Permit: EX-KA-2026-9081</p>
            
            <div className="pt-2">
              <span className="inline-block px-3 py-1 font-bold text-xs bg-gray-100 text-gray-900 rounded border border-gray-300">
                INVOICE
              </span>
            </div>
          </div>

          {/* Meta Table Details */}
          <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-dashed border-gray-300 pb-3">
            <div>
              <span className="text-gray-500">Bill No: </span>
              <span className="font-bold">{invoiceNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Date: </span>
              <span>{date}</span>
            </div>
            <div>
              <span className="text-gray-500">Table: </span>
              <span className="font-bold">{tableNumber} ({sectionName})</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Server: </span>
              <span>{serverName}</span>
            </div>
            <div>
              <span className="text-gray-500">Payment: </span>
              <span className="font-bold uppercase">{isProforma ? 'UNPAID' : paymentMethod}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-left text-[11px] border-b border-dashed border-gray-300 pb-3">
            <thead>
              <tr className="border-b border-gray-300 font-bold">
                <th className="py-1">ITEM & PORTION</th>
                <th className="py-1 text-center">QTY</th>
                <th className="py-1 text-right">RATE</th>
                <th className="py-1 text-right">AMT (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 font-medium max-w-[140px] truncate">
                    {item.name}
                    <span className="block text-[9px] text-gray-500 font-normal">({item.portion})</span>
                  </td>
                  <td className="py-1.5 text-center font-bold">{item.qty}</td>
                  <td className="py-1.5 text-right">₹{item.unitPrice}</td>
                  <td className="py-1.5 text-right font-bold">₹{item.totalPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Tax Calculations */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>CGST @ 9.0%</span>
              <span>₹{Math.round(taxAmount / 2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>SGST @ 9.0%</span>
              <span>₹{Math.round(taxAmount / 2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-400 text-black">
              <span>GRAND TOTAL</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-gray-500 pt-3 border-t border-dashed border-gray-300 space-y-0.5">
            <p className="font-semibold text-gray-800">Thank you for dining with us!</p>
            <p>Please visit again · Have a wonderful day</p>
            <p className="font-mono text-[9px] text-gray-400">Powered by Daily CRM Hospitality Platform</p>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="text-xs font-bold bg-primary">
              <Printer className="size-4 mr-1.5" />
              Print Receipt (80mm)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
