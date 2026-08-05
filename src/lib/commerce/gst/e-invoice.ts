/**
 * E-invoicing (IRN) — NOT YET CONNECTED TO THE IRP.
 *
 * ============================================================
 * WHY THIS FILE NO LONGER GENERATES ANYTHING
 * ============================================================
 *
 * It used to. `generateEInvoiceIRN` built a 64-character hex string by
 * walking the characters of "sellerGstin-docNo-docDate-buyerGstin-total",
 * invented an acknowledgement number from `Date.now()`, and base64-encoded
 * a JSON blob as the "signed QR". None of it came from anywhere. The
 * result was written to `commerce_gst_ledgers.irn_number`, shown in the UI
 * as "IRN Active" under a heading reading "Signed E-Invoice IRN & QR", and
 * included in the exported GST report.
 *
 * A real IRN is issued by the Invoice Registration Portal, and the QR is
 * signed by the government's private key. A locally invented one is not a
 * weaker version of that — it is a fabricated government acknowledgement.
 * A customer who trusted the badge would believe invoices were registered
 * when they were not: their buyers cannot claim input tax credit, and the
 * penalty for a missing e-invoice falls on the seller, not on us.
 *
 * So the fabrication is deleted rather than improved. An empty
 * `irn_number` is honest and merely incomplete; a fake one is a false
 * statement that the product makes on the customer's behalf.
 *
 * ============================================================
 * WHAT REPLACING THIS PROPERLY LOOKS LIKE
 * ============================================================
 *
 * IRNs cannot be computed locally by anyone, ever. The flow is:
 *
 *   1. Register with a GSP / ASP (ClearTax, Masters India, Zoho, IRIS…)
 *      or directly with the NIC IRP sandbox.
 *   2. Authenticate to get a short-lived token.
 *   3. POST the invoice in the IRP's schema (currently 1.1).
 *   4. Store the IRN, AckNo, AckDt and SignedQRCode EXACTLY as returned.
 *   5. Handle the duplicate-IRN response (error 2150) as success — the
 *      invoice is already registered, which is not a failure.
 *   6. Support cancellation, which is only allowed within 24 hours.
 *
 * `recordIrpResponse` below is the only sanctioned way to populate those
 * columns: it validates the shape of a response that came from outside and
 * refuses anything that looks locally invented.
 */

/** What the IRP returns and we are allowed to persist. */
export interface IrpAcknowledgement {
  /** 64-character hash issued by the IRP. Never computed here. */
  irn: string;
  ackNo: string;
  /** IRP acknowledgement timestamp, as returned. */
  ackDate: string;
  /** The government-signed QR payload, verbatim. */
  signedQrCode: string;
}

export interface IrnColumns {
  irn_number: string | null;
  ack_number: string | null;
  ack_date: string | null;
  qr_code_payload: string | null;
}

/** The only honest value while no IRP integration exists. */
export const NO_IRN: IrnColumns = {
  irn_number: null,
  ack_number: null,
  ack_date: null,
  qr_code_payload: null,
};

/**
 * Map a genuine IRP acknowledgement onto the ledger columns.
 *
 * Validates rather than trusts, because the point of this module is that
 * only a real acknowledgement reaches the database. A 64-char lowercase
 * hex IRN and a non-empty signed QR are the minimum an IRP response has;
 * anything else is either a bug in the integration or a fabrication, and
 * both should be dropped rather than stored.
 */
export function recordIrpResponse(ack: IrpAcknowledgement | null): IrnColumns {
  if (!ack) return NO_IRN;

  const irn = String(ack.irn || '').trim();
  const qr = String(ack.signedQrCode || '').trim();

  if (!/^[0-9a-f]{64}$/i.test(irn) || !qr) return NO_IRN;

  return {
    irn_number: irn,
    ack_number: String(ack.ackNo || '').trim() || null,
    ack_date: ack.ackDate || null,
    qr_code_payload: qr,
  };
}

/**
 * Whether this workspace can register e-invoices at all.
 *
 * Currently always false: no GSP credentials exist in any environment.
 * Kept as a function rather than a constant so the call sites are already
 * written correctly for the day the integration lands.
 */
export function isEInvoicingConfigured(): boolean {
  return Boolean(process.env.GSP_API_BASE_URL && process.env.GSP_API_KEY);
}
