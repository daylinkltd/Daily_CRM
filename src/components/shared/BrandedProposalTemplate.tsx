"use client";

import React from "react";
import { formatCurrency } from "@/lib/currency";

export interface QuotationLineItemData {
  id?: string;
  name: string;
  description?: string | null;
  pricing_type?: "one_time" | "monthly" | "yearly";
  price: number;
  qty: number;
  is_free?: boolean;
}

export interface QuotationSectionData {
  id?: string;
  title: string;
  position?: number;
  items: QuotationLineItemData[];
}

export interface BrandedProposalProps {
  // Company / Workspace Info
  workspace: {
    logo_url?: string | null;
    company_name?: string | null;
    company_tagline?: string | null;
    company_address?: string | null;
    company_phone?: string | null;
    company_email?: string | null;
  };
  // Client Info
  client: {
    name: string;
    company?: string | null;
    address?: string | null;
  };
  // Proposal Details
  proposal: {
    quotation_id: string;
    document_title: string;
    document_subtitle?: string | null;
    date_created: string;
    valid_until?: string | null;
    version?: string | number;
    notes_terms?: string | null;
  };
  // Content Sections
  sections: QuotationSectionData[];
  // Preset Style ("daylink_standard" | "milestone_itemized")
  layoutPreset?: "daylink_standard" | "milestone_itemized";
  // Tax Options
  taxMode?: "gst_split" | "igst" | "exempt";
  taxRatePercent?: number;
}

