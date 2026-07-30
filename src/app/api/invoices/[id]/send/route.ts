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

  const { data: updated, error: upErr } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, invoice: updated });
}
