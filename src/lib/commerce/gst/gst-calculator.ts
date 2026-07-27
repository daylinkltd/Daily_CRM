/**
 * Core GST Calculator Service
 * Handles tax inclusive/exclusive math, intra-state vs inter-state CGST/SGST/IGST splitting,
 * and 2-decimal precision exponential rounding.
 */

export interface GstCalculationInput {
  baseAmount: number;
  gstRate: number; // e.g. 3, 5, 12, 18, 28
  isTaxInclusive?: boolean;
  sourceStateCode?: string; // e.g. '27' for Maharashtra
  destinationStateCode?: string; // e.g. '29' for Karnataka
}

export interface GstCalculationResult {
  baseAmount: number;
  taxableAmount: number;
  isInterstate: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalGst: number;
  totalAmount: number;
}

/** Round to 2 decimal places using exponential rounding */
function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateGst(input: GstCalculationInput): GstCalculationResult {
  const {
    baseAmount = 0,
    gstRate = 0,
    isTaxInclusive = false,
    sourceStateCode = "27",
    destinationStateCode = "27",
  } = input;

  let taxableAmount = 0;
  let totalGst = 0;

  if (isTaxInclusive) {
    taxableAmount = round2(baseAmount / (1 + gstRate / 100));
    totalGst = round2(baseAmount - taxableAmount);
  } else {
    taxableAmount = round2(baseAmount);
    totalGst = round2(taxableAmount * (gstRate / 100));
  }

  const isInterstate = sourceStateCode !== destinationStateCode;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = gstRate;
    igstAmount = totalGst;
  } else {
    cgstRate = gstRate / 2;
    cgstAmount = round2(totalGst / 2);
    sgstRate = gstRate / 2;
    sgstAmount = round2(totalGst / 2);
  }

  const totalAmount = isTaxInclusive ? round2(baseAmount) : round2(taxableAmount + totalGst);

  return {
    baseAmount,
    taxableAmount,
    isInterstate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalGst,
    totalAmount,
  };
}
