"use client";

import React from "react";
import { Printer, Download, Building2, CheckCircle2 } from "lucide-react";
import { numberToWordsIndian } from "@/lib/utils/number-to-words";
import { calculateGst } from "@/lib/commerce/gst/gst-calculator";

export interface GstInvoiceItem {
  id?: string;
  description: string;
  hsn_sac?: string;
  qty: number;
  unit_price: number;
  gst_rate: number; // e.g. 18
  is_tax_inclusive?: boolean;
}

export interface GstTaxInvoiceProps {
  // Seller (Your Company) Details
  seller: {
    name: string;
    logo_url?: string | null;
    address: string;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    state_code?: string | null;
    pan?: string | null;
  };
  // Buyer Details
  buyer: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    state_code?: string | null;
  };
  // Invoice Meta
  invoice: {
    number: string;
    date: string;
    due_date?: string | null;
    place_of_supply?: string | null;
    reverse_charge?: boolean;
    irn?: string | null;
  };
  // Line Items
  items: GstInvoiceItem[];
  // Bank Details (Optional)
  bankDetails?: {
    account_name?: string;
    account_number?: string;
    bank_name?: string;
    ifsc_code?: string;
    branch?: string;
  };
  // Terms
  terms?: string[];
  onClose?: () => void;
}

