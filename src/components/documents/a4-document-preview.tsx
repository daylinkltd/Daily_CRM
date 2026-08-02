"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/markdown-utils";

interface LetterheadConfig {
  company_name?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  watermark_logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  brand_theme?: "minimal" | "corporate" | "government" | "education" | "medical";
  paper_size?: "A4" | "Letter";
  page_margin?: "compact" | "normal" | "wide";
  font_family?: string;
  show_watermark?: boolean;
  watermark_opacity?: number;
  logo_position?: "left" | "center" | "right";
  logo_height?: number;
  company_name_size?: number;
  header_layout_style?: "standard" | "centered" | "split";
  tax_id?: string | null;
  company_address?: string | null;
}

interface SignatoryData {
  name: string;
  designation: string;
  department?: string;
  signature_url?: string | null;
  stamp_url?: string | null;
}

interface A4DocumentPreviewProps {
  letterhead?: LetterheadConfig | null;
  bodyHtml: string;
  documentNumber?: string;
  date?: string;
  recipientName?: string;
  signatory?: SignatoryData | null;
  className?: string;
}

export const A4DocumentPreview = forwardRef<HTMLDivElement, A4DocumentPreviewProps>(
  function A4DocumentPreview(
    {
      letterhead,
      bodyHtml,
      documentNumber = "DOC-2026-00001",
      date = new Date().toLocaleDateString(),
      recipientName = "Recipient",
      signatory,
      className,
    },
    ref
  ) {
    const primaryColor = letterhead?.primary_color || "#0284c7";
    const brandTheme = letterhead?.brand_theme || "corporate";
    const paperSize = letterhead?.paper_size || "A4";

    const logoPosition = letterhead?.logo_position || "left";
    const logoHeight = letterhead?.logo_height || 64;
    const companyNameSize = letterhead?.company_name_size || 20;
    const headerLayoutStyle = letterhead?.header_layout_style || "standard";

    const marginClasses = {
      compact: "p-6 sm:p-8",
      normal: "p-8 sm:p-12",
      wide: "p-10 sm:p-16",
    }[letterhead?.page_margin || "normal"];

    return (
      <div
        ref={ref}
        style={{ fontFamily: letterhead?.font_family || "Inter, sans-serif" }}
        className={cn(
          "relative bg-white text-slate-900 shadow-2xl mx-auto overflow-hidden print:shadow-none print:m-0 print:w-full print:max-w-none print:rounded-none transition-all",
          paperSize === "A4" ? "w-full max-w-[210mm] min-h-[297mm]" : "w-full max-w-[8.5in] min-h-[11in]",
          marginClasses,
          className
        )}
      >
        {/* Top Decorative Theme Bar */}
        {brandTheme === "corporate" && (
          <div
            className="absolute top-0 left-0 right-0 h-3"
            style={{ backgroundColor: primaryColor }}
          />
        )}
        {brandTheme === "government" && (
          <div
            className="absolute top-0 left-0 right-0 h-4 border-b-2 border-amber-600"
            style={{ backgroundColor: primaryColor }}
          />
        )}

        {/* Optional Central Background Watermark */}
        {letterhead?.show_watermark && letterhead.watermark_logo_url && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
            style={{ opacity: letterhead.watermark_opacity || 0.05 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={letterhead.watermark_logo_url}
              alt="Watermark"
              className="max-w-[60%] max-h-[60%] object-contain"
            />
          </div>
        )}

        {/* Dynamic Letterhead Header Section */}
        {headerLayoutStyle === "centered" ? (
          <header 
            className="relative z-10 border-b-2 pb-6 mb-8 text-center space-y-3"
            style={{ borderColor: primaryColor }}
          >
            <div className="flex flex-col items-center justify-center gap-2">
              {letterhead?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={letterhead.logo_url}
                  alt="Logo"
                  style={{ height: `${logoHeight}px` }}
                  className="w-auto object-contain max-w-[240px]"
                />
              ) : (
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {(letterhead?.company_name || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2
                  className="font-extrabold tracking-tight"
                  style={{ fontSize: `${companyNameSize}px`, color: primaryColor }}
                >
                  {letterhead?.company_name || "Company Legal Name"}
                </h2>
                {letterhead?.tagline && (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{letterhead.tagline}</p>
                )}
                {letterhead?.tax_id && (
                  <p className="text-[11px] font-mono font-semibold text-slate-600 mt-1">
                    GSTIN / Tax ID: <span className="text-slate-900">{letterhead.tax_id}</span>
                  </p>
                )}
                {letterhead?.company_address && (
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-lg mx-auto">{letterhead.company_address}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 font-mono border-t border-slate-100 pt-3 mt-3">
              <div>
                <span className="font-semibold uppercase text-[10px]" style={{ color: primaryColor }}>Ref: </span>
                <span className="font-bold text-slate-900">{documentNumber}</span>
              </div>
              <div>
                <span className="font-semibold uppercase text-[10px]" style={{ color: primaryColor }}>Date: </span>
                <span>{date}</span>
              </div>
            </div>
          </header>
        ) : (
          <header 
            className="relative z-10 border-b-2 pb-6 mb-8 flex items-start justify-between gap-6"
            style={{ borderColor: primaryColor }}
          >
            <div
              className={cn(
                "flex items-center gap-4 flex-1",
                logoPosition === "center" && "justify-center text-center",
                logoPosition === "right" && "flex-row-reverse text-right"
              )}
            >
              {letterhead?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={letterhead.logo_url}
                  alt="Logo"
                  style={{ height: `${logoHeight}px` }}
                  className="w-auto object-contain max-w-[220px]"
                />
              ) : (
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {(letterhead?.company_name || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2
                  className="font-extrabold tracking-tight leading-tight"
                  style={{ fontSize: `${companyNameSize}px`, color: primaryColor }}
                >
                  {letterhead?.company_name || "Company Legal Name"}
                </h2>
                {letterhead?.tagline && (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{letterhead.tagline}</p>
                )}
                {letterhead?.tax_id && (
                  <p className="text-[11px] font-mono font-semibold text-slate-600 mt-1">
                    GSTIN / Tax ID: <span className="text-slate-900">{letterhead.tax_id}</span>
                  </p>
                )}
                {letterhead?.company_address && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{letterhead.company_address}</p>
                )}
              </div>
            </div>

            {/* Document Reference Box */}
            <div className="text-right text-xs text-slate-600 space-y-1 font-mono shrink-0">
              <div>
                <span className="font-semibold uppercase text-[10px] block" style={{ color: primaryColor }}>Document Ref</span>
                <span className="font-bold text-slate-900">{documentNumber}</span>
              </div>
              <div>
                <span className="font-semibold uppercase text-[10px] block" style={{ color: primaryColor }}>Date</span>
                <span>{date}</span>
              </div>
            </div>
          </header>
        )}

        {/* Document Main Content Body */}
        <main className="relative z-10 min-h-[450px] space-y-4 text-slate-800 text-sm leading-relaxed">
          <div
            className="rich-text max-w-none"
            dangerouslySetInnerHTML={{
              __html: bodyHtml
                ? sanitizeHtml(bodyHtml)
                : "<p>Write your document body content here...</p>",
            }}
          />
        </main>

        {/* Signatory & Corporate Stamp Footer Block */}
        <footer className="relative z-10 mt-12 pt-8 border-t border-slate-100 flex items-end justify-between gap-6">
          <div className="text-xs text-slate-400 font-mono">
            <p>Issued by {letterhead?.company_name || "Organization"}</p>
            <p className="text-[10px] mt-0.5">Verified Official Document</p>
          </div>

          <div className="flex items-center gap-6 text-right">
            {/* Corporate Stamp */}
            {signatory?.stamp_url && (
              <div className="opacity-90">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatory.stamp_url}
                  alt="Seal Stamp"
                  className="h-16 w-16 object-contain"
                />
              </div>
            )}

            {/* Signature & Name */}
            <div className="space-y-1">
              {signatory?.signature_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatory.signature_url}
                  alt="Signature"
                  className="h-12 w-auto ml-auto object-contain"
                />
              ) : (
                <div className="h-10 border-b border-slate-300 w-32 ml-auto" />
              )}
              <p className="font-bold text-xs text-slate-900 mt-1">
                {signatory?.name || "Authorized Signatory"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {signatory?.designation || "Executive Officer"}
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }
);
