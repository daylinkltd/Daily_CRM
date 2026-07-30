// ============================================================
// Record a payment against an invoice.
//
// The DB does the heavy lifting (075): a BEFORE trigger locks the
// invoice row, rejects payments on draft/void invoices and rejects
// overpayment; an AFTER trigger recomputes amount_paid and derives
// the status. This route inserts the payment, posts it to the books
// (DR Cash/Bank, CR Accounts Receivable), and links the voucher.
// If posting fails the payment row is removed — a recorded payment
// is always in the books.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postInvoicePayment } from "@/lib/accounting/posting";

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
  const { amount, mode = "bank_transfer", payment_date, bank_account_id, reference_number, notes } = body;

  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return NextResponse.json({ error: "Payment amount must be a positive number" }, { status: 400 });
  }

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, workspace_id, invoice_number, contact_id, total_amount, amount_paid, status")
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

  // Insert the payment; the 075 triggers validate state + amount and
  // maintain invoices.amount_paid/status.
  const { data: payment, error: payErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoice.id,
      workspace_id: invoice.workspace_id,
      amount: paymentAmount,
      mode,
      payment_date: payment_date || undefined,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      notes: notes || null,
      created_by: member.id,
    })
    .select()
    .single();
  if (payErr || !payment) {
    // Trigger errors (draft/void, overpayment) arrive here with the
    // DB's message — surface them verbatim, they're user-readable.
    return NextResponse.json({ error: payErr?.message || "Failed to record payment" }, { status: 400 });
  }

  try {
    const posting = await postInvoicePayment(supabase, {
      workspace_id: invoice.workspace_id,
      payment_id: payment.id,
      invoice_number: invoice.invoice_number,
      contact_id: invoice.contact_id,
      amount: paymentAmount,
      mode,
      bank_account_id: bank_account_id || null,
      reference_number: reference_number || null,
      created_by: member.id,
    });
    await supabase
      .from("invoice_payments")
      .update({ journal_entry_id: posting.journal_entry_id })
      .eq("id", payment.id);
  } catch (err) {
    // Keep payment and books consistent: no voucher, no payment row.
    await supabase.from("invoice_payments").delete().eq("id", payment.id);
    const message = err instanceof Error ? err.message : "Failed to post payment to accounting";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, payment, invoice: updated });
}
