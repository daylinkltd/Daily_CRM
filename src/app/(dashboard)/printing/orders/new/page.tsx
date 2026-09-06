"use client";

/**
 * New printing job — the enquiry/quotation form from the flow chart.
 *
 * Every attribute the trade repeats all day (size, paper, GSM, print
 * type, colour mode, finishing, unit) is a searchable dropdown fed by
 * the workspace's presets (Printing → Settings), each with an inline
 * "+ Add" so a missing value is created without leaving the form — the
 * CreatableSelect pattern. The customer picker does the same with CRM
 * contacts. The stored value stays plain text on the item row: presets
 * are vocabulary, not foreign keys, so deleting a preset never breaks
 * an old job.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Settings2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/currency";
import { computeOrderTotals } from "@/lib/printing/orders";
import {
  groupPresets,
  PRESET_KIND_NOUN,
  type PresetKind,
  type PrintingPreset,
} from "@/lib/printing/presets";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { IconAction } from "@/components/ui/icon-action";
import { QuickCreateContact } from "@/components/shared/quick-create-contact";
import { QuickCreatePreset } from "@/components/printing/quick-create-preset";

interface ContactOption {
  id: string;
  name: string;
  company: string | null;
}

interface DraftItem {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  size: string;
  paper_type: string;
  gsm: string;
  print_type: string;
  color_mode: string;
  finishing: string;
  special_instructions: string;
}

const BLANK_ITEM: DraftItem = {
  description: "",
  quantity: "1",
  unit: "Nos",
  rate: "0",
  size: "",
  paper_type: "",
  gsm: "",
  print_type: "",
  color_mode: "",
  finishing: "",
  special_instructions: "",
};

/** Item field ↔ preset kind, in form order. */
const ATTRIBUTE_FIELDS: { field: keyof DraftItem; kind: PresetKind; placeholder: string }[] = [
  { field: "size", kind: "SIZE", placeholder: "Size" },
  { field: "paper_type", kind: "PAPER_TYPE", placeholder: "Paper" },
  { field: "gsm", kind: "GSM", placeholder: "GSM" },
  { field: "print_type", kind: "PRINT_TYPE", placeholder: "Print type" },
  { field: "color_mode", kind: "COLOR_MODE", placeholder: "Colour mode" },
  { field: "finishing", kind: "FINISHING", placeholder: "Finishing" },
];

