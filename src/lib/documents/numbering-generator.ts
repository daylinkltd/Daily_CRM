/**
 * Indian Financial Year & Sequential Document Numbering Engine
 * 
 * Supports compliant GST Tax Invoice, Bill of Supply (Non-GST), 
 * Quotation, and Credit Note numbering series per Indian Financial Year (Apr-Mar).
 */

export type DocumentTypeKey = 'tax_invoice' | 'bill_of_supply' | 'quotation' | 'credit_note';

export interface DocumentSeriesConfig {
  prefix: string; // e.g. "INV", "BOS", "QTN"
  separator: string; // e.g. "/", "-", "."
  includeFinancialYear: boolean; // e.g. "26-27"
  paddingDigits: number; // e.g. 4 -> "0001"
}

export const DEFAULT_SERIES_CONFIG: Record<DocumentTypeKey, DocumentSeriesConfig> = {
  tax_invoice: {
    prefix: "INV",
    separator: "/",
    includeFinancialYear: true,
    paddingDigits: 4,
  },
  bill_of_supply: {
    prefix: "BOS",
    separator: "/",
    includeFinancialYear: true,
    paddingDigits: 4,
  },
  quotation: {
    prefix: "QTN",
    separator: "-",
    includeFinancialYear: true,
    paddingDigits: 4,
  },
  credit_note: {
    prefix: "CN",
    separator: "/",
    includeFinancialYear: true,
    paddingDigits: 4,
  },
};

/**
 * Returns Indian Financial Year string for a given date.
 * E.g. Date in Aug 2026 -> "26-27"
 * E.g. Date in Jan 2027 -> "26-27"
 * E.g. Date in Apr 2027 -> "27-28"
 */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-indexed (Jan = 1, Apr = 4)
  const fullYear = date.getFullYear();

  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    // April to December
    startYear = fullYear;
    endYear = fullYear + 1;
  } else {
    // January to March
    startYear = fullYear - 1;
    endYear = fullYear;
  }

  const startShort = String(startYear).slice(-2);
  const endShort = String(endYear).slice(-2);

  return `${startShort}-${endShort}`;
}

/**
 * Generates a compliant sequential document number.
 * 
 * Examples:
 * - GST Tax Invoice: `INV/26-27/0001`
 * - Non-GST Bill of Supply: `BOS/26-27/0001`
 * - Quotation: `QTN-26-27-0001`
 */
export function generateDocumentNumber(
  type: DocumentTypeKey = "tax_invoice",
  sequenceNumber: number = 1,
  customConfig?: Partial<DocumentSeriesConfig>,
  date: Date = new Date()
): string {
  const config = { ...DEFAULT_SERIES_CONFIG[type], ...customConfig };
  const fyString = getIndianFinancialYear(date);
  const paddedSequence = String(sequenceNumber).padStart(config.paddingDigits, "0");

  if (config.includeFinancialYear) {
    return `${config.prefix}${config.separator}${fyString}${config.separator}${paddedSequence}`;
  }

  return `${config.prefix}${config.separator}${paddedSequence}`;
}
