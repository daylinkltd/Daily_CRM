// ============================================================
// Which table of GSTR-1 does this sale belong in?
//
// A GST return is not a list of invoices. Every outward supply lands in
// exactly one bucket, and the bucket decides how much detail the
// government sees:
//
//   B2B   — buyer is registered. Reported invoice by invoice, and the
//           buyer claims input credit against these rows, so an error
//           costs someone else money.
//   B2CL  — unregistered buyer, INTER-state, above the invoice-value
//           threshold. Still invoice by invoice.
//   B2CS  — everything else sold to unregistered buyers. Reported only
//           as totals per state per rate.
//
// That last line is why a small shop is the easy case: a counter full of
// walk-in customers collapses into a handful of summed rows, and no
// invoice-level data entry is needed at all.
//
// These functions are pure and take no database. Classification is the
// part that must be arguable in a test rather than discovered in a
// filed return.
// ============================================================

export type SupplyType =
  | 'B2B'
  | 'B2CL'
  | 'B2CS'
  | 'EXPORT'
  | 'SEZ'
  | 'EXEMPT'
  | 'NIL_RATED'
  | 'NON_GST';

/**
 * Invoice value above which an inter-state sale to an unregistered
 * buyer must be reported individually rather than in the B2CS summary.
 *
 * VERIFY BEFORE FILING. This threshold has been revised downward and
 * the effective date matters. ₹1,00,000 is used deliberately as the
 * lower of the candidates: reporting an invoice individually when the
 * summary would have sufficed is accepted by GSTN and merely more
 * detailed, while summarising one that should have been itemised is a
 * defect in the return. When the two readings disagree, over-report.
 */
export const B2CL_INVOICE_VALUE_THRESHOLD = 100_000;

export interface SupplyFacts {
  /** Buyer's GSTIN, if they gave one. Its presence is what makes a sale B2B. */
  buyerGstin?: string | null;
  /** Seller's state code — the workspace's own. */
  sellerStateCode?: string | null;
  /** Where the supply lands. Falls back to the buyer's GSTIN prefix. */
  placeOfSupply?: string | null;
  /** Total invoice value including tax, which is what the threshold tests. */
  invoiceValue: number;
  /** Rate applied. Zero alone does not mean exempt — see `taxTreatment`. */
  gstRate: number;
  /**
   * Why the rate is zero, when it is. A nil-rated supply, an exempt one
   * and a non-GST one are three different rows of the return, and no
   * amount of arithmetic can tell them apart — only the seller knows.
   */
  taxTreatment?: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | 'EXPORT' | 'SEZ';
}

/** A GSTIN's first two characters are the state code. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const raw = gstin?.trim();
  if (!raw || raw.length < 2) return null;
  const code = raw.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Where the supply lands, in order of authority: an explicit place of
 * supply, then the buyer's GSTIN, then the seller's own state.
 *
 * The fallback is the seller's state rather than nothing, because an
 * over-the-counter sale to a walk-in customer genuinely is supplied
 * where the counter is.
 */
export function resolvePlaceOfSupply(facts: SupplyFacts): string | null {
  return (
    facts.placeOfSupply?.trim() ||
    stateCodeFromGstin(facts.buyerGstin) ||
    facts.sellerStateCode?.trim() ||
    null
  );
}

/** True when the supply crosses a state line, which makes the tax IGST. */
export function isInterstate(facts: SupplyFacts): boolean {
  const seller = facts.sellerStateCode?.trim();
  const destination = resolvePlaceOfSupply(facts);
  // Unknown states are treated as intra-state, matching the ledger's
  // behaviour, and the caller warns rather than guessing a state.
  if (!seller || !destination) return false;
  return seller !== destination;
}

/**
 * The GSTR-1 bucket for one outward supply.
 *
 * Order matters. An explicit tax treatment (export, SEZ, exempt) wins
 * over everything, because those are properties of the supply itself. A
 * buyer GSTIN then makes it B2B regardless of value. Only what remains
 * is split by the inter-state value threshold.
 */
export function classifySupply(facts: SupplyFacts): SupplyType {
  const treatment = facts.taxTreatment ?? 'TAXABLE';

  if (treatment === 'EXPORT') return 'EXPORT';
  if (treatment === 'SEZ') return 'SEZ';
  if (treatment === 'NON_GST') return 'NON_GST';
  if (treatment === 'EXEMPT') return 'EXEMPT';
  if (treatment === 'NIL_RATED') return 'NIL_RATED';

  // A registered buyer makes it B2B whatever the amount, because they
  // will claim credit against this exact row.
  if (stateCodeFromGstin(facts.buyerGstin)) return 'B2B';

  if (isInterstate(facts) && facts.invoiceValue > B2CL_INVOICE_VALUE_THRESHOLD) {
    return 'B2CL';
  }

  return 'B2CS';
}

/**
 * Whether this row can be filed as it stands, and what is missing if
 * not.
 *
 * This is the exception list the shop owner sees: everything the return
 * cannot be built from, named in the terms they can act on. It exists
 * so that filing surfaces problems in week one rather than on the 11th.
 */
export interface LedgerExceptionInput {
  supplyType: SupplyType;
  hsnSacCode?: string | null;
  buyerGstin?: string | null;
  sourceStateCode?: string | null;
  placeOfSupply?: string | null;
  invoiceNumber?: string | null;
}

export function ledgerExceptions(row: LedgerExceptionInput): string[] {
  const problems: string[] = [];

  if (!row.sourceStateCode?.trim()) {
    problems.push('Your GST state is not set, so this cannot be split into CGST/SGST or IGST.');
  }
  if (!row.placeOfSupply?.trim()) {
    problems.push('No place of supply, so this cannot be assigned to a state in the return.');
  }
  // B2CS is summarised by rate and state, and needs no HSN per row —
  // demanding one there would bury the shop in busywork for nothing.
  if (row.supplyType !== 'B2CS' && !row.hsnSacCode?.trim()) {
    problems.push('No HSN/SAC code, which this supply must be reported with.');
  }
  if (row.supplyType === 'B2B' && !row.buyerGstin?.trim()) {
    problems.push('Marked B2B but the buyer has no GSTIN — they cannot claim credit for it.');
  }
  if (row.hsnSacCode?.trim() === '7113') {
    problems.push('HSN 7113 is the old jewellery default — confirm it is genuinely this product.');
  }
  if (!row.invoiceNumber?.trim()) {
    problems.push('No document number.');
  }

  return problems;
}
