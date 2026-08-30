import { SupabaseClient } from "@supabase/supabase-js";
import { calculateGst } from "./gst-calculator";
import { NO_IRN, isEInvoicingConfigured } from "./e-invoice";
import {
  classifySupply,
  resolvePlaceOfSupply,
  type SupplyType,
} from "./supply-classification";

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
  /** Which GST document this is. Defaults to a tax invoice. */
  document_type?: "TAX_INVOICE" | "BILL_OF_SUPPLY" | "CREDIT_NOTE" | "DEBIT_NOTE";
  /** Why the rate is what it is, when the rate alone cannot say. */
  tax_treatment?: "TAXABLE" | "EXEMPT" | "NIL_RATED" | "NON_GST" | "EXPORT" | "SEZ";
  place_of_supply?: string;
  cess_amount?: number;
  is_reverse_charge?: boolean;
  original_invoice_number?: string;
  original_invoice_date?: string;
  /** Which part of the app produced this row. */
  source_document?: "POS" | "INVOICE" | "PURCHASE" | "MANUAL" | "IMPORT";
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
    // No default. '7113' is articles of jewellery — a real code for
    // someone else's business, and a wrong HSN is filed as confidently
    // as a right one. Unset must read as unset so the exception list
    // can ask for it.
    hsn_sac_code,
    base_amount,
    gst_rate,
    is_tax_inclusive = false,
    is_b2b = false,
    document_type = "TAX_INVOICE",
    tax_treatment = "TAXABLE",
    place_of_supply: place_of_supply_input,
    cess_amount = 0,
    is_reverse_charge = false,
    original_invoice_number,
    original_invoice_date,
    source_document,
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

  // Which table of the return this row belongs in. Derived rather than
  // asked for: the facts that decide it — a buyer GSTIN, two state
  // codes, the invoice value — are already known here, and every place
  // that had to state it separately was a place it could be stated
  // wrongly.
  const place_of_supply =
    place_of_supply_input ??
    resolvePlaceOfSupply({
      buyerGstin: gstin,
      sellerStateCode: source_state_code,
      placeOfSupply: destination_state_code,
      invoiceValue: gstCalc.totalAmount,
      gstRate: gst_rate,
    }) ??
    undefined;

  const supply_type: SupplyType =
    ledger_type === "OUTPUT"
      ? classifySupply({
          buyerGstin: gstin,
          sellerStateCode: source_state_code,
          placeOfSupply: place_of_supply,
          invoiceValue: gstCalc.totalAmount,
          gstRate: gst_rate,
          taxTreatment: tax_treatment,
        })
      : // Inward supplies are not bucketed for GSTR-1 at all; they feed
        // ITC in 3B and reconcile against 2B. B2B is the honest label
        // for a purchase from a registered supplier.
        gstin
        ? "B2B"
        : "B2CS";

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

  // Posting is retried — a double-clicked Send, or a response lost after
  // the write committed. A second row here does not look like an error,
  // it looks like a second sale, and it doubles the tax owed in the
  // return. The database enforces this too (one ACTIVE row per document,
  // migration 123); this check makes a retry a no-op rather than a
  // caught constraint violation.
  const { data: existing } = await supabase
    .from("commerce_gst_ledgers")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("ledger_type", ledger_type)
    .eq("invoice_number", invoice_number)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    console.info(
      `[gst] ${invoice_number}: already in the ${ledger_type} ledger, not recording it twice.`,
    );
    return existing;
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
      place_of_supply: place_of_supply || null,
      is_interstate: gstCalc.isInterstate,
      hsn_sac_code: hsn_sac_code || null,
      document_type,
      supply_type,
      taxable_amount: gstCalc.taxableAmount,
      cgst_rate: gstCalc.cgstRate,
      cgst_amount: gstCalc.cgstAmount,
      sgst_rate: gstCalc.sgstRate,
      sgst_amount: gstCalc.sgstAmount,
      igst_rate: gstCalc.igstRate,
      igst_amount: gstCalc.igstAmount,
      total_gst: gstCalc.totalGst,
      cess_amount,
      is_reverse_charge,
      original_invoice_number: original_invoice_number || null,
      original_invoice_date: original_invoice_date || null,
      source_document: source_document || null,
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
