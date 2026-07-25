import { SupabaseClient } from "@supabase/supabase-js";
import { calculateGst } from "./gst-calculator";
import { generateEInvoiceIRN } from "./e-invoice";

export interface GstLedgerEntryPayload {
  workspace_id: string;
  ledger_type: "OUTPUT" | "INPUT"; // OUTPUT = Sales, INPUT = Purchase ITC
  invoice_id?: string;
  invoice_number: string;
  invoice_date?: string;
  party_name?: string;
  gstin?: string;
  source_state_code?: string;
  destination_state_code?: string;
  hsn_sac_code?: string;
  base_amount: number;
  gst_rate: number;
  is_tax_inclusive?: boolean;
  is_b2b?: boolean;
  seller_gstin?: string;
}

export async function recordGstLedgerEntry(
  supabase: SupabaseClient,
  payload: GstLedgerEntryPayload
) {
  const {
    workspace_id,
    ledger_type,
    invoice_id,
    invoice_number,
    invoice_date = new Date().toISOString().split("T")[0],
    party_name,
    gstin,
    source_state_code = "27",
    destination_state_code = "27",
    hsn_sac_code = "7113",
    base_amount,
    gst_rate,
    is_tax_inclusive = false,
    is_b2b = false,
    seller_gstin = "27AAAAA0000A1Z5",
  } = payload;

  const gstCalc = calculateGst({
    baseAmount: base_amount,
    gstRate: gst_rate,
    isTaxInclusive: is_tax_inclusive,
    sourceStateCode: source_state_code,
    destinationStateCode: destination_state_code,
  });

  let irnNumber = null;
  let ackNumber = null;
  let ackDate = null;
  let qrCodePayload = null;

  // Auto-generate E-Invoice if B2B Outward Sale
  if (is_b2b && ledger_type === "OUTPUT" && gstin) {
    const eInv = generateEInvoiceIRN({
      sellerGstin: seller_gstin,
      buyerGstin: gstin,
      docNumber: invoice_number,
      docDate: invoice_date,
      totalValue: gstCalc.totalAmount,
      mainHsnCode: hsn_sac_code,
    });
    irnNumber = eInv.irn;
    ackNumber = eInv.ackNo;
    ackDate = eInv.ackDate;
    qrCodePayload = eInv.qrCodePayload;
  }

  const { data, error } = await supabase
    .from("commerce_gst_ledgers")
    .insert({
      workspace_id,
      ledger_type,
      invoice_id: invoice_id || null,
      invoice_number,
      invoice_date,
      party_name: party_name || "Retail Buyer",
      gstin: gstin || null,
      source_state_code,
      destination_state_code,
      is_interstate: gstCalc.isInterstate,
      hsn_sac_code,
      taxable_amount: gstCalc.taxableAmount,
      cgst_rate: gstCalc.cgstRate,
      cgst_amount: gstCalc.cgstAmount,
      sgst_rate: gstCalc.sgstRate,
      sgst_amount: gstCalc.sgstAmount,
      igst_rate: gstCalc.igstRate,
      igst_amount: gstCalc.igstAmount,
      total_gst: gstCalc.totalGst,
      total_invoice_amount: gstCalc.totalAmount,
      is_b2b,
      irn_number: irnNumber,
      ack_number: ackNumber,
      ack_date: ackDate,
      qr_code_payload: qrCodePayload,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to record GST Ledger Entry:", error.message);
  }

  return data;
}

export async function reverseGstLedgerEntry(supabase: SupabaseClient, invoiceId: string) {
  const { data, error } = await supabase
    .from("commerce_gst_ledgers")
    .update({ status: "CANCELLED" })
    .eq("invoice_id", invoiceId);

  if (error) {
    console.error("Failed to reverse GST Ledger Entry:", error.message);
  }

  return data;
}
