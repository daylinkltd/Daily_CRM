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
  FileText,
  Briefcase,
  Calendar,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import type { Quotation, QuotationSection, Contact } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

  // Interactive View Toggles
  const [showRecommended, setShowRecommended] = useState(true);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showCategories, setShowCategories] = useState(true);

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

  // Pricing calculations
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

    return {
      oneTime,
      monthly,
      yearly,
      recurring: monthly + (yearly / 12),
    };
  }, [sections]);

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
      // 1. Fetch or create a conversation with the contact
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
        // Create conversation
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

      // 2. Formulate message text
      const previewUrl = `${window.location.origin}/quotations/${quote.id}/preview`;
      const companyName = workspace?.company_name || "our company";
      const msgText = `Hello ${client.name},\n\nHere is your quotation ${quote.quotation_id} for "${quote.document_title}" from ${companyName}:\n\n${previewUrl}\n\nPlease review and let us know if you have any questions!`;

      // 3. POST to WhatsApp Send API
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

      // 4. Update status to Sent if it was Draft
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

  // Accept Quotation and Sync with Pipeline Deal
  const handleAcceptQuotation = async () => {
    if (!quote) return;
    if (!confirm("Mark this quotation as Accepted and transition the deal pipeline?")) return;

    setActionLoading(true);
    try {
      // 1. Update quotation status
      const { error: qErr } = await supabase
        .from("quotations")
        .update({ status: "Accepted" })
        .eq("id", quote.id);

      if (qErr) throw qErr;

      // 2. Link/create Won Deal
      if (quote.deal_id) {
        // Update existing deal to won and set value
        const { error: dErr } = await supabase
          .from("deals")
          .update({
            status: "won",
            value: totals.oneTime,
          })
          .eq("id", quote.deal_id);

        if (dErr) throw dErr;
        toast.success("Quotation accepted & pipeline deal updated to Won!");
      } else {
        // Find default pipeline and won stage
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id")
          .eq("workspace_id", workspaceId);

        if (pipelines && pipelines.length > 0) {
          // Find the last stage in this pipeline
          const { data: stages } = await supabase
            .from("pipeline_stages")
            .select("id, name")
            .eq("pipeline_id", pipelines[0].id)
            .order("position", { ascending: false });

          if (stages && stages.length > 0) {
            const clientName = client?.name || "Client";
            const dealTitle = `${quote.document_title} - ${clientName}`;

            // Create won deal
            const { data: newDeal, error: dealErr } = await supabase
              .from("deals")
              .insert({
                workspace_id: workspaceId,
                title: dealTitle,
                contact_id: quote.client_id,
                pipeline_id: pipelines[0].id,
                stage_id: stages[0].id, // last stage (Won)
                value: totals.oneTime,
                status: "won",
              })
              .select()
              .single();

            if (dealErr) throw dealErr;

            // Link quotation to new deal
            await supabase
              .from("quotations")
              .update({ deal_id: newDeal.id })
              .eq("id", quote.id);

            toast.success("Quotation accepted & new Won Deal created in pipeline!");
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

  // Reject Quotation Flow
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
        <p className="text-sm text-muted-foreground">Generating branded preview...</p>
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

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto animate-in fade-in-50 duration-200">
      {/* CSS @media print style tag for high-end corporate proposals */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 12pt !important;
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
          .line-item-row {
            page-break-inside: avoid !important;
          }
          h1, h2, h3, table {
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Action panel header (no-print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/quotations/${quote.id}/edit`)}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Proposal Preview
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[quote.status]}`}>
                {quote.status}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Branded commercial proposal layout for client presentation.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {quote.status !== "Accepted" && quote.status !== "Rejected" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectQuotation}
                disabled={actionLoading}
                className="border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10"
              >
                <XCircle className="size-4 mr-1.5" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptQuotation}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="size-4 mr-1.5" /> Accept & Convert
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsAppSend}
            disabled={actionLoading || !client?.phone}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted"
          >
            <MessageSquare className="size-4 mr-1.5 text-green-400" /> WhatsApp
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            disabled={actionLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/95"
          >
            <Printer className="size-4 mr-1.5" /> Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Control panel for toggles (no-print) */}
      <div className="no-print p-4 border border-border bg-muted/30 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-muted-foreground">Interactive Proposal Controls:</span>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
            <input
              type="checkbox"
              checked={showRecommended}
              onChange={(e) => setShowRecommended(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4"
            />
            Show &quot;Recommended&quot; Badges
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
            <input
              type="checkbox"
              checked={showDescriptions}
              onChange={(e) => setShowDescriptions(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4"
            />
            Show Item Descriptions
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
            <input
              type="checkbox"
              checked={showCategories}
              onChange={(e) => setShowCategories(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4"
            />
            Show Service Categories
          </label>
        </div>
      </div>

      {/* The Printable Proposal Document */}
      <Card className="print-content border-border bg-card shadow-lg p-8 sm:p-12 text-foreground space-y-8 max-w-4xl mx-auto">
        {/* Document Header Branding - Centered Style */}
        <div className="flex flex-col items-center justify-center text-center pb-6 border-b-4 border-primary">
          {workspace?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.logo_url}
              alt={workspace.company_name || "Company Logo"}
              className="h-24 sm:h-32 max-w-[400px] object-contain mb-2"
            />
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="size-10 bg-primary rounded flex items-center justify-center">
                  <Sparkles className="size-6 text-primary-foreground" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-800 uppercase tracking-wide mb-1">
                {workspace?.company_name || "DAYLINK TECH LABS PRIVATE LIMITED"}
              </h1>
            </>
          )}
          
          {workspace?.company_tagline && (
            <p className="text-lg text-primary font-medium mb-2">
              {workspace.company_tagline}
            </p>
          )}

          <div className="text-sm text-slate-600 space-y-1">
            {workspace?.company_address && <p>{workspace.company_address}</p>}
            <p className="flex items-center justify-center gap-2">
              {workspace?.company_phone && <span>{workspace.company_phone}</span>}
              {workspace?.company_phone && workspace?.company_email && <span>|</span>}
              {workspace?.company_email && <span>{workspace.company_email}</span>}
            </p>
          </div>
        </div>

        {/* Proposal Title & Details */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4">
          <div className="sm:text-left space-y-1">
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight uppercase">
              {quote.document_title}
            </h2>
            {quote.document_subtitle && (
              <p className="text-sm font-semibold text-primary">{quote.document_subtitle}</p>
            )}
            <p className="text-xs font-mono text-muted-foreground pt-1">
              Proposal Identifier: {quote.quotation_id} (v{quote.version})
            </p>
          </div>
        </div>

        {/* Client Billing Info & Dates */}
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Prepared For:
            </h3>
            {client ? (
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-sm text-foreground">{client.name}</p>
                {client.company && <p className="font-semibold text-foreground">{client.company}</p>}
                {client.email && <p className="text-muted-foreground">{client.email}</p>}
                {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Client not assigned</p>
            )}
          </div>

          <div className="space-y-1 sm:text-right">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Document Details:
            </h3>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <Calendar className="inline size-3 mr-1" />
                Date Created: {new Date(quote.date_created).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p>
                <FileText className="inline size-3 mr-1 text-red-400" />
                Valid Until: {new Date(quote.valid_until).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {quote.deal_id && (
                <p>
                  <Briefcase className="inline size-3 mr-1" />
                  Deal Ref: Linked to pipeline
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quotation Line Items Table */}
        <div className="space-y-6 pt-4">
          {sections.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">
              No proposal lines configured.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="space-y-2 line-item-row">
                <div className="flex items-center gap-2 border-b border-border/40 pb-1 mt-6">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-primary">
                    {section.title}
                  </h4>
                  {showCategories && section.items[0]?.source === "catalog" && (
                    <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                      Catalog Solution
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border/40">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`py-3.5 flex justify-between gap-4 text-xs items-start line-item-row ${
                        item.is_recommended && showRecommended ? "bg-primary/5 border-l-2 border-l-primary pl-3 pr-2" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{item.name}</span>
                          {item.is_recommended && showRecommended && (
                            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              Recommended
                            </span>
                          )}
                          {item.is_free && (
                            <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                              Free
                            </span>
                          )}
                        </div>

                        {showDescriptions && item.description && (
                          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {item.is_free && item.free_condition_note && (
                          <p className="text-[10px] text-emerald-400 italic">
                            * Note: {item.free_condition_note}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-muted-foreground">
                          {item.qty} x {formatCurrency(item.price, defaultCurrency, { decimals: 2 })}
                        </p>
                        <p className="font-mono text-[10px] text-primary uppercase pt-0.5">
                          {item.pricing_type.replace("_", " ")}
                        </p>
                        <p className="font-bold font-mono text-foreground pt-0.5">
                          {item.is_free ? (
                            <span className="text-emerald-400 font-semibold uppercase">Free</span>
                          ) : (
                            formatCurrency(item.price * item.qty, defaultCurrency, { decimals: 2 })
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Subtotals & Totals Summaries */}
        <div className="border-t border-border/80 pt-6 flex justify-end">
          <div className="w-80 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">One-time Services subtotal:</span>
              <span className="font-bold font-mono text-foreground">
                {formatCurrency(totals.oneTime, defaultCurrency, { decimals: 2 })}
              </span>
            </div>

            {totals.monthly > 0 && (
              <div className="flex justify-between text-xs text-primary font-medium">
                <span>Monthly subscriptions subtotal:</span>
                <span className="font-mono">{formatCurrency(totals.monthly, defaultCurrency, { decimals: 2 })}/mo</span>
              </div>
            )}

            {totals.yearly > 0 && (
              <div className="flex justify-between text-xs text-primary font-medium">
                <span>Yearly subscriptions subtotal:</span>
                <span className="font-mono">{formatCurrency(totals.yearly, defaultCurrency, { decimals: 2 })}/yr</span>
              </div>
            )}

            <div className="border-t-2 border-border pt-3 flex justify-between font-extrabold text-base">
              <span className="text-foreground uppercase tracking-wider text-xs self-center">
                Total Proposal Value
              </span>
              <span className="text-primary font-mono text-lg">
                {formatCurrency(totals.oneTime + totals.recurring, defaultCurrency, { decimals: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Milestones Grid */}
        <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-border/60 text-xs">
          {quote.payment_terms && (
            <div className="space-y-1">
              <h4 className="font-bold text-xs uppercase text-primary">Payment Schedule</h4>
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {quote.payment_terms}
              </p>
            </div>
          )}

          {quote.notes_terms && (
            <div className="space-y-1">
              <h4 className="font-bold text-xs uppercase text-primary">Terms & Notes</h4>
              <p className="text-muted-foreground font-mono leading-relaxed whitespace-pre-line bg-muted/10 p-3 rounded border border-border/40">
                {quote.notes_terms}
              </p>
            </div>
          )}
        </div>

        {/* Footer info branding */}
        <div className="border-t border-border/60 pt-6 text-center text-[10px] text-muted-foreground">
          This quotation is confidential and proprietary to{" "}
          {workspace?.company_name || "our company"}. Unless stated otherwise,
          amounts are calculated in US Dollars ($). Thank you for your business!
        </div>
      </Card>
    </div>
  );
}
