"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Printer,
  MessageSquare,
  CheckCircle,
  XCircle,
  Receipt,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import type { Quotation, QuotationSection, Contact } from "@/types";
import { Card } from "@/components/ui/card";
import { IconAction } from "@/components/ui/icon-action";
import { contactDisplayName } from "@/lib/contact-display";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SectionWithItems extends Omit<QuotationSection, "created_at" | "updated_at"> {
  items: any[];
}

export default function QuotationPreviewPage({ params }: PageProps) {
  const router = useRouter();
  const { id: quotationUuid } = React.use(params);
  const supabase = createClient();
  const { accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [client, setClient] = useState<Contact | null>(null);
  const [workspace, setWorkspace] = useState<{
    logo_url: string | null;
    company_name: string | null;
    company_tagline: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_website: string | null;
    company_address: string | null;
  } | null>(null);

  // Dynamic Tax Controls
  const [taxMode, setTaxMode] = useState<"gst_split" | "igst" | "exempt">("gst_split");
  const [taxRatePercent, setTaxRatePercent] = useState<number>(18);

  // Load quotation data
  const loadQuotation = async () => {
    if (!workspaceId || !quotationUuid) return;
    try {
      setLoading(true);

      // 1. Fetch Quote
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationUuid)
        .single();

      if (qErr || !qData) throw new Error("Quotation not found");
      setQuote(qData);

      // 2. Fetch Sections & Items
      const { data: secData, error: secErr } = await supabase
        .from("quotation_sections")
        .select(`
          *,
          items:quotation_line_items(*)
        `)
        .eq("quotation_id", quotationUuid)
        .order("position", { ascending: true });

      if (secErr) throw secErr;

      const sortedSecs = (secData || []).map((sec: any) => ({
        ...sec,
        items: (sec.items || []).sort((a: any, b: any) => a.position - b.position),
      }));
      setSections(sortedSecs);

      // 3. Fetch Client Contact
      if (qData.client_id) {
        const { data: clientData } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", qData.client_id)
          .single();
        setClient(clientData);
      }

      // 4. Fetch Workspace Branding
      if (workspaceId) {
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("logo_url, company_name, company_tagline, company_email, company_phone, company_website, company_address")
          .eq("id", workspaceId)
          .single();
        if (wsData) setWorkspace(wsData as any);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load quotation preview");
      router.push("/quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      loadQuotation();
    }
  }, [workspaceId, quotationUuid]);

  // Pricing & Dynamic GST calculations
  const totals = useMemo(() => {
    let oneTime = 0;
    let monthly = 0;
    let yearly = 0;

    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.is_free) return;
        const lineVal = item.price * item.qty;
        if (item.pricing_type === "one_time") {
          oneTime += lineVal;
        } else if (item.pricing_type === "monthly") {
          monthly += lineVal;
        } else if (item.pricing_type === "yearly") {
          yearly += lineVal;
        }
      });
    });

    let sgstRate = 0;
    let cgstRate = 0;
    let igstRate = 0;
    let sgstAmount = 0;
    let cgstAmount = 0;
    let igstAmount = 0;
    let totalTaxes = 0;

    if (taxMode === "gst_split") {
      sgstRate = taxRatePercent / 2;
      cgstRate = taxRatePercent / 2;
      sgstAmount = oneTime * (sgstRate / 100);
      cgstAmount = oneTime * (cgstRate / 100);
      totalTaxes = sgstAmount + cgstAmount;
    } else if (taxMode === "igst") {
      igstRate = taxRatePercent;
      igstAmount = oneTime * (igstRate / 100);
      totalTaxes = igstAmount;
    } else if (taxMode === "exempt") {
      totalTaxes = 0;
    }

    const grandTotalInclusive = oneTime + totalTaxes;

    const monthlyTaxAmount = monthly * (taxMode === "exempt" ? 0 : taxRatePercent / 100);
    const monthlyInclusive = monthly + monthlyTaxAmount;

    return {
      oneTime,
      monthly,
      yearly,
      sgstRate,
      cgstRate,
      igstRate,
      sgstAmount,
      cgstAmount,
      igstAmount,
      totalTaxes,
      grandTotalInclusive,
      monthlyInclusive,
      monthlyTaxAmount,
      recurring: monthly + (yearly / 12),
    };
  }, [sections, taxMode, taxRatePercent]);

  // Native Browser Print/PDF Export
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp Sharing Flow
  const handleWhatsAppSend = async () => {
    if (!quote || !client?.phone) {
      toast.error("Client phone number is missing");
      return;
    }

    setActionLoading(true);
    try {
      let conversationId = "";
      const { data: convData, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", client.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (convErr) throw convErr;

      if (convData) {
        conversationId = convData.id;
      } else {
        const { data: newConv, error: newConvErr } = await supabase
          .from("conversations")
          .insert({
            workspace_id: workspaceId,
            contact_id: client.id,
            status: "open",
          })
          .select()
          .single();

        if (newConvErr) throw newConvErr;
        conversationId = newConv.id;
      }

      const previewUrl = `${window.location.origin}/quotations/${quote.id}/preview`;
      const companyName = workspace?.company_name || "Daylink Tech Labs";
      const cName = contactDisplayName(client?.name, client?.phone, "Client");
      const msgText = `Hello ${cName},\n\nHere is your commercial proposal ${quote.quotation_id} for "${quote.document_title}" from ${companyName}:\n\n${previewUrl}\n\nPlease review and let us know if you have any questions!`;

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_type: "text",
          content_text: msgText,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "WhatsApp sending failed");

      if (quote.status === "Draft") {
        await supabase
          .from("quotations")
          .update({ status: "Sent" })
          .eq("id", quote.id);
        setQuote({ ...quote, status: "Sent" });
      }

      toast.success("Quotation link sent via WhatsApp!");
    } catch (err: any) {
      toast.error(err.message || "Failed to share via WhatsApp");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!quote || !workspaceId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          quotation_id: quote.id,
          contact_id: quote.client_id,
          deal_id: quote.deal_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      toast.success("Invoice created successfully");
      router.push(`/invoices/${data.invoice?.id || ""}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuotation = async () => {
    if (!quote || !workspaceId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: "Accepted" })
        .eq("id", quote.id);

      if (error) throw error;

      if (!quote.deal_id) {
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id")
          .eq("workspace_id", workspaceId)
          .limit(1);

        if (pipelines && pipelines.length > 0) {
          const { data: stages } = await supabase
            .from("pipeline_stages")
            .select("id, name")
            .eq("pipeline_id", pipelines[0].id)
            .order("position", { ascending: false });

          if (stages && stages.length > 0) {
            const clientName = contactDisplayName(client?.name, client?.phone, "Client");
            const dealTitle = `${quote.document_title} - ${clientName}`;

            const { data: newDeal, error: dealErr } = await supabase
              .from("deals")
              .insert({
                workspace_id: workspaceId,
                title: dealTitle,
                contact_id: quote.client_id,
                pipeline_id: pipelines[0].id,
                stage_id: stages[0].id,
                value: totals.oneTime,
                status: "won",
              })
              .select()
              .single();

            if (dealErr) throw dealErr;

            await supabase
              .from("quotations")
              .update({ deal_id: newDeal.id })
              .eq("id", quote.id);

            toast.success("Quotation accepted & new Won Deal created!");
          }
        }
      }

      loadQuotation();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept quotation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectQuotation = async () => {
    if (!quote) return;
    if (!confirm("Mark this quotation as Rejected?")) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: "Rejected" })
        .eq("id", quote.id);

      if (error) throw error;

      toast.success("Quotation marked as Rejected");
      loadQuotation();
    } catch {
      toast.error("Failed to reject quotation");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating branded commercial proposal...</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    Draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Viewed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    Expired: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  const clientNameSafe = contactDisplayName(client?.name, client?.phone, "Valued Client");
  const clientCompanySafe = client?.company || "";

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto animate-in fade-in-50 duration-200">
      {/* Print CSS styling */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          .print-content {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .page-break-before {
            page-break-before: always !important;
          }
          h1, h2, h3, h4, table {
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Action panel header (no-print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <IconAction
            label="Back"
            icon={<ArrowLeft className="size-4" />}
            variant="outline"
            onClick={() => router.push(`/quotations/${quote.id}/edit`)}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Commercial Proposal Preview
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[quote.status]}`}>
                {quote.status}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Official Daylink Tech Labs proposal document layout.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {quote.status !== "Accepted" && quote.status !== "Rejected" && (
            <>
              <IconAction label="Reject" icon={<XCircle className="size-4 " />} variant="outline"
                onClick={handleRejectQuotation}
                disabled={actionLoading}
                className="border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10" />
              <IconAction label="Accept & Convert" icon={<CheckCircle className="size-4 " />} onClick={handleAcceptQuotation}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground" />
            </>
          )}

          {quote.status === "Accepted" && (
            <IconAction label="Generate Invoice" icon={<Receipt className="size-4 " />} onClick={handleGenerateInvoice}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-foreground" />
          )}

          <IconAction label="WhatsApp" icon={<MessageSquare className="size-4 text-green-400" />} variant="outline"
            onClick={handleWhatsAppSend}
            disabled={actionLoading || !client?.phone}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted" />

          <IconAction label="Print / Export PDF" icon={<Printer className="size-4 " />} onClick={handlePrint}
            disabled={actionLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/95" />
        </div>
      </div>

      {/* Control panel for dynamic Tax Toggles (no-print) */}
      <div className="no-print p-4 border border-border bg-muted/30 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-muted-foreground">Dynamic Tax &amp; Billing Selector:</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Tax Type:</span>
            <select
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as any)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="gst_split">SGST + CGST (Intra-State / Within State)</option>
              <option value="igst">IGST (Inter-State / Outside State)</option>
              <option value="exempt">Exempt / SEZ / Zero-Rated (0% Tax)</option>
            </select>
          </div>

          {taxMode !== "exempt" && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Tax Rate:</span>
              <select
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value={18}>18% GST</option>
                <option value={12}>12% GST</option>
                <option value={5}>5% GST</option>
                <option value={28}>28% GST</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Printable Commercial Proposal Document */}
      <Card className="print-content border-border bg-card shadow-lg p-8 sm:p-12 text-foreground space-y-8 max-w-4xl mx-auto font-sans">
        {/* Header Letterhead Branding */}
        <div className="flex flex-col items-center justify-center text-center pb-6 border-b-2 border-[#00aef0]">
          {workspace?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.logo_url}
              alt={workspace.company_name || "Daylink Tech Labs"}
              className="h-20 sm:h-24 max-w-[400px] object-contain mb-2"
            />
          ) : (
            <div className="text-center mb-2">
              <h1 className="text-2xl font-bold tracking-wider text-[#00aef0] uppercase">
                DAYLINK TECH LABS PRIVATE LIMITED
              </h1>
              <p className="text-xs text-muted-foreground tracking-widest font-semibold uppercase mt-0.5">
                Empowering Your Digital Future
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{workspace?.company_address || "21/1, KHB, AUTO NAGAR, BELAGAVI - 590016"}</p>
            <p className="flex items-center justify-center gap-3">
              <span>{workspace?.company_phone || "9902319132 | 8050594245"}</span>
              <span>|</span>
              <span>{workspace?.company_email || "info@daylink.in"}</span>
            </p>
          </div>
        </div>

        {/* Commercial Proposal Title */}
        <div className="text-center space-y-1 py-2">
          <h2 className="text-xl font-extrabold tracking-wide text-foreground uppercase">
            COMMERCIAL PROPOSAL
          </h2>
          <p className="text-xs font-semibold text-[#00aef0]">
            {quote.document_subtitle || "Licensing, Compliance, Marketplace Onboarding & Digital Services"}
          </p>
        </div>

        {/* Proposal Header Metadata Table */}
        <div className="border border-border/80 rounded-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                <th className="p-2.5 border-r border-border/80 w-1/4">Prepared for</th>
                <th className="p-2.5 border-r border-border/80 w-1/4">Prepared by</th>
                <th className="p-2.5 border-r border-border/80 w-1/4">Date</th>
                <th className="p-2.5 w-1/4">Version</th>
              </tr>
            </thead>
            <tbody>
              <tr className="divide-x divide-border/80 font-medium">
                <td className="p-2.5 font-bold text-foreground">
                  {clientCompanySafe || clientNameSafe}
                </td>
                <td className="p-2.5 text-foreground">
                  {workspace?.company_name || "Daylink Tech Labs Pvt. Ltd."}
                </td>
                <td className="p-2.5 text-foreground">
                  {new Date(quote.date_created).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </td>
                <td className="p-2.5 text-foreground">
                  {quote.version}.0 (Revised)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 1: Proposal Overview */}
        <div className="space-y-2">
          <h3 className="font-bold text-sm uppercase text-[#00aef0] tracking-wider border-b border-border/40 pb-1">
            1. PROPOSAL OVERVIEW
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Daylink Tech Labs proposes to support <strong className="text-foreground">{clientCompanySafe || clientNameSafe}</strong> in formalizing its business structure, licensing compliance, marketplace onboarding, and digital presence. This engagement covers onboarding to Amazon &amp; Blinkit, website development, ongoing marketplace management, and monthly digital marketing services.
          </p>
        </div>

        {/* Section 2: Scope of Work Table */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm uppercase text-[#00aef0] tracking-wider border-b border-border/40 pb-1">
            2. SCOPE OF WORK
          </h3>

          <div className="border border-border/80 rounded-sm overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1e293b] text-white border-b border-border/80 text-[11px] font-bold uppercase">
                  <th className="p-2.5 border-r border-border/60 w-1/3">Service Area</th>
                  <th className="p-2.5 w-2/3">Scope Included</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sections.length > 0 ? (
                  sections.map((sec) => (
                    <React.Fragment key={sec.id}>
                      {sec.items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="p-2.5 border-r border-border/60 font-bold text-foreground align-top">
                            {item.name}
                          </td>
                          <td className="p-2.5 text-muted-foreground align-top leading-relaxed">
                            {item.description || "Scope included as specified in engagement terms."}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-muted-foreground italic">
                      No scope items configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Statutory Taxes & Financial Breakdown */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm uppercase text-[#00aef0] tracking-wider border-b border-border/40 pb-1">
            3. FINANCIAL PROPOSAL &amp; STATUTORY TAXES ({taxMode === "exempt" ? "0% EXEMPT" : `${taxRatePercent}% GST`})
          </h3>

          <div className="border border-border/80 rounded-sm overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                  <th className="p-2 border-r border-border/80 w-16 text-center">Sr No.</th>
                  <th className="p-2 border-r border-border/80">Description</th>
                  <th className="p-2 border-r border-border/80 w-28 text-center">Tax Rate</th>
                  <th className="p-2 w-36 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80 font-mono">
                {taxMode === "gst_split" && (
                  <>
                    <tr>
                      <td className="p-2 border-r border-border/80 text-center text-muted-foreground">1</td>
                      <td className="p-2 border-r border-border/80 text-foreground font-sans font-medium">SGST (State Tax)</td>
                      <td className="p-2 border-r border-border/80 text-center text-foreground">{totals.sgstRate}%</td>
                      <td className="p-2 text-right text-foreground">
                        {formatCurrency(totals.sgstAmount, defaultCurrency, { decimals: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-border/80 text-center text-muted-foreground">2</td>
                      <td className="p-2 border-r border-border/80 text-foreground font-sans font-medium">CGST (Central Tax)</td>
                      <td className="p-2 border-r border-border/80 text-center text-foreground">{totals.cgstRate}%</td>
                      <td className="p-2 text-right text-foreground">
                        {formatCurrency(totals.cgstAmount, defaultCurrency, { decimals: 0 })}
                      </td>
                    </tr>
                  </>
                )}

                {taxMode === "igst" && (
                  <tr>
                    <td className="p-2 border-r border-border/80 text-center text-muted-foreground">1</td>
                    <td className="p-2 border-r border-border/80 text-foreground font-sans font-medium">IGST (Integrated Tax)</td>
                    <td className="p-2 border-r border-border/80 text-center text-foreground">{totals.igstRate}%</td>
                    <td className="p-2 text-right text-foreground">
                      {formatCurrency(totals.igstAmount, defaultCurrency, { decimals: 0 })}
                    </td>
                  </tr>
                )}

                {taxMode === "exempt" && (
                  <tr>
                    <td className="p-2 border-r border-border/80 text-center text-muted-foreground">1</td>
                    <td className="p-2 border-r border-border/80 text-foreground font-sans font-medium">Exempt / SEZ / Export Tax</td>
                    <td className="p-2 border-r border-border/80 text-center text-foreground">0%</td>
                    <td className="p-2 text-right text-foreground">₹0</td>
                  </tr>
                )}

                <tr className="bg-muted/30 font-bold font-sans">
                  <td colSpan={3} className="p-2 border-r border-border/80 text-foreground">
                    Total Taxable Value (One-Time Setup)
                  </td>
                  <td className="p-2 text-right font-mono text-foreground">
                    {formatCurrency(totals.oneTime, defaultCurrency, { decimals: 0 })}
                  </td>
                </tr>
                <tr className="bg-muted/60 font-extrabold font-sans text-sm">
                  <td colSpan={3} className="p-2.5 border-r border-border/80 text-foreground">
                    Grand Total (Inclusive of Taxes)
                  </td>
                  <td className="p-2.5 text-right font-mono text-[#00aef0]">
                    {formatCurrency(totals.grandTotalInclusive, defaultCurrency, { decimals: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {totals.monthly > 0 && (
            <p className="text-[11px] text-muted-foreground italic pt-1 leading-relaxed">
              * Note: Monthly recurring charges of <strong>{formatCurrency(totals.monthly, defaultCurrency, { decimals: 0 })}</strong> {taxMode === "exempt" ? "are exempt from tax." : `will attract GST at ${taxRatePercent}% extra (${formatCurrency(totals.monthlyTaxAmount, defaultCurrency, { decimals: 0 })}), i.e. `}<strong>{formatCurrency(totals.monthlyInclusive, defaultCurrency, { decimals: 0 })} per month</strong>, billed in advance at the start of each billing cycle.
            </p>
          )}
        </div>

        {/* Section 4: Project Scope & Delivery Approach */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm uppercase text-[#00aef0] tracking-wider border-b border-border/40 pb-1">
            4. PROJECT SCOPE &amp; DELIVERY APPROACH
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Our execution approach follows a practical phase-wise delivery model to ensure a smooth launch across ecommerce marketplaces and quick commerce platforms:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground pl-1">
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground shrink-0">• Phase 1: Business &amp; Platform Readiness</span>
              <span>Collection of business details, GST/KYC documents, brand info, approvals, and platform onboarding requirements.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground shrink-0">• Phase 2: Marketplace Setup &amp; Cataloging</span>
              <span>Seller account setup, category mapping, product listings, SKU structure, pricing, variants, and inventory configuration.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground shrink-0">• Phase 3: Content &amp; Website Setup</span>
              <span>Product content preparation, SEO-friendly listing content, static website design and development, and integration of WhatsApp contact options.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground shrink-0">• Phase 4: Launch &amp; Maintenance Support</span>
              <span>Go-live support, listing corrections, maintenance assistance, regular marketplace updates, and monthly digital marketing content publishing.</span>
            </li>
          </ul>
        </div>

        {/* Section 5: Terms & Conditions */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm uppercase text-[#00aef0] tracking-wider border-b border-border/40 pb-1">
            5. TERMS &amp; CONDITIONS
          </h3>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">• Scope of Services:</strong> The quotation covers onboarding to Amazon &amp; Blinkit, listing setup, website development (up to 5 pages), ongoing marketplace management, and monthly digital marketing services as specifically mentioned above.
            </p>
            <p>
              <strong className="text-foreground">• Client Dependencies:</strong> Timely completion depends on the client providing required documents, product details, images, approvals, GST/KYC information, and access credentials on time.
            </p>
            <p>
              <strong className="text-foreground">• Payment Terms:</strong> 50% advance to initiate the project and 50% before final handover of the initial setup. Monthly maintenance and digital marketing charges are payable in advance at the start of each billing cycle.
            </p>
            <p>
              <strong className="text-foreground">• Digital Marketing Deliverables:</strong> Monthly deliverables include 20–24 creatives (16–20 static posts and 4 reels) with captions, hashtags, and scheduling as per an approved content calendar.
            </p>
            <p>
              <strong className="text-foreground">• Validity &amp; Jurisdiction:</strong> This quotation is valid for 15 days from the date of issue. Any disputes shall be subject to the jurisdiction of courts in Belagavi, Karnataka.
            </p>
          </div>
        </div>

        {/* Section 6: Acceptance & Dual Signature Block */}
        <div className="space-y-4 pt-4 border-t border-border/60">
          <p className="text-xs text-muted-foreground font-semibold">
            Acceptance: By signing below or issuing a Purchase Order, the client accepts this proposal and the commercial terms mentioned above.
          </p>

          <div className="grid grid-cols-2 gap-8 text-xs pt-2">
            <div className="border border-border/80 rounded-sm p-4 h-32 flex flex-col justify-between">
              <span className="font-bold text-foreground">
                For {clientCompanySafe || clientNameSafe}
              </span>
              <span className="text-muted-foreground text-[11px]">
                (Signature &amp; Stamp)
              </span>
            </div>

            <div className="border border-border/80 rounded-sm p-4 h-32 flex flex-col justify-between">
              <span className="font-bold text-foreground">
                For {workspace?.company_name || "Daylink Tech Labs Pvt Ltd"}
              </span>
              <span className="text-muted-foreground text-[11px]">
                (Signature &amp; Stamp)
              </span>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="border-t border-border/60 pt-4 text-center text-[10px] text-muted-foreground">
          {workspace?.company_name || "Daylink Tech Labs Pvt. Ltd."} | Commercial Proposal — {clientCompanySafe || clientNameSafe} | Confidential
        </div>
      </Card>
    </div>
  );
}
