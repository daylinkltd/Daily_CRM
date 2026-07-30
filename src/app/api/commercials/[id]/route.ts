// ============================================================
// Commercial lifecycle.
//
// POST { action, ... }:
//   update   — replace header fields + line items (draft/review only)
//   submit   — draft → review
//   approve  — review → approved (admin/owner only, records approver)
//   reject   — review → rejected (admin/owner only)
//   convert  — approved → converted: creates a customer-facing
//              QUOTATION from the line items. Selling prices only —
//              unit costs and margins never leave the commercial.
//
// Conversion writes quotations + one section + line items and
// back-links converted_quotation_id; re-converting returns the
// existing quotation instead of minting a duplicate.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeCommercialTotals,
  normalizeCommercialItems,
} from "@/lib/crm/commercials";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  const { data: commercial, error: comErr } = await supabase
    .from("commercials")
    .select("*")
    .eq("id", id)
    .single();
  if (comErr || !commercial) {
    return NextResponse.json({ error: "Commercial not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", commercial.workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }
  const isAdmin = ["owner", "admin"].includes(member.role);

  // ── update ──────────────────────────────────────────────
  if (action === "update") {
    if (!["draft", "review"].includes(commercial.status)) {
      return NextResponse.json(
        { error: `A ${commercial.status} commercial can no longer be edited` },
        { status: 400 },
      );
    }
    const items = normalizeCommercialItems(body.items);
    if (!items) {
      return NextResponse.json({ error: "Line items need a name and non-negative amounts" }, { status: 400 });
    }
    const totals = computeCommercialTotals(items);

    const { error: upErr } = await supabase
      .from("commercials")
      .update({
        title: body.title?.trim() || null,
        deal_id: body.deal_id || null,
        contact_id: body.contact_id || null,
        valid_until: body.valid_until || null,
        payment_terms: body.payment_terms || null,
        notes: body.notes || null,
        total_cost: totals.total_cost,
        total_value: totals.total_value,
      })
      .eq("id", id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Replace items wholesale — simplest correct semantics for an
    // editor that resubmits the full grid.
    await supabase.from("commercial_line_items").delete().eq("commercial_id", id);
    const { error: itemsErr } = await supabase.from("commercial_line_items").insert(
      items.map((it, i) => ({
        commercial_id: id,
        workspace_id: commercial.workspace_id,
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
      return NextResponse.json({ error: `Failed to write line items: ${itemsErr.message}` }, { status: 500 });
    }

    const { data: updated } = await supabase.from("commercials").select("*").eq("id", id).single();
    return NextResponse.json({ success: true, commercial: updated });
  }

  // ── status transitions ──────────────────────────────────
  const TRANSITIONS: Record<string, { from: string[]; to: string; adminOnly: boolean }> = {
    submit: { from: ["draft"], to: "review", adminOnly: false },
    approve: { from: ["review"], to: "approved", adminOnly: true },
    reject: { from: ["review"], to: "rejected", adminOnly: true },
  };

  if (action in TRANSITIONS) {
    const t = TRANSITIONS[action];
    if (t.adminOnly && !isAdmin) {
      return NextResponse.json({ error: "Only workspace admins can approve or reject commercials" }, { status: 403 });
    }
    if (!t.from.includes(commercial.status)) {
      return NextResponse.json({ error: `Cannot ${action} a ${commercial.status} commercial` }, { status: 400 });
    }
    const { data: updated, error: upErr } = await supabase
      .from("commercials")
      .update({
        status: t.to,
        approved_by: action === "approve" ? member.id : commercial.approved_by,
      })
      .eq("id", id)
      .select()
      .single();
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, commercial: updated });
  }

  // ── convert ─────────────────────────────────────────────
  if (action === "convert") {
    if (commercial.status === "converted" && commercial.converted_quotation_id) {
      return NextResponse.json({
        success: true,
        quotation_id: commercial.converted_quotation_id,
        already_converted: true,
      });
    }
    if (commercial.status !== "approved") {
      return NextResponse.json(
        { error: "Only an approved commercial can be converted to a quotation" },
        { status: 400 },
      );
    }

    const { data: items } = await supabase
      .from("commercial_line_items")
      .select("name, description, quantity, unit_price, discount_percent, position")
      .eq("commercial_id", id)
      .order("position");
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Commercial has no line items" }, { status: 400 });
    }

    const { data: ws } = await supabase
      .from("workspaces")
      .select("default_quotation_terms")
      .eq("id", commercial.workspace_id)
      .single();

    // Same display-slug convention as the quotations page.
    const today = new Date();
    const slug = `QT-${today.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const validUntil = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Discounts collapse into the customer-facing unit price; the
    // discount itself is internal negotiation detail.
    const quoteItems = items.map((it, i) => ({
      name: it.name,
      description: it.description,
      price:
        Math.round(Number(it.unit_price) * (1 - Number(it.discount_percent || 0) / 100) * 100) / 100,
      qty: Math.max(1, Math.round(Number(it.quantity) || 1)),
      position: i,
    }));
    const totalOneTime = quoteItems.reduce((s, it) => s + it.price * it.qty, 0);

    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .insert({
        workspace_id: commercial.workspace_id,
        user_id: user.id,
        quotation_id: slug,
        deal_id: commercial.deal_id,
        client_id: commercial.contact_id,
        document_title: commercial.title || "COMMERCIAL PROPOSAL",
        valid_until: commercial.valid_until || validUntil,
        status: "Draft",
        notes_terms: ws?.default_quotation_terms || null,
        payment_terms: commercial.payment_terms || null,
        total_one_time: totalOneTime,
        total_recurring: 0,
        version: 1,
      })
      .select("id, quotation_id")
      .single();
    if (qErr || !quotation) {
      return NextResponse.json({ error: qErr?.message || "Failed to create quotation" }, { status: 500 });
    }

    const { data: section, error: secErr } = await supabase
      .from("quotation_sections")
      .insert({
        workspace_id: commercial.workspace_id,
        quotation_id: quotation.id,
        title: "Scope of Work",
        position: 0,
      })
      .select("id")
      .single();
    if (secErr || !section) {
      await supabase.from("quotations").delete().eq("id", quotation.id);
      return NextResponse.json({ error: secErr?.message || "Failed to create quotation section" }, { status: 500 });
    }

    const { error: qItemsErr } = await supabase.from("quotation_line_items").insert(
      quoteItems.map((it) => ({
        workspace_id: commercial.workspace_id,
        section_id: section.id,
        name: it.name,
        description: it.description,
        price: it.price,
        pricing_type: "one_time",
        qty: it.qty,
        position: it.position,
        source: "custom",
      }))
    );
    if (qItemsErr) {
      await supabase.from("quotations").delete().eq("id", quotation.id);
      return NextResponse.json({ error: `Failed to write quotation items: ${qItemsErr.message}` }, { status: 500 });
    }

    await supabase
      .from("commercials")
      .update({ status: "converted", converted_quotation_id: quotation.id })
      .eq("id", id);

    return NextResponse.json({ success: true, quotation_id: quotation.id, slug: quotation.quotation_id });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
