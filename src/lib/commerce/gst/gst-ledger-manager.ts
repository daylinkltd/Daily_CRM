import { SupabaseClient } from "@supabase/supabase-js";
import { calculateGst } from "./gst-calculator";
import { NO_IRN, isEInvoicingConfigured } from "./e-invoice";

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
    source_state_code: source_state_code_input,
    destination_state_code: destination_state_code_input,
    hsn_sac_code = "7113",
    base_amount,
    gst_rate,
    is_tax_inclusive = false,
    is_b2b = false,
  } = payload;

  // Where the seller is, and where the supply lands. These two decide
  // CGST+SGST versus IGST, which is the whole shape of the entry.
  //
  // They used to default to '27' each, so every sale was booked as
  // intra-state Maharashtra whatever the workspace actually was. Now the
  // seller's state comes from the workspace and the buyer's from their
  // GSTIN (its first two characters ARE the state code), and when the
  // seller's state is genuinely unknown the entry is booked intra-state
  // AND flagged in the log rather than quietly guessing a state.
  const sellerState = source_state_code_input ?? (await workspaceStateCode(supabase, workspace_id));
  const buyerState =
    destination_state_code_input ?? (gstin ? gstin.slice(0, 2) : null) ?? sellerState;

  if (!sellerState) {
    console.warn(
      `[gst] ${invoice_number}: workspace has no GST state code, so CGST/SGST vs IGST cannot be determined. Recorded as intra-state. Set it in Settings → Branding.`,
    );
  }

  const source_state_code = sellerState ?? "";
  const destination_state_code = buyerState ?? source_state_code;

  const gstCalc = calculateGst({
    baseAmount: base_amount,
    gstRate: gst_rate,
    isTaxInclusive: is_tax_inclusive,
    sourceStateCode: source_state_code,
    destinationStateCode: destination_state_code,
  });

  // E-invoice columns stay empty until a real IRP acknowledgement exists.
  //
  // This block used to fabricate an IRN locally for every B2B outward
  // sale. An IRN is issued by the government's Invoice Registration
  // Portal and cannot be computed by anyone else, so what it produced was
  // a fake acknowledgement stored and displayed as a real one. Empty is
  // incomplete; fake is a false compliance claim made on the customer's
  // behalf. See e-invoice.ts for the integration this is waiting on.
  const irnColumns = NO_IRN;

  if (is_b2b && ledger_type === "OUTPUT" && gstin && !isEInvoicingConfigured()) {
    console.info(
      `[gst] ${invoice_number}: B2B sale recorded without an IRN — e-invoicing is not connected to an IRP on this environment.`,
    );
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
      ...irnColumns,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to record GST Ledger Entry:", error.message);
  }

  return data;
}

/**
 * The workspace's own GST state code, or null when it has not been set.
 *
 * Null is returned deliberately instead of a fallback. A wrong state code
 * produces a wrong tax split in a filed return, which is far worse than a
 * missing one that shows up as a warning.
 */
async function workspaceStateCode(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("state_code, gstin")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!data) return null;
  return data.state_code || (data.gstin ? String(data.gstin).slice(0, 2) : null);
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