export default function NewPrintingOrderPage() {
  const supabase = createClient();
  const router = useRouter();
  const { accountId } = useAuth();
  const { activeWorkspace, activeMember, defaultCurrency } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [presets, setPresets] = useState<PrintingPreset[]>([]);
  const [contactId, setContactId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [taxRate, setTaxRate] = useState("18");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...BLANK_ITEM }]);
  const [saving, setSaving] = useState<"ENQUIRY" | "QUOTED" | null>(null);

  // Create-inline plumbing: which dialog is open, and — for presets —
  // which row/field asked for it so the new value lands back there.
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [presetTarget, setPresetTarget] = useState<{
    kind: PresetKind;
    row: number;
    field: keyof DraftItem;
  } | null>(null);

  const loadContacts = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("contacts")
      .select("id, name, company")
      .eq("workspace_id", workspaceId)
      .order("name")
      .limit(500);
    setContacts((data as ContactOption[]) || []);
  }, [supabase, workspaceId]);

  const loadPresets = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("printing_presets")
      .select("id, kind, label, sort_order, active")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .order("sort_order")
      .order("label");
    setPresets((data as PrintingPreset[]) || []);
  }, [supabase, workspaceId]);

  useEffect(() => {
    void loadContacts();
    void loadPresets();
  }, [loadContacts, loadPresets]);

  const presetsByKind = useMemo(() => groupPresets(presets), [presets]);
  const presetOptions = useCallback(
    (kind: PresetKind) =>
      presetsByKind[kind].map((p) => ({ value: p.label, label: p.label })),
    [presetsByKind],
  );

  const totals = useMemo(
    () =>
      computeOrderTotals(
        items.map((it) => ({ quantity: Number(it.quantity), rate: Number(it.rate) })),
        Number(taxRate),
      ),
    [items, taxRate],
  );

  function setItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function handleSave(status: "ENQUIRY" | "QUOTED") {
    if (!workspaceId) return;
    const filled = items.filter((it) => it.description.trim());
    if (filled.length === 0) {
      toast.error("Add at least one job item with a description");
      return;
    }
    if (!contactId && !customerName.trim()) {
      toast.error("Pick a customer or enter a walk-in name");
      return;
    }
    setSaving(status);
    try {
      const { data: orderNo } = await supabase.rpc("generate_next_document_number", {
        p_workspace_id: workspaceId,
        p_document_type: "PRINTING_ORDER",
      });

      const { data: order, error } = await supabase
        .from("printing_orders")
        .insert({
          workspace_id: workspaceId,
          order_no: orderNo || `PJ-${Date.now().toString(36).toUpperCase()}`,
          contact_id: contactId || null,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          status,
          delivery_date: deliveryDate || null,
          subtotal: totals.subtotal,
          tax_rate: Number(taxRate) || 0,
          tax_amount: totals.taxAmount,
          grand_total: totals.grandTotal,
          notes: notes.trim() || null,
          created_by: activeMember?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("printing_order_items").insert(
        filled.map((it, i) => ({
          order_id: order.id,
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unit: it.unit.trim() || null,
          rate: Number(it.rate) || 0,
          amount: Math.round((Number(it.quantity) || 0) * (Number(it.rate) || 0) * 100) / 100,
          size: it.size.trim() || null,
          paper_type: it.paper_type.trim() || null,
          gsm: it.gsm.trim() || null,
          print_type: it.print_type || null,
          color_mode: it.color_mode || null,
          finishing: it.finishing.trim() || null,
          special_instructions: it.special_instructions.trim() || null,
          position: i,
        })),
      );
      if (itemsError) throw itemsError;

      toast.success(`Job ${orderNo ?? ""} created`);
      router.push(`/printing/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the job");
      setSaving(null);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <div className="flex items-start gap-3">
        <Link
          href="/printing"
          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Back to job orders"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          title="New Job / Enquiry"
          description="Capture the job and its printing specs — quote it now or leave it as an enquiry."
          actions={
            <Link href="/printing/settings">
              <IconAction label="Presets" icon={<Settings2 />} variant="outline" />
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Customer + logistics */}
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Customer (from CRM)</label>
              <CreatableSelect
                options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company }))}
                value={contactId}
                onValueChange={setContactId}
                placeholder="Select a contact…"
                searchPlaceholder="Search contacts..."
                createLabel="Add customer"
                onCreate={() => setContactDialogOpen(true)}
                aria-label="Customer"
              />
              <p className="text-[11px] text-muted-foreground">
                …or leave empty and enter a walk-in below.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Walk-in name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Swaraj Jakanoor" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Mobile number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Delivery date</label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">GST %</label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the production team should know" />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal, defaultCurrency, { decimals: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({Number(taxRate) || 0}%)</span>
                <span>{formatCurrency(totals.taxAmount, defaultCurrency, { decimals: 2 })}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(totals.grandTotal, defaultCurrency, { decimals: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                disabled={!!saving}
                onClick={() => handleSave("ENQUIRY")}
              >
                {saving === "ENQUIRY" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Save as enquiry
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary-hover"
                disabled={!!saving}
                onClick={() => handleSave("QUOTED")}
              >
                {saving === "QUOTED" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Save & quote
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Job items — every attribute is a preset dropdown with inline add */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4">
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })}
                    placeholder={`Item ${i + 1} — e.g. Visiting Cards`}
                    className="flex-1 font-medium"
                  />
                  {items.length > 1 && (
                    <IconAction
                      label="Remove item"
                      icon={<Trash2 />}
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input type="number" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} placeholder="Qty" aria-label="Quantity" />
                  <CreatableSelect
                    options={presetOptions("UNIT")}
                    value={it.unit}
                    onValueChange={(v) => setItem(i, { unit: v })}
                    placeholder="Unit"
                    searchPlaceholder="Search units..."
                    createLabel={`Add ${PRESET_KIND_NOUN.UNIT}`}
                    onCreate={() => setPresetTarget({ kind: "UNIT", row: i, field: "unit" })}
                    aria-label="Unit"
                  />
                  <Input type="number" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} placeholder="Rate" aria-label="Rate" />
                  <div className="flex h-9 items-center justify-end pr-1 text-sm font-semibold text-foreground">
                    {formatCurrency((Number(it.quantity) || 0) * (Number(it.rate) || 0), defaultCurrency, { decimals: 2 })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ATTRIBUTE_FIELDS.map(({ field, kind, placeholder }) => (
                    <CreatableSelect
                      key={field}
                      options={presetOptions(kind)}
                      value={it[field]}
                      onValueChange={(v) => setItem(i, { [field]: v })}
                      placeholder={placeholder}
                      searchPlaceholder={`Search ${PRESET_KIND_NOUN[kind]}s...`}
                      createLabel={`Add ${PRESET_KIND_NOUN[kind]}`}
                      onCreate={() => setPresetTarget({ kind, row: i, field })}
                      aria-label={placeholder}
                    />
                  ))}
                </div>
                <Input
                  value={it.special_instructions}
                  onChange={(e) => setItem(i, { special_instructions: e.target.value })}
                  placeholder="Special instructions for this item"
                  aria-label="Special instructions"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setItems((prev) => [...prev, { ...BLANK_ITEM }])}
            >
              <Plus className="mr-1.5 size-3.5" /> Add item
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create-inline dialogs */}
      <QuickCreateContact
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        workspaceId={workspaceId}
        onCreated={(c) => {
          setContacts((prev) =>
            [...prev, { id: c.id, name: c.name, company: c.company }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
          setContactId(c.id);
        }}
      />
      {presetTarget && (
        <QuickCreatePreset
          open={!!presetTarget}
          onOpenChange={(open) => !open && setPresetTarget(null)}
          workspaceId={workspaceId}
          kind={presetTarget.kind}
          onCreated={(p) => {
            setPresets((prev) => [...prev, p]);
            setItem(presetTarget.row, { [presetTarget.field]: p.label });
            setPresetTarget(null);
          }}
        />
      )}
    </div>
  );
}