export function GstTaxInvoiceTemplate({
  seller,
  buyer,
  invoice,
  items,
  bankDetails,
  terms,
  onClose,
}: GstTaxInvoiceProps) {
  const sellerState = seller.state_code || "27"; // Default Maharashtra if omitted
  const buyerState = buyer.state_code || (buyer.gstin ? buyer.gstin.slice(0, 2) : sellerState);
  const isInterstate = sellerState !== buyerState;

  // Process items & calculate GST
  const processedItems = items.map((item) => {
    const baseAmount = item.qty * item.unit_price;
    const gstRes = calculateGst({
      baseAmount,
      gstRate: item.gst_rate,
      isTaxInclusive: item.is_tax_inclusive,
      sourceStateCode: sellerState,
      destinationStateCode: buyerState,
    });
    return {
      ...item,
      taxableAmount: gstRes.taxableAmount,
      cgstRate: gstRes.cgstRate,
      cgstAmount: gstRes.cgstAmount,
      sgstRate: gstRes.sgstRate,
      sgstAmount: gstRes.sgstAmount,
      igstRate: gstRes.igstRate,
      igstAmount: gstRes.igstAmount,
      totalAmount: gstRes.totalAmount,
    };
  });

  const totalTaxable = processedItems.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalCgst = processedItems.reduce((sum, item) => sum + item.cgstAmount, 0);
  const totalSgst = processedItems.reduce((sum, item) => sum + item.sgstAmount, 0);
  const totalIgst = processedItems.reduce((sum, item) => sum + item.igstAmount, 0);
  const grandTotal = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-slate-900 font-sans p-6 sm:p-10 rounded-lg shadow-xl print:shadow-none print:p-0 print:m-0 border border-slate-200">
      {/* Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded border border-emerald-300">
            GST Compliant Format
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Printer className="size-4" /> Print Tax Invoice
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 px-3 py-2 rounded-lg"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Invoice Document Box */}
      <div className="border border-slate-800 rounded-sm">
        {/* Header Title */}
        <div className="bg-slate-900 text-white text-center py-2 border-b border-slate-800">
          <h1 className="text-base font-bold uppercase tracking-widest">TAX INVOICE</h1>
        </div>

        {/* Seller & Invoice Meta Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-800 text-xs">
          {/* Seller Details */}
          <div className="p-4 border-r border-slate-800 space-y-1">
            {seller.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={seller.logo_url}
                alt="Company Logo"
                className="h-10 max-w-[180px] object-contain mb-2"
              />
            )}
            <h2 className="font-bold text-sm uppercase text-slate-900">{seller.name}</h2>
            <p className="text-slate-600 leading-snug">{seller.address}</p>
            <div className="pt-1 space-y-0.5 font-medium text-slate-800">
              {seller.gstin && <p><span className="font-bold text-slate-900">GSTIN:</span> {seller.gstin}</p>}
              {seller.pan && <p><span className="font-bold text-slate-900">PAN:</span> {seller.pan}</p>}
              <p><span className="font-bold text-slate-900">State Code:</span> {sellerState}</p>
              {seller.phone && <p><span>Phone:</span> {seller.phone}</p>}
              {seller.email && <p><span>Email:</span> {seller.email}</p>}
            </div>
          </div>

          {/* Invoice Meta Data */}
          <div className="p-4 space-y-2 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block text-[11px]">Invoice Number:</span>
                <span className="font-bold text-slate-900 text-sm">{invoice.number}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Invoice Date:</span>
                <span className="font-bold text-slate-900">{invoice.date}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Place of Supply:</span>
                <span className="font-semibold text-slate-800">
                  {invoice.place_of_supply || buyerState}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Reverse Charge:</span>
                <span className="font-semibold text-slate-800">
                  {invoice.reverse_charge ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {invoice.irn && (
              <div className="pt-1 border-t border-slate-200 text-[10px]">
                <span className="text-slate-500 block font-mono">IRN:</span>
                <span className="font-mono text-slate-700 break-all">{invoice.irn}</span>
              </div>
            )}
          </div>
        </div>

        {/* Buyer (Billed To) Details */}
        <div className="p-4 border-b border-slate-800 bg-slate-50/30 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wide mb-1 text-[11px] text-slate-500">
            Details of Buyer | Billed To:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold text-sm text-slate-900">{buyer.name}</p>
              {buyer.address && <p className="text-slate-600 mt-0.5">{buyer.address}</p>}
            </div>
            <div className="space-y-0.5 font-medium text-slate-800">
              <p>
                <span className="font-bold text-slate-900">GSTIN / UIN:</span>{" "}
                {buyer.gstin || "URP (Unregistered)"}
              </p>
              <p>
                <span className="font-bold text-slate-900">State & Code:</span> {buyerState}
              </p>
              {buyer.phone && <p><span>Phone:</span> {buyer.phone}</p>}
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                <th className="p-2.5 text-center border-r border-slate-700 w-10">#</th>
                <th className="p-2.5 border-r border-slate-700">Item & Description</th>
                <th className="p-2.5 text-center border-r border-slate-700 w-20">HSN/SAC</th>
                <th className="p-2.5 text-center border-r border-slate-700 w-14">Qty</th>
                <th className="p-2.5 text-right border-r border-slate-700 w-24">Rate (₹)</th>
                <th className="p-2.5 text-right border-r border-slate-700 w-28">Taxable (₹)</th>
                {!isInterstate ? (
                  <>
                    <th className="p-2.5 text-right border-r border-slate-700 w-20">CGST</th>
                    <th className="p-2.5 text-right border-r border-slate-700 w-20">SGST</th>
                  </>
                ) : (
                  <th className="p-2.5 text-right border-r border-slate-700 w-24">IGST</th>
                )}
                <th className="p-2.5 text-right w-28">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {processedItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-2.5 text-center border-r border-slate-300">{idx + 1}</td>
                  <td className="p-2.5 font-medium text-slate-900 border-r border-slate-300">
                    {item.description}
                  </td>
                  <td className="p-2.5 text-center border-r border-slate-300 font-mono text-[11px]">
                    {item.hsn_sac || "7113"}
                  </td>
                  <td className="p-2.5 text-center border-r border-slate-300">{item.qty}</td>
                  <td className="p-2.5 text-right border-r border-slate-300">
                    ₹{item.unit_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right border-r border-slate-300 font-medium">
                    ₹{item.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  {!isInterstate ? (
                    <>
                      <td className="p-2.5 text-right border-r border-slate-300 text-[11px]">
                        <div>₹{item.cgstAmount.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">({item.cgstRate}%)</div>
                      </td>
                      <td className="p-2.5 text-right border-r border-slate-300 text-[11px]">
                        <div>₹{item.sgstAmount.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">({item.sgstRate}%)</div>
                      </td>
                    </>
                  ) : (
                    <td className="p-2.5 text-right border-r border-slate-300 text-[11px]">
                      <div>₹{item.igstAmount.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">({item.igstRate}%)</div>
                    </td>
                  )}
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    ₹{item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals Summary Row */}
            <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-50">
              <tr>
                <td colSpan={5} className="p-2.5 text-right border-r border-slate-300">
                  Total Taxable Amount:
                </td>
                <td className="p-2.5 text-right border-r border-slate-300">
                  ₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                {!isInterstate ? (
                  <>
                    <td className="p-2.5 text-right border-r border-slate-300">
                      ₹{totalCgst.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right border-r border-slate-300">
                      ₹{totalSgst.toFixed(2)}
                    </td>
                  </>
                ) : (
                  <td className="p-2.5 text-right border-r border-slate-300">
                    ₹{totalIgst.toFixed(2)}
                  </td>
                )}
                <td className="p-2.5 text-right text-sm text-slate-900">
                  ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="p-3 border-t border-slate-800 bg-slate-100/60 text-xs">
          <span className="font-bold text-slate-700">Invoice Amount in Words: </span>
          <span className="font-bold text-slate-900 italic">
            {numberToWordsIndian(grandTotal)}
          </span>
        </div>

        {/* Bank Details & Signature Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-slate-800 text-xs">
          {/* Bank & Payment Terms */}
          <div className="p-4 border-r border-slate-800 space-y-2">
            {bankDetails && (
              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                  Bank Account Details
                </h4>
                <div className="text-slate-700 space-y-0.5 text-[11px]">
                  {bankDetails.account_name && <p>Account Name: {bankDetails.account_name}</p>}
                  {bankDetails.bank_name && <p>Bank Name: {bankDetails.bank_name}</p>}
                  {bankDetails.account_number && <p>A/C No: {bankDetails.account_number}</p>}
                  {bankDetails.ifsc_code && <p>IFSC Code: {bankDetails.ifsc_code}</p>}
                </div>
              </div>
            )}
            {terms && terms.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                  Terms & Conditions
                </h4>
                <ul className="list-disc list-inside text-[10.5px] text-slate-600 space-y-0.5">
                  {terms.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Signature Box */}
          <div className="p-4 flex flex-col justify-between text-right space-y-8">
            <span className="font-bold text-slate-900 text-xs">
              For {seller.name.toUpperCase()}
            </span>
            <div className="pt-8">
              <div className="inline-block border-t border-slate-800 pt-1 w-48 text-center text-[11px] font-semibold text-slate-700">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
