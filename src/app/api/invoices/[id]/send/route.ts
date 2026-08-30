// ============================================================
// Issue an invoice: draft → sent, and post it to the books
// (DR Accounts Receivable, CR Sales Revenue + GST Output).
//
// Posting is idempotent — the unique source index means a retry
// resolves to the existing voucher instead of double-posting.
// The status flip happens only after the posting succeeds, so a
// 'sent' invoice is always in the books.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postInvoiceIssued } from "@/lib/accounting/posting";
import { recordGstLedgerEntry } from "@/lib/commerce/gst/gst-ledger-manager";

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

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invoice.workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  if (invoice.status === "void") {
    return NextResponse.json({ error: "Cannot send a void invoice" }, { status: 400 });
  }
  if (invoice.status !== "draft") {
    // Already sent — treat as success so a double-click can't error.
    return NextResponse.json({ success: true, invoice, already_sent: true });
  }
  if (Number(invoice.total_amount) <= 0) {
    return NextResponse.json({ error: "Cannot send an invoice with a zero total" }, { status: 400 });
  }

  try {
    await postInvoiceIssued(supabase, {
      workspace_id: invoice.workspace_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      contact_id: invoice.contact_id,
      total_amount: Number(invoice.total_amount),
      tax_amount: Number(invoice.tax_amount || 0),
      created_by: member.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post invoice to accounting";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Issuing a tax invoice is the moment GST liability arises, so this is
  // where the invoice enters the GST ledger.
  //
  // It did not, until now. The ledger was written from exactly one place
  // — POS checkout — so every invoice raised from CRM, projects or
  // retail was posted to the books and reported nowhere. A return built
  // from that ledger understates outward supply by the entire invoicing
  // side of the product.
  //
  // Deliberately not fatal. The invoice is already in the books and the
  // customer is waiting; a GST row that failed to write is recoverable
  // from the invoice itself, whereas refusing to issue is not
  // recoverable for the person standing at the counter. The failure is
  // returned so the caller can surface it.
  let gst_recorded = false;
  let gst_error: string | null = null;
  try {
    const taxable = Number(invoice.subtotal || 0) - Number(invoice.discount_amount || 0);

    // The buyer's tax identity is what makes this B2B, and it lives on
    // the contact.
    let buyerGstin: string | null = null;
    let buyerName: string | null = null;
    if (invoice.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, company, gstin, state_code")
        .eq("id", invoice.contact_id)
        .maybeSingle();
      buyerGstin = contact?.gstin ?? null;
      buyerName = contact?.company || contact?.name || null;
    }

    const entry = await recordGstLedgerEntry(supabase, {
      workspace_id: invoice.workspace_id,
      ledger_type: "OUTPUT",
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.issue_date,
      party_name: buyerName ?? undefined,
      gstin: buyerGstin ?? undefined,
      base_amount: taxable,
      gst_rate: Number(invoice.tax_rate || 0),
      is_tax_inclusive: false,
      is_b2b: Boolean(buyerGstin),
      // A zero-rated invoice here is an ordinary untaxed sale, not a
      // declared exemption — only the seller can say which, and saying
      // "exempt" on their behalf would misfile it.
      document_type: "TAX_INVOICE",
      source_document: "INVOICE",
    });
    gst_recorded = Boolean(entry);
    if (!entry) gst_error = "The GST ledger row could not be written.";
  } catch (err) {
    gst_error = err instanceof Error ? err.message : "GST ledger write failed";
  }

  const { data: updated, error: upErr } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    invoice: updated,
    gst_recorded,
    ...(gst_error ? { gst_error } : {}),
  });
}
