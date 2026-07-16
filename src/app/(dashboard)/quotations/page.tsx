"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Search,
  Edit,
  Eye,
  Copy,
  Trash2,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Quotation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function QuotationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, accountId } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const fetchQuotations = async () => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          client:contacts(id, name, email, phone, company),
          deal:deals(id, name, value)
        `)
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (err: any) {
      console.error("Error fetching quotations:", err.message);
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchQuotations();
    }
  }, [workspaceId]);

  // Handle New Quotation Generation
  const handleCreateQuotation = async () => {
    if (!workspaceId || !user?.id) return;
    setCreating(true);

    try {
      // 1. Fetch default terms
      const { data: wsData } = await supabase
        .from("workspaces")
        .select("default_quotation_terms")
        .eq("id", workspaceId)
        .single();

      const defaultTerms = wsData?.default_quotation_terms || "";

      // 2. Generate Quotation ID (QT-YYYYMMDD-XXXX)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedId = `QT-${dateStr}-${randomSuffix}`;

      // 3. Set validity date to 30 days from now
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);
      const validUntilStr = validUntilDate.toISOString().split("T")[0];

      // 4. Create the draft quote record
      const { data: quote, error } = await supabase
        .from("quotations")
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          quotation_id: generatedId,
          document_title: "COMMERCIAL PROPOSAL",
          valid_until: validUntilStr,
          status: "Draft",
          notes_terms: defaultTerms,
          version: 1,
          total_one_time: 0,
          total_recurring: 0,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Draft quotation created");
      router.push(`/quotations/${quote.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start quotation");
    } finally {
      setCreating(false);
    }
  };

  // Handle Version Duplication
  const handleDuplicateVersion = async (quote: Quotation) => {
    if (!workspaceId || !user?.id) return;
    const confirmMsg = `Create a new version of ${quote.quotation_id}? This will increment version to v${quote.version + 1} and copy all line items.`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // 1. Create new quote version
      const nextVersion = quote.version + 1;
      const { data: newQuote, error: qErr } = await supabase
        .from("quotations")
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          quotation_id: quote.quotation_id,
          deal_id: quote.deal_id,
          client_id: quote.client_id,
          document_title: quote.document_title,
          document_subtitle: quote.document_subtitle,
          date_created: new Date().toISOString().split("T")[0],
          valid_until: quote.valid_until,
          status: "Draft", // New version starts as Draft
          notes_terms: quote.notes_terms,
          payment_terms: quote.payment_terms,
          total_one_time: quote.total_one_time,
          total_recurring: quote.total_recurring,
          version: nextVersion,
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Fetch sections + line items of the current version to copy
      const { data: sections, error: sErr } = await supabase
        .from("quotation_sections")
        .select("*, quotation_line_items(*)")
        .eq("quotation_id", quote.id)
        .order("position", { ascending: true });

      if (sErr) throw sErr;

      if (sections && sections.length > 0) {
        for (const sec of sections) {
          // Clone Section
          const { data: newSec, error: secErr } = await supabase
            .from("quotation_sections")
            .insert({
              workspace_id: workspaceId,
              quotation_id: newQuote.id,
              title: sec.title,
              position: sec.position,
            })
            .select()
            .single();

          if (secErr) throw secErr;

          // Clone Line Items inside this Section
          if (sec.quotation_line_items && sec.quotation_line_items.length > 0) {
            const clonedItems = sec.quotation_line_items.map((item: any) => ({
              workspace_id: workspaceId,
              section_id: newSec.id,
              name: item.name,
              description: item.description,
              price: item.price,
              pricing_type: item.pricing_type,
              qty: item.qty,
              is_recommended: item.is_recommended,
              is_free: item.is_free,
              free_condition_note: item.free_condition_note,
              source: item.source,
              position: item.position,
            }));

            const { error: itemsErr } = await supabase
              .from("quotation_line_items")
              .insert(clonedItems);

            if (itemsErr) throw itemsErr;
          }
        }
      }

      toast.success(`Created version v${nextVersion} (Draft)`);
      fetchQuotations();
      router.push(`/quotations/${newQuote.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Failed to clone quotation version");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quotation version? This cannot be undone.")) return;
    try {
      const { error } = await supabase
        .from("quotations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Quotation deleted");
      fetchQuotations();
    } catch (err: any) {
      toast.error("Failed to delete quotation");
    }
  };

  // Filtered Quotations
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const clientName = q.client?.name || "";
      const clientCompany = q.client?.company || "";
      const matchesSearch =
        q.quotation_id.toLowerCase().includes(search.toLowerCase()) ||
        q.document_title.toLowerCase().includes(search.toLowerCase()) ||
        clientName.toLowerCase().includes(search.toLowerCase()) ||
        clientCompany.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "All" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const statusColors: Record<string, string> = {
    Draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Viewed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    Expired: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="size-6 text-primary" />
            Quotations
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, brand, edit, and send commercial proposals to your CRM contacts.
          </p>
        </div>
        <Button
          onClick={handleCreateQuotation}
          disabled={creating || loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {creating ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" /> Creating...
            </>
          ) : (
            <>
              <Plus className="mr-1.5 size-4" /> New Quotation
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Drafts & Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {quotes.filter((q) => ["Draft", "Sent"].includes(q.status)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending approval</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Accepted Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {quotes.filter((q) => q.status === "Accepted").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Converted successfully</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Won Revenue (One-Time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${quotes
                .filter((q) => q.status === "Accepted")
                .reduce((sum, q) => sum + Number(q.total_one_time), 0)
                .toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active client accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Board */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40">
          <div>
            <CardTitle className="text-sm font-semibold">All Proposals</CardTitle>
            <CardDescription className="text-xs">
              Manage version iterations and preview client-facing assets.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center rounded-lg border border-border/60 bg-muted p-0.5">
              {["All", "Draft", "Sent", "Accepted", "Rejected"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === status
                      ? "bg-popover text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search Client or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-muted border-border h-9 w-48 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm border-0">
              No quotations matching these criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
                    <th className="p-4">Quotation ID</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Proposal Title</th>
                    <th className="p-4">Valid Until</th>
                    <th className="p-4">Totals</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-mono font-bold text-foreground">
                        {q.quotation_id}
                        <span className="ml-1.5 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground border border-border/50">
                          v{q.version}
                        </span>
                      </td>
                      <td className="p-4">
                        {q.client ? (
                          <div>
                            <p className="font-semibold text-foreground">{q.client.name}</p>
                            {q.client.company && (
                              <p className="text-xs text-muted-foreground">{q.client.company}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground font-medium max-w-xs truncate">
                        {q.document_title}
                        {q.document_subtitle && (
                          <span className="block text-xs font-normal">{q.document_subtitle}</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground font-medium">
                        {new Date(q.valid_until).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-medium text-foreground">
                        <div>
                          <p className="text-xs text-muted-foreground">One-time:</p>
                          <p className="font-bold">${Number(q.total_one_time).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                          {Number(q.total_recurring) > 0 && (
                            <p className="text-[10px] text-primary">
                              Recurring: ${Number(q.total_recurring).toLocaleString()}/mo
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[q.status]}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Preview Proposal"
                            onClick={() => router.push(`/quotations/${q.id}/preview`)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Proposal"
                            onClick={() => router.push(`/quotations/${q.id}/edit`)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Create New Version"
                            onClick={() => handleDuplicateVersion(q)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete Proposal"
                            onClick={() => handleDeleteQuotation(q.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
