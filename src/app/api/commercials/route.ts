// ============================================================
// Commercials — create.
//
// A commercial is the INTERNAL costing stage between a deal and a
// quotation: unit costs, margins and discounts live here and are
// never copied onto customer-facing documents.
//
// POST { workspace_id, title?, deal_id?, contact_id?, currency?,
//        valid_until?, payment_terms?, notes?, discount_percent?,
//        items: [{ name, description?, quantity, unit_cost,
//                  unit_price, discount_percent? }] }
//
// Totals are computed here (single source of truth); margin_percent
// is a generated column in the DB. Reference numbers come from the
// per-workspace COMMERCIAL series (COM-000001).
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeCommercialTotals,
  normalizeCommercialItems,
} from "@/lib/crm/commercials";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, title, deal_id, contact_id, currency, valid_until, payment_terms, notes, items: rawItems } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
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

  const items = normalizeCommercialItems(rawItems);
  if (!items) {
    return NextResponse.json({ error: "Line items need a name and non-negative amounts" }, { status: 400 });
  }

  let resolvedCurrency = currency;
  if (!resolvedCurrency) {
    const { data: ws } = await supabase
      .from("workspaces").select("default_currency").eq("id", workspace_id).single();
    resolvedCurrency = ws?.default_currency || "USD";
  }

  const { data: reference } = await supabase.rpc("generate_next_document_number", {
    p_workspace_id: workspace_id,
    p_document_type: "COMMERCIAL",
  });

  const totals = computeCommercialTotals(items);

  const { data: commercial, error: comErr } = await supabase
    .from("commercials")
    .insert({
      workspace_id,
      reference: reference || `COM-${Date.now().toString(36).toUpperCase()}`,
      title: title?.trim() || null,
      deal_id: deal_id || null,
      contact_id: contact_id || null,
      status: "draft",
      currency: resolvedCurrency,
      valid_until: valid_until || null,
      payment_terms: payment_terms || null,
      notes: notes || null,
      total_cost: totals.total_cost,
      total_value: totals.total_value,
      created_by: member.id,
    })
    .select()
    .single();
  if (comErr || !commercial) {
    return NextResponse.json({ error: comErr?.message || "Failed to create commercial" }, { status: 500 });
  }

  const { error: itemsErr } = await supabase.from("commercial_line_items").insert(
    items.map((it, i) => ({
      commercial_id: commercial.id,
      workspace_id,
      name: it.name,
      description: it.description ?? null,
      quantity: it.quantity,
      unit_cost: it.unit_cost,
      unit_price: it.unit_price,
      discount_percent: it.discount_percent ?? 0,
      position: i,
    }))
  );
  if (itemsErr) {
    await supabase.from("commercials").delete().eq("id", commercial.id);
    return NextResponse.json({ error: `Failed to write line items: ${itemsErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, commercial });
}
