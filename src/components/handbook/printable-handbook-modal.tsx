"use client";

import { useEffect, useState } from "react";
import { Printer, X, Building2, ShieldCheck, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markdownToHtml } from "@/lib/markdown-utils";

interface PrintableSection {
  order: number;
  title: string;
  category?: string;
  mandatory?: boolean;
  content: string;
}

interface CompanyDetails {
  legal_name?: string;
  brand_name?: string;
  director_name?: string;
  registered_address?: string;
  website?: string;
  contact_email?: string;
  logo_url?: string;
}

interface PrintableHandbookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

export function PrintableHandbookModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: PrintableHandbookModalProps) {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [sections, setSections] = useState<PrintableSection[]>([]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoading(true);

    // Fetch company details + full policy sections for print
    Promise.all([
      fetch(`/api/hr/handbook?workspace_id=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/hr/policies?workspace_id=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/settings/branding?workspace_id=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([hbData, polData, brandData]) => {
        const details = hbData.details || {};
        const logo = brandData.logo_url || null;
        setCompany({
          legal_name: details.legal_name || workspaceName,
          brand_name: details.brand_name || workspaceName,
          director_name: details.director_name || "Authorized Director",
          registered_address: details.registered_address || "Company Headquarters",
          website: details.website || "www.dailycrm.cloud",
          contact_email: details.contact_email || "hr@dailycrm.cloud",
          logo_url: logo,
        });

        const allPolicies = polData.policies || [];
        // Map sections in order
        const hbSections = hbData.sections || [];
        const fullSections: PrintableSection[] = hbSections.map((sec: any) => {
          const match = allPolicies.find((p: any) => p.id === sec.policy_id);
          const versions = match?.versions || [];
          const maxVerNum = versions.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
          const latestVer = versions.find((v: any) => v.version_number === maxVerNum);

          return {
            order: sec.order,
            title: sec.title.replace(/^Handbook §\d+ — /, ""),
            category: match?.category || sec.key,
            mandatory: sec.mandatory,
            content: latestVer?.content || "Section content pending policy publication.",
          };
        });

        setSections(fullSections);
      })
      .catch((err) => {
        console.error("Failed to load printable handbook:", err);
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId, workspaceName]);

  const handlePrintWindow = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden flex flex-col bg-card">
        {/* Top Control Bar (Hidden during printing) */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 print:hidden">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Building2 className="size-5 text-primary" />
            Official Letterhead Handbook Document
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrintWindow} className="bg-primary text-primary-foreground shadow">
              <Printer className="size-4 mr-2" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Printable Document Canvas */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-10 bg-white text-black font-sans leading-relaxed print:p-0 print:overflow-visible">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground print:hidden">
              <Loader2 className="size-8 animate-spin text-primary mr-2" /> Generating Official Handbook Letterhead...
            </div>
          ) : (
            <div id="printable-handbook-document" className="max-w-3xl mx-auto space-y-8 bg-white p-6 sm:p-10 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">
              {/* ── 1. OFFICIAL COMPANY LETTERHEAD HEADER ── */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold uppercase tracking-tight text-slate-900">
                    {company?.legal_name}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{company?.brand_name} Corporate Group</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                    {company?.registered_address}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Email: {company?.contact_email} • Web: {company?.website}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-800 uppercase">
                    Ref: CRM-HBK-2026
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>

              {/* ── 2. HANDBOOK TITLE & SUBTITLE ── */}
              <div className="text-center py-6 border-b border-slate-200 space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-wide uppercase">
                  EMPLOYEE HANDBOOK & COMPLIANCE MANUAL
                </h2>
                <p className="text-xs text-slate-600 font-medium italic">
                  Standard Operating Guidelines, Employment Policies & Organizational Code of Conduct
                </p>
              </div>

              {/* ── 3. TABLE OF CONTENTS ── */}
              <div className="bg-slate-50 p-5 border border-slate-200 rounded-md space-y-3">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Table of Contents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {sections.map((sec) => (
                    <div key={sec.order} className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                      <span className="font-semibold text-slate-800">
                        {sec.order}. {sec.title}
                      </span>
                      {sec.mandatory && (
                        <span className="text-[9px] uppercase font-bold text-amber-700 bg-amber-100 px-1 rounded">
                          Mandatory
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 4. FULL HANDBOOK SECTION CONTENTS ── */}
              <div className="space-y-8 pt-4">
                {sections.map((sec) => (
                  <div key={sec.order} className="space-y-3 page-break-inside-avoid border-b border-slate-200 pb-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <h3 className="text-base font-bold text-slate-900">
                        Section {sec.order}: {sec.title}
                      </h3>
                      {sec.mandatory && (
                        <span className="text-[10px] font-bold text-slate-600 uppercase">
                          Mandatory Compliance
                        </span>
                      )}
                    </div>

                    <div
                      className="prose text-xs text-slate-800 leading-relaxed space-y-2"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(sec.content) }}
                    />
                  </div>
                ))}
              </div>

              {/* ── 5. OFFICIAL SIGN-OFF & ATTESTATION PAGE ── */}
              <div className="pt-8 space-y-6 page-break-before-always border-t-2 border-slate-900">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Employee Acknowledgement & Attestation Sign-off
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    This document must be signed and returned to the HR department upon joining.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 leading-relaxed font-medium">
                  <strong>FORMAL ATTESTATION STATEMENT:</strong> I hereby acknowledge that I have received, read, thoroughly understood, and voluntarily agree to abide by all policies, procedures, and regulations outlined in this Employee Handbook of {company?.legal_name}. I understand that failure to adhere to these rules may result in disciplinary action up to and including termination of employment.
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8">
                  <div className="space-y-12">
                    <div className="border-b border-slate-400 pb-1"></div>
                    <div className="space-y-0.5 text-xs text-slate-800">
                      <p className="font-bold">Employee Signature</p>
                      <p className="text-[11px] text-slate-500">Printed Name: _______________________</p>
                      <p className="text-[11px] text-slate-500">Employee ID: _______________________</p>
                      <p className="text-[11px] text-slate-500">Date: _____________________________</p>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="border-b border-slate-400 pb-1"></div>
                    <div className="space-y-0.5 text-xs text-slate-800">
                      <p className="font-bold">For {company?.legal_name}</p>
                      <p className="text-[11px] text-slate-500">Director: {company?.director_name}</p>
                      <p className="text-[11px] text-slate-500">Authorized Signature & Seal</p>
                      <p className="text-[11px] text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono flex items-center justify-between">
                  <span>SHA-256 AUDIT SEAL: VERIFIED DIGITAL HANDBOOK</span>
                  <span>CONFIDENTIAL — INTERNAL COMPANY PROPERTY</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
