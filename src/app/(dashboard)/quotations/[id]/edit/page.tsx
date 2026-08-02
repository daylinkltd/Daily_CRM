"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  ArrowLeft,
  Search,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import type {
  QuotationSection,
  QuotationLineItem,
  ServiceCatalogItem,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { IconAction } from "@/components/ui/icon-action";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface LocalSection extends Omit<QuotationSection, "created_at" | "updated_at"> {
  items: LocalLineItem[];
}

interface LocalLineItem extends Omit<QuotationLineItem, "created_at" | "updated_at"> {
  isNew?: boolean;
}

export default function EditQuotationPage({ params }: PageProps) {
  const router = useRouter();
  const { id: quotationUuid } = React.use(params);
  const supabase = createClient();
  const { user, accountId } = useAuth();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Quote Header states
  const [quoteId, setQuoteId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("COMMERCIAL PROPOSAL");
  const [documentSubtitle, setDocumentSubtitle] = useState("");
  const [dateCreated, setDateCreated] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<string>("Draft");
  const [clientId, setClientId] = useState<string>("");
  const [dealId, setDealId] = useState<string>("");
  const [notesTerms, setNotesTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [version, setVersion] = useState(1);

  // Lists loaded from workspace
  const [contacts, setContacts] = useState<{ id: string; name: string; company?: string }[]>([]);
  const [deals, setDeals] = useState<{ id: string; name: string }[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);

  // Sections & Line items state
  const [sections, setSections] = useState<LocalSection[]>([]);
  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([]);
  const [deletedLineItemIds, setDeletedLineItemIds] = useState<string[]>([]);

  // Catalog Drawer state
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeAddSectionId, setActiveAddSectionId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load quote details, contacts, deals, and catalog
  useEffect(() => {
    if (!workspaceId || !quotationUuid) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Quote
        const { data: quote, error: quoteErr } = await supabase
          .from("quotations")
          .select("*")
          .eq("id", quotationUuid)
          .single();

        if (quoteErr || !quote) throw new Error("Quotation not found");

        setQuoteId(quote.quotation_id);
        setDocumentTitle(quote.document_title);
        setDocumentSubtitle(quote.document_subtitle || "");
        setDateCreated(quote.date_created);
        setValidUntil(quote.valid_until);
        setStatus(quote.status);
        setClientId(quote.client_id || "");
        setDealId(quote.deal_id || "");
        setNotesTerms(quote.notes_terms || "");
        setPaymentTerms(quote.payment_terms || "");
        setVersion(quote.version || 1);

        // 2. Fetch Sections & Items
        const { data: dbSections, error: secErr } = await supabase
          .from("quotation_sections")
          .select(`
            *,
            items:quotation_line_items(*)
          `)
          .eq("quotation_id", quotationUuid)
          .order("position", { ascending: true });

        if (secErr) throw secErr;

        const formattedSections: LocalSection[] = (dbSections || []).map((sec: any) => ({
          id: sec.id,
          workspace_id: sec.workspace_id,
          quotation_id: sec.quotation_id,
          title: sec.title,
          position: sec.position,
          items: (sec.items || [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((item: any) => ({
              id: item.id,
              workspace_id: item.workspace_id,
              section_id: item.section_id,
              name: item.name,
              description: item.description || "",
              price: Number(item.price),
              pricing_type: item.pricing_type,
              qty: item.qty,
              is_recommended: item.is_recommended,
              is_free: item.is_free,
              free_condition_note: item.free_condition_note || "",
              source: item.source,
              position: item.position,
            })),
        }));

        setSections(formattedSections);

        // 3. Fetch Contacts
        const { data: dbContacts } = await supabase
          .from("contacts")
          .select("id, name, company")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });
        setContacts(dbContacts || []);

        // 4. Fetch Deals
        const { data: dbDeals } = await supabase
          .from("deals")
          .select("id, title")
          .eq("workspace_id", workspaceId)
          .order("title", { ascending: true });
        setDeals((dbDeals || []).map(d => ({ id: d.id, name: d.title })));

        // 5. Fetch Service Catalog
        const { data: dbCatalog } = await supabase
          .from("service_catalog")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true });
        setCatalog(dbCatalog || []);
      } catch (err: any) {
        toast.error(err.message || "Failed to load quotation");
        router.push("/quotations");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workspaceId, quotationUuid]);

  // Totals calculations
  const totals = useMemo(() => {
    let oneTime = 0;
    let monthly = 0;
    let yearly = 0;

    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.is_free) return; // Forced 0 contribution
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

  // Drag and drop sorting handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dragging a Section
    if (sections.some((s) => s.id === active.id)) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        setSections(arrayMove(sections, oldIndex, newIndex));
      }
    } else {
      // Dragging a Line Item
      let activeSecIdx = -1;
      let activeItemIdx = -1;
      let overSecIdx = -1;
      let overItemIdx = -1;

      sections.forEach((sec, sIdx) => {
        const iIdx = sec.items.findIndex((item) => item.id === active.id);
        if (iIdx >= 0) {
          activeSecIdx = sIdx;
          activeItemIdx = iIdx;
        }
        const oIdx = sec.items.findIndex((item) => item.id === over.id);
        if (oIdx >= 0) {
          overSecIdx = sIdx;
          overItemIdx = oIdx;
        }
      });

      if (activeSecIdx >= 0 && overSecIdx >= 0) {
        const updated = [...sections];
        if (activeSecIdx === overSecIdx) {
          // Move item within the same section
          updated[activeSecIdx].items = arrayMove(
            updated[activeSecIdx].items,
            activeItemIdx,
            overItemIdx
          );
        } else {
          // Move item across to another section
          const [movedItem] = updated[activeSecIdx].items.splice(activeItemIdx, 1);
          movedItem.section_id = updated[overSecIdx].id;
          updated[overSecIdx].items.splice(overItemIdx, 0, movedItem);
        }
        setSections(updated);
      }
    }
  };

  // Section CRUD operations
  const handleAddSection = () => {
    const newSec: LocalSection = {
      id: `new-section-${Math.random().toString(36).substr(2, 9)}`,
      workspace_id: workspaceId!,
      quotation_id: quotationUuid,
      title: "New Section",
      position: sections.length,
      items: [],
    };
    setSections([...sections, newSec]);
  };

  const handleRenameSection = (secId: string, title: string) => {
    setSections(
      sections.map((s) => (s.id === secId ? { ...s, title } : s))
    );
  };

  const handleDeleteSection = (secId: string) => {
    const target = sections.find((s) => s.id === secId);
    if (!target) return;
    if (confirm("Delete section and all its items?")) {
      if (!secId.startsWith("new-section-")) {
        setDeletedSectionIds([...deletedSectionIds, secId]);
        // Also queue existing items inside for deletion
        const existingItemIds = target.items
          .filter((item) => !item.isNew)
          .map((item) => item.id);
        setDeletedLineItemIds([...deletedLineItemIds, ...existingItemIds]);
      }
      setSections(sections.filter((s) => s.id !== secId));
    }
  };

  // Line Item CRUD operations
  const handleAddCustomItem = (secId: string) => {
    const targetSec = sections.find((s) => s.id === secId);
    if (!targetSec) return;

    const newItem: LocalLineItem = {
      id: `new-item-${Math.random().toString(36).substr(2, 9)}`,
      workspace_id: workspaceId!,
      section_id: secId,
      name: "Custom Line Item",
      description: "",
      price: 0,
      pricing_type: "one_time",
      qty: 1,
      is_recommended: false,
      is_free: false,
      free_condition_note: "",
      source: "custom",
      position: targetSec.items.length,
      isNew: true,
    };

    setSections(
      sections.map((s) =>
        s.id === secId ? { ...s, items: [...s.items, newItem] } : s
      )
    );
  };

  const handleOpenCatalogDrawer = (secId: string) => {
    setActiveAddSectionId(secId);
    setCatalogOpen(true);
  };

  const handleAddCatalogItem = (catalogItem: ServiceCatalogItem) => {
    if (!activeAddSectionId) return;

    const targetSec = sections.find((s) => s.id === activeAddSectionId);
    if (!targetSec) return;

    const newItem: LocalLineItem = {
      id: `new-item-${Math.random().toString(36).substr(2, 9)}`,
      workspace_id: workspaceId!,
      section_id: activeAddSectionId,
      name: catalogItem.name,
      description: catalogItem.default_description || "",
      price: Number(catalogItem.default_price),
      pricing_type: catalogItem.default_pricing_type as any,
      qty: 1,
      is_recommended: false,
      is_free: false,
      free_condition_note: "",
      source: "catalog",
      position: targetSec.items.length,
      isNew: true,
    };

    setSections(
      sections.map((s) =>
        s.id === activeAddSectionId ? { ...s, items: [...s.items, newItem] } : s
      )
    );

    toast.success(`Copied "${catalogItem.name}" to section`);
  };

  const handleUpdateItemField = (
    secId: string,
    itemId: string,
    field: keyof LocalLineItem,
    value: any
  ) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          items: s.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      })
    );
  };

  const handleDeleteItem = (secId: string, itemId: string) => {
    const section = sections.find((s) => s.id === secId);
    if (!section) return;

    const item = section.items.find((i) => i.id === itemId);
    if (!item) return;

    if (!item.isNew) {
      setDeletedLineItemIds([...deletedLineItemIds, itemId]);
    }

    setSections(
      sections.map((s) =>
        s.id === secId
          ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
          : s
      )
    );
  };

  // Save changes to Supabase
  const handleSaveChanges = async () => {
    if (!workspaceId || !user?.id) return;
    if (!quoteId.trim()) {
      toast.error("Quotation ID is required");
      return;
    }

    setSaving(true);
    try {
      // 1. Delete removed items/sections
      if (deletedLineItemIds.length > 0) {
        await supabase
          .from("quotation_line_items")
          .delete()
          .in("id", deletedLineItemIds);
      }
      if (deletedSectionIds.length > 0) {
        await supabase
          .from("quotation_sections")
          .delete()
          .in("id", deletedSectionIds);
      }

      // 2. Update parent Quotation header metadata
      const { error: quoteErr } = await supabase
        .from("quotations")
        .update({
          quotation_id: quoteId.trim(),
          client_id: clientId || null,
          deal_id: dealId || null,
          document_title: documentTitle.trim(),
          document_subtitle: documentSubtitle.trim() || null,
          date_created: dateCreated,
          valid_until: validUntil,
          status: status,
          notes_terms: notesTerms,
          payment_terms: paymentTerms,
          total_one_time: totals.oneTime,
          total_recurring: totals.recurring,
        })
        .eq("id", quotationUuid);

      if (quoteErr) throw quoteErr;

      // 3. Save sections and items
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx];
        const isNewSec = sec.id.startsWith("new-section-");

        let savedSecId = sec.id;

        // Upsert section
        if (isNewSec) {
          const { data: newS, error: sErr } = await supabase
            .from("quotation_sections")
            .insert({
              workspace_id: workspaceId,
              quotation_id: quotationUuid,
              title: sec.title.trim(),
              position: sIdx,
            })
            .select()
            .single();

          if (sErr) throw sErr;
          savedSecId = newS.id;
        } else {
          const { error: sErr } = await supabase
            .from("quotation_sections")
            .update({
              title: sec.title.trim(),
              position: sIdx,
            })
            .eq("id", sec.id);

          if (sErr) throw sErr;
        }

        // Upsert section's line items
        for (let iIdx = 0; iIdx < sec.items.length; iIdx++) {
          const item = sec.items[iIdx];
          const payload = {
            workspace_id: workspaceId,
            section_id: savedSecId,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            price: item.price,
            pricing_type: item.pricing_type,
            qty: item.qty,
            is_recommended: item.is_recommended,
            is_free: item.is_free,
            free_condition_note: item.is_free ? item.free_condition_note?.trim() || null : null,
            source: item.source,
            position: iIdx,
          };

          if (item.isNew || isNewSec) {
            const { error: itemErr } = await supabase
              .from("quotation_line_items")
              .insert(payload);
            if (itemErr) throw itemErr;
          } else {
            const { error: itemErr } = await supabase
              .from("quotation_line_items")
              .update(payload)
              .eq("id", item.id);
            if (itemErr) throw itemErr;
          }
        }
      }

      toast.success("Quotation changes saved successfully");
      router.push(`/quotations/${quotationUuid}/preview`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) =>
      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (item.category || "").toLowerCase().includes(catalogSearch.toLowerCase())
    );
  }, [catalog, catalogSearch]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading Quotation Builder...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto animate-in fade-in-50 duration-200">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <IconAction
            label="Back"
            icon={<ArrowLeft className="size-4" />}
            variant="outline"
            onClick={() => router.push("/quotations")}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Edit Proposal {quoteId}
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground border border-border/50">
                v{version}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Draft and configure client-facing service lines.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/quotations/${quotationUuid}/preview`)}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted"
          >
            Preview
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/95"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-1.5 size-4" /> Save Quote
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left side settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Proposal Header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="q-id">Quote Identifier</Label>
                <Input
                  id="q-id"
                  value={quoteId}
                  onChange={(e) => setQuoteId(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-title">Document Title</Label>
                <Input
                  id="q-title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-sub">Subtitle / Pitch</Label>
                <Input
                  id="q-sub"
                  value={documentSubtitle}
                  onChange={(e) => setDocumentSubtitle(e.target.value)}
                  placeholder="e.g. Workspace implementation & support"
                  className="bg-muted border-border"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-client">Bill To Client</Label>
                <select
                  id="q-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-deal">Associated Deal</Label>
                <select
                  id="q-deal"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a deal (optional)...</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="q-date">Date Created</Label>
                  <Input
                    id="q-date"
                    type="date"
                    value={dateCreated}
                    onChange={(e) => setDateCreated(e.target.value)}
                    className="bg-muted border-border text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="q-valid">Valid Until</Label>
                  <Input
                    id="q-valid"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="bg-muted border-border text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-status">Status</Label>
                <select
                  id="q-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Viewed">Viewed</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Pricing breakdown summary */}
          <Card className="border-border bg-card border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Live Proposal Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">One-time Subtotal:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.oneTime, defaultCurrency, { decimals: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly Recurring:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.monthly, defaultCurrency, { decimals: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Yearly Recurring:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.yearly, defaultCurrency, { decimals: 2 })}
                </span>
              </div>
              <div className="border-t border-border/40 pt-2 flex justify-between text-sm font-bold">
                <span className="text-foreground">Total (One-time + Monthly/yr):</span>
                <span className="text-primary text-base">
                  {formatCurrency(totals.oneTime + totals.recurring, defaultCurrency, { decimals: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side builder: Sections & Items */}
        <div className="lg:col-span-2 space-y-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {sections.map((section, sIdx) => (
                  <SortableSectionCard
                    key={section.id}
                    section={section}
                    sIdx={sIdx}
                    onRename={handleRenameSection}
                    onDelete={handleDeleteSection}
                    onAddItem={handleAddCustomItem}
                    onAddCatalog={handleOpenCatalogDrawer}
                    onUpdateItemField={handleUpdateItemField}
                    onDeleteItem={handleDeleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button
            onClick={handleAddSection}
            variant="outline"
            className="w-full border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground py-6"
          >
            <Plus className="mr-1.5 size-4" /> Add Section
          </Button>

          {/* Notes and payment terms */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Terms & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="q-payment">Payment Milestones / Schedule</Label>
                <Textarea plain
                  id="q-payment"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% advance to commence work, balance on delivery."
                  className="bg-muted border-border text-sm"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="q-terms">Contract Notes & General Terms</Label>
                <Textarea plain
                  id="q-terms"
                  value={notesTerms}
                  onChange={(e) => setNotesTerms(e.target.value)}
                  className="bg-muted border-border font-mono text-xs"
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Catalog Drawer Sheet */}
      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent className="bg-popover text-popover-foreground border-l border-border max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              Service Catalog
            </SheetTitle>
            <SheetDescription>
              Select any pre-defined service item to copy into your quotation section.
            </SheetDescription>
          </SheetHeader>

          <div className="my-4 relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search catalog..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-8 bg-muted border-border text-sm"
            />
          </div>

          <div className="space-y-2 mt-4">
            {filteredCatalog.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                No active catalog items match search.
              </p>
            ) : (
              filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAddCatalogItem(item)}
                  className="p-3 border border-border/80 rounded-lg hover:border-primary/40 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground block truncate max-w-[200px]">
                      {item.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-primary">
                      {item.default_pricing_type.replace("_", " ")}
                    </span>
                  </div>
                  {item.default_description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {item.default_description}
                    </p>
                  )}
                  <p className="text-xs font-bold text-foreground pt-1">
                    {formatCurrency(item.default_price, defaultCurrency, { decimals: 2 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* Sortable Section component */
function SortableSectionCard({
  section,
  onRename,
  onDelete,
  onAddItem,
  onAddCatalog,
  onUpdateItemField,
  onDeleteItem,
}: {
  section: LocalSection;
  sIdx: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (id: string) => void;
  onAddCatalog: (id: string) => void;
  onUpdateItemField: (sId: string, iId: string, f: keyof LocalLineItem, v: any) => void;
  onDeleteItem: (sId: string, iId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="border-border bg-card shadow-sm"
    >
      <CardHeader className="pb-3 border-b border-border/40 p-4 flex flex-row items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing shrink-0"
        >
          <GripVertical className="size-4" />
        </button>

        <Input
          value={section.title}
          onChange={(e) => onRename(section.id, e.target.value)}
          className="h-8 flex-1 font-bold text-sm bg-transparent border-transparent focus:border-border/50 hover:bg-muted/40 px-1"
        />

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => onAddCatalog(section.id)}
            className="h-7 border-border text-xs bg-transparent text-muted-foreground hover:bg-muted"
          >
            <Sparkles className="size-3 mr-1 text-primary animate-pulse" /> Catalog
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onAddItem(section.id)}
            className="h-7 border-border text-xs bg-transparent text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3 mr-1" /> Custom
          </Button>
          <IconAction
            label="Delete"
            icon={<Trash2 className="size-3.5" />}
            variant="ghost"
            onClick={() => onDelete(section.id)}
            className="h-7 w-7 text-muted-foreground hover:text-red-400"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <SortableContext
          items={section.items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-border/40">
            {section.items.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No items in this section. Add items using the buttons above.
              </div>
            ) : (
              section.items.map((item) => (
                <SortableLineItemRow
                  key={item.id}
                  item={item}
                  secId={section.id}
                  onUpdate={onUpdateItemField}
                  onDelete={onDeleteItem}
                />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

/* Sortable Line Item row component */
function SortableLineItemRow({
  item,
  secId,
  onUpdate,
  onDelete,
}: {
  item: LocalLineItem;
  secId: string;
  onUpdate: (sId: string, iId: string, f: keyof LocalLineItem, v: any) => void;
  onDelete: (sId: string, iId: string) => void;
}) {
  const { defaultCurrency } = useWorkspace();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const lineSubtotal = item.is_free ? 0 : item.price * item.qty;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-start gap-3 hover:bg-muted/10 transition-colors ${
        item.is_recommended ? "border-l-2 border-l-primary" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing shrink-0 mt-2"
      >
        <GripVertical className="size-3.5" />
      </button>

      <div className="flex-1 grid gap-3">
        {/* Row 1: Name and price details */}
        <div className="grid grid-cols-12 gap-2.5">
          <div className="col-span-5">
            <Input
              value={item.name}
              onChange={(e) => onUpdate(secId, item.id, "name", e.target.value)}
              placeholder="Service/product name"
              className="h-8 text-sm bg-muted border-border font-medium text-foreground"
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number"
              value={item.price}
              onChange={(e) => onUpdate(secId, item.id, "price", parseFloat(e.target.value) || 0)}
              className={`h-8 text-sm bg-muted border-border ${
                item.is_free ? "line-through text-muted-foreground opacity-60" : "font-semibold"
              }`}
            />
          </div>
          <div className="col-span-2">
            <select
              value={item.pricing_type}
              onChange={(e) => onUpdate(secId, item.id, "pricing_type", e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-muted px-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="col-span-1">
            <Input
              type="number"
              min="1"
              value={item.qty}
              onChange={(e) => onUpdate(secId, item.id, "qty", parseInt(e.target.value) || 1)}
              className="h-8 text-sm bg-muted border-border text-center"
            />
          </div>
          <div className="col-span-2 text-right self-center font-bold text-xs text-foreground">
            {item.is_free ? (
              <span className="text-emerald-400 font-semibold uppercase">Free</span>
            ) : (
              formatCurrency(lineSubtotal, defaultCurrency, { decimals: 2 })
            )}
          </div>
        </div>

        {/* Row 2: Description */}
        <div>
          <Input
            value={item.description || ""}
            onChange={(e) => onUpdate(secId, item.id, "description", e.target.value)}
            placeholder="Add description detail (optional)..."
            className="h-7 text-xs bg-muted/50 border-border text-muted-foreground"
          />
        </div>

        {/* Row 3: Flags (Recommended / Free / Free note) */}
        <div className="flex flex-wrap items-center gap-4 text-xs select-none">
          <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={item.is_recommended}
              onChange={(e) => onUpdate(secId, item.id, "is_recommended", e.target.checked)}
              className="rounded-none border-border bg-muted text-primary focus:ring-primary size-3.5"
            />
            Recommended badge
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={item.is_free}
              onChange={(e) => onUpdate(secId, item.id, "is_free", e.target.checked)}
              className="rounded-none border-border bg-muted text-primary focus:ring-primary size-3.5"
            />
            Mark as Free
          </label>

          {item.is_free && (
            <div className="flex-1 flex items-center gap-2">
              <span className="text-muted-foreground text-[11px] shrink-0 font-medium">Free note:</span>
              <Input
                value={item.free_condition_note || ""}
                onChange={(e) => onUpdate(secId, item.id, "free_condition_note", e.target.value)}
                placeholder="e.g. Free if subscribed to support"
                className="h-6 text-[11px] bg-muted/30 border-border text-foreground flex-1"
              />
            </div>
          )}
        </div>
      </div>

      <IconAction
        label="Delete"
        icon={<Trash2 className="size-3.5" />}
        variant="ghost"
        onClick={() => onDelete(secId, item.id)}
        className="h-8 w-8 text-muted-foreground hover:text-red-400 mt-2 shrink-0"
      />
    </div>
  );
}