export function BrandedProposalTemplate({
  workspace,
  client,
  proposal,
  sections,
  layoutPreset = "daylink_standard",
  taxMode = "gst_split",
  taxRatePercent = 18,
}: BrandedProposalProps) {
  // Calculate Totals
  let oneTimeSubtotal = 0;
  let monthlySubtotal = 0;
  let yearlySubtotal = 0;

  sections.forEach((sec) => {
    sec.items.forEach((item) => {
      if (item.is_free) return;
      const lineTotal = item.price * (item.qty || 1);
      if (item.pricing_type === "monthly") {
        monthlySubtotal += lineTotal;
      } else if (item.pricing_type === "yearly") {
        yearlySubtotal += lineTotal;
      } else {
        oneTimeSubtotal += lineTotal;
      }
    });
  });

  // Calculate Tax Split
  let taxRateLabel = `${taxRatePercent}% GST`;
  let oneTimeTax = 0;
  let sgstTax = 0;
  let cgstTax = 0;
  let igstTax = 0;

  if (taxMode === "gst_split") {
    cgstTax = oneTimeSubtotal * (taxRatePercent / 2 / 100);
    sgstTax = oneTimeSubtotal * (taxRatePercent / 2 / 100);
    oneTimeTax = cgstTax + sgstTax;
  } else if (taxMode === "igst") {
    igstTax = oneTimeSubtotal * (taxRatePercent / 100);
    oneTimeTax = igstTax;
  }

  const oneTimeGrandTotal = oneTimeSubtotal + oneTimeTax;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-slate-900 font-sans p-6 sm:p-12 shadow-lg rounded-sm border border-slate-200 print:shadow-none print:p-0 print:border-none">
      {/* Header Letterhead */}
      <div className="flex flex-col items-center justify-center text-center pb-6 border-b-2 border-[#00aef0]">
        {workspace.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workspace.logo_url}
            alt={workspace.company_name || "Company Logo"}
            className="h-20 max-w-[320px] object-contain mb-2"
          />
        ) : (
          <div className="text-center mb-1">
            <h1 className="text-2xl font-bold tracking-wider text-[#00aef0] uppercase">
              {workspace.company_name || "DAYLINK TECH LABS PRIVATE LIMITED"}
            </h1>
            {workspace.company_tagline && (
              <p className="text-xs text-slate-500 tracking-widest font-semibold uppercase mt-0.5">
                {workspace.company_tagline}
              </p>
            )}
          </div>
        )}

        <div className="text-xs text-slate-500 space-y-0.5">
          <p>{workspace.company_address || "21/1, KHB, AUTO NAGAR, BELAGAVI - 590016"}</p>
          <p className="flex items-center justify-center gap-3">
            {workspace.company_phone && <span>{workspace.company_phone}</span>}
            {workspace.company_phone && workspace.company_email && <span>|</span>}
            {workspace.company_email && <span>{workspace.company_email}</span>}
          </p>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center space-y-1 py-4">
        <h2 className="text-xl font-extrabold tracking-wide text-slate-900 uppercase">
          {proposal.document_title || "COMMERCIAL PROPOSAL"}
        </h2>
        {proposal.document_subtitle && (
          <p className="text-xs font-semibold text-[#00aef0]">
            {proposal.document_subtitle}
          </p>
        )}
      </div>

      {/* Proposal Metadata Box */}
      <div className="border border-slate-800 rounded-sm overflow-hidden text-xs mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase">
              <th className="p-2.5 border-r border-slate-700 w-1/4">Prepared for</th>
              <th className="p-2.5 border-r border-slate-700 w-1/4">Quotation No</th>
              <th className="p-2.5 border-r border-slate-700 w-1/4">Date</th>
              <th className="p-2.5 w-1/4">Version</th>
            </tr>
          </thead>
          <tbody>
            <tr className="divide-x divide-slate-300 font-medium bg-slate-50">
              <td className="p-2.5 font-bold text-slate-900">
                {client.company || client.name}
              </td>
              <td className="p-2.5 text-slate-800 font-mono">
                {proposal.quotation_id}
              </td>
              <td className="p-2.5 text-slate-800">
                {proposal.date_created}
              </td>
              <td className="p-2.5 text-slate-800">
                {proposal.version || "1.0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section Content & Tables */}
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-3 mb-8">
          <div className="border-b border-[#00aef0] pb-1">
            <h3 className="text-sm font-bold text-[#00aef0] uppercase tracking-wide">
              {idx + 1}. {section.title}
            </h3>
          </div>

          {section.items && section.items.length > 0 ? (
            <div className="border border-slate-800 rounded-sm overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-2.5 text-center border-r border-slate-700 w-12">Sr No.</th>
                    <th className="p-2.5 border-r border-slate-700">Description</th>
                    {layoutPreset === "milestone_itemized" ? (
                      <>
                        <th className="p-2.5 text-right border-r border-slate-700 w-24">Amount (₹)</th>
                        <th className="p-2.5 text-right border-r border-slate-700 w-24">GST (18%)</th>
                        <th className="p-2.5 text-right w-28">Total (₹)</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2.5 text-center border-r border-slate-700 w-28">Billing Type</th>
                        <th className="p-2.5 text-right w-32">Amount (INR)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {section.items.map((item, lineIdx) => {
                    const lineVal = item.price * (item.qty || 1);
                    const lineGst = lineVal * 0.18;
                    return (
                      <tr key={lineIdx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center border-r border-slate-300 font-medium">
                          {lineIdx + 1}
                        </td>
                        <td className="p-2.5 border-r border-slate-300">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          {item.description && (
                            <p className="text-slate-600 text-[11px] mt-0.5">{item.description}</p>
                          )}
                        </td>
                        {layoutPreset === "milestone_itemized" ? (
                          <>
                            <td className="p-2.5 text-right border-r border-slate-300">
                              ₹{lineVal.toLocaleString("en-IN")}
                            </td>
                            <td className="p-2.5 text-right border-r border-slate-300 text-slate-600">
                              ₹{lineGst.toLocaleString("en-IN")}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              ₹{(lineVal + lineGst).toLocaleString("en-IN")}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2.5 text-center border-r border-slate-300 font-semibold capitalize text-slate-700">
                              {item.pricing_type === "monthly"
                                ? "Monthly"
                                : item.pricing_type === "yearly"
                                ? "Yearly"
                                : "One-Time"}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {item.is_free
                                ? "Included"
                                : `₹ ${lineVal.toLocaleString("en-IN")}${
                                    item.pricing_type === "monthly" ? " / month" : ""
                                  }`}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No line items in this section.</p>
          )}
        </div>
      ))}

      {/* Tax & Summary Calculation Block */}
      <div className="border border-slate-800 rounded-sm overflow-hidden text-xs mb-8">
        <div className="bg-slate-900 text-white font-bold p-2.5 uppercase tracking-wide">
          Commercial Summary &amp; Taxes ({taxRateLabel})
        </div>
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-slate-300">
            <tr>
              <td className="p-2.5 font-bold text-slate-700 border-r border-slate-300">
                Total One-Time Project Cost
              </td>
              <td className="p-2.5 text-right font-bold text-slate-900 w-44">
                ₹ {oneTimeSubtotal.toLocaleString("en-IN")}
              </td>
            </tr>
            {taxMode === "gst_split" && (
              <>
                <tr>
                  <td className="p-2.5 text-slate-600 border-r border-slate-300">
                    Add: SGST ({taxRatePercent / 2}%)
                  </td>
                  <td className="p-2.5 text-right text-slate-700 w-44">
                    ₹ {sgstTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 text-slate-600 border-r border-slate-300">
                    Add: CGST ({taxRatePercent / 2}%)
                  </td>
                  <td className="p-2.5 text-right text-slate-700 w-44">
                    ₹ {cgstTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            )}
            {taxMode === "igst" && (
              <tr>
                <td className="p-2.5 text-slate-600 border-r border-slate-300">
                  Add: IGST ({taxRatePercent}%)
                </td>
                <td className="p-2.5 text-right text-slate-700 w-44">
                  ₹ {igstTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
            <tr className="bg-slate-100 font-bold">
              <td className="p-2.5 text-slate-900 border-r border-slate-300">
                Grand Total (Inclusive of One-Time Taxes)
              </td>
              <td className="p-2.5 text-right text-sm text-slate-900 w-44">
                ₹ {oneTimeGrandTotal.toLocaleString("en-IN")}
              </td>
            </tr>
            {monthlySubtotal > 0 && (
              <tr className="bg-emerald-50/60 font-bold text-emerald-900">
                <td className="p-2.5 border-r border-slate-300">
                  Total Monthly Recurring Cost (Excl. GST)
                </td>
                <td className="p-2.5 text-right w-44">
                  ₹ {monthlySubtotal.toLocaleString("en-IN")} / month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Terms & Conditions */}
      {proposal.notes_terms && (
        <div className="space-y-2 border-t border-slate-200 pt-4 text-xs">
          <h4 className="font-bold text-[#00aef0] uppercase tracking-wide">
            TERMS &amp; CONDITIONS
          </h4>
          <div className="text-slate-600 whitespace-pre-line leading-relaxed">
            {proposal.notes_terms}
          </div>
        </div>
      )}
    </div>
  );
}
