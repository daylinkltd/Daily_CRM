// ============================================================
// Unified invoices — create + list.
//
// POST creates an invoice either from scratch (items in the body)
// or from an accepted quotation (quotation_id in the body — items,
// contact and deal are copied server-side; unit COSTS from any
// commercial never reach an invoice).
//
// Money math, in one place:
//   subtotal   = Σ round(qty * unit_price, 2)
//   taxable    = subtotal - discount_amount
//   tax_amount = round(taxable * tax_rate / 100, 2)
//   total      = taxable + tax_amount
//
// Numbering comes from the atomic per-workspace series (INV-000001).
// Issuing/posting happens in /api/invoices/[id]/send — creation
// writes no journal entries.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

function computeTotals(items: ItemInput[], discountAmount: number, taxRate: number) {
  const subtotal = items.reduce(
    (acc, it) => acc + Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100,
    0
  );
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax_amount = Math.round(taxable * taxRate) / 100;
  return { subtotal, tax_amount, total_amount: taxable + tax_amount };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    workspace_id,
    quotation_id,
    contact_id,
    deal_id,
    project_id,
    source = "crm",
    currency,
    issue_date,
    due_date,
    discount_amount = 0,
    tax_rate = 0,
    notes,
    terms,
    items: rawItems,
  } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  let items: ItemInput[] = [];
  let resolvedContact = contact_id ?? null;
  let resolvedDeal = deal_id ?? null;
  let resolvedTerms = terms ?? null;

  if (quotation_id) {
    // Build the invoice from a quotation, server-side.
    const { data: quote, error: qErr } = await supabase
      .from("quotations")
      .select("id, workspace_id, quotation_id, client_id, deal_id, payment_terms, notes_terms")
      .eq("id", quotation_id)
      .eq("workspace_id", workspace_id)
      .single();
    if (qErr || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const { data: sections } = await supabase
      .from("quotation_sections")
      .select("id, title, position, items:quotation_line_items(name, description, price, qty, is_free, pricing_type, position)")
      .eq("quotation_id", quotation_id)
      .order("position");

    for (const section of sections ?? []) {
      const sorted = [...(section.items ?? [])].sort((a, b) => a.position - b.position);
      for (const it of sorted) {
        if (it.is_free) continue;
        const suffix =
          it.pricing_type === "monthly" ? " (monthly)"
          : it.pricing_type === "yearly" ? " (yearly)"
          : "";
        items.push({
          description: `${it.name}${suffix}${it.description ? ` — ${it.description}` : ""}`,
          quantity: Number(it.qty) || 1,
          unit_price: Number(it.price) || 0,
        });
      }
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Quotation has no billable line items" }, { status: 400 });
    }
    resolvedContact = resolvedContact ?? quote.client_id;
    resolvedDeal = resolvedDeal ?? quote.deal_id;
    resolvedTerms = resolvedTerms ?? quote.payment_terms ?? quote.notes_terms;
  } else {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }
    items = rawItems.map((it: ItemInput) => ({
      description: String(it.description || "").trim(),
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      tax_rate: Number(it.tax_rate) || 0,
    }));
    if (items.some((it) => !it.description || it.quantity < 0 || it.unit_price < 0)) {
      return NextResponse.json({ error: "Line items need a description and non-negative amounts" }, { status: 400 });
    }
  }

  // Workspace default currency unless the caller specifies one.
  let resolvedCurrency = currency;
  if (!resolvedCurrency) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("default_currency")
      .eq("id", workspace_id)
      .single();
    resolvedCurrency = ws?.default_currency || "USD";
  }

  const totals = computeTotals(items, Number(discount_amount) || 0, Number(tax_rate) || 0);

  const { data: invoiceNumber } = await supabase.rpc("generate_next_document_number", {
    p_workspace_id: workspace_id,
    p_document_type: "INVOICE",
  });

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      workspace_id,
      invoice_number: invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`,
      source,
      contact_id: resolvedContact,
      deal_id: resolvedDeal,
      quotation_id: quotation_id ?? null,
      project_id: project_id ?? null,
      currency: resolvedCurrency,
      issue_date: issue_date || undefined,
      due_date: due_date || null,
      subtotal: totals.subtotal,
      discount_amount: Number(discount_amount) || 0,
      tax_rate: Number(tax_rate) || 0,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      status: "draft",
      notes: notes ?? null,
      terms: resolvedTerms,
      created_by: member.id,
    })
    .select()
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message || "Failed to create invoice" }, { status: 500 });
  }

  const { error: itemsErr } = await supabase.from("invoice_items").insert(
    items.map((it, i) => ({
      invoice_id: invoice.id,
      workspace_id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_rate: it.tax_rate ?? 0,
      position: i,
    }))
  );
  if (itemsErr) {
    // Never leave a headerless invoice: compensate like the posting engine.
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: `Failed to write invoice items: ${itemsErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, invoice });
}
