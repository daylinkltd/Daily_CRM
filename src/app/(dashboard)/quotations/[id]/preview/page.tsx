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
import { BrandedProposalTemplate } from "@/components/shared/BrandedProposalTemplate";
import { NativeSelect } from "@/components/ui/native-select";

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

  // Dynamic Layout & Tax Controls
  const [layoutPreset, setLayoutPreset] = useState<"daylink_standard" | "milestone_itemized">("daylink_standard");
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

      {/* Control panel for dynamic Layout Presets & Tax Toggles (no-print) */}
      <div className="no-print p-4 border border-border bg-muted/30 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted-foreground">Format Layout Preset:</span>
          <NativeSelect
            value={layoutPreset}
            onChange={(e) => setLayoutPreset(e.target.value as any)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-medium"
          >
            <option value="daylink_standard">Daylink Standard (Service / IT / Agency)</option>
            <option value="milestone_itemized">Milestone Itemized (Licensing / Compliance / Supply)</option>
          </NativeSelect>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Tax Type:</span>
            <NativeSelect
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as any)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="gst_split">SGST + CGST (Intra-State / Within State)</option>
              <option value="igst">IGST (Inter-State / Outside State)</option>
              <option value="exempt">Exempt / SEZ / Zero-Rated (0% Tax)</option>
            </NativeSelect>
          </div>

          {taxMode !== "exempt" && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Tax Rate:</span>
              <NativeSelect
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value={18}>18% GST</option>
                <option value={12}>12% GST</option>
                <option value={5}>5% GST</option>
                <option value={28}>28% GST</option>
              </NativeSelect>
            </div>
          )}
        </div>
      </div>

      {/* Printable Branded Commercial Proposal Document */}
      <div className="print-content">
        <BrandedProposalTemplate
          workspace={{
            logo_url: workspace?.logo_url,
            company_name: workspace?.company_name || "Daylink Tech Labs Pvt. Ltd.",
            company_tagline: workspace?.company_tagline || "Empowering Your Digital Future",
            company_address: workspace?.company_address || "21/1, KHB, AUTO NAGAR, BELAGAVI - 590016",
            company_phone: workspace?.company_phone || "9902319132 | 8050594245",
            company_email: workspace?.company_email || "info@daylink.in",
          }}
          client={{
            name: clientNameSafe,
            company: clientCompanySafe,
            address: (client as any)?.address || null,
          }}
          proposal={{
            quotation_id: quote.quotation_id,
            document_title: quote.document_title,
            document_subtitle: quote.document_subtitle,
            date_created: quote.date_created,
            valid_until: quote.valid_until,
            version: quote.version,
            notes_terms: quote.notes_terms,
          }}
          sections={sections}
          layoutPreset={layoutPreset}
          taxMode={taxMode}
          taxRatePercent={taxRatePercent}
        />
      </div>
    </div>
  );
}
