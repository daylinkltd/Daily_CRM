import { describe, it, expect } from "vitest";
import {
  generateDocumentNumber,
  getIndianFinancialYear,
} from "./numbering-generator";

describe("Document Numbering Generator", () => {
  it("calculates Indian Financial Year correctly", () => {
    // August 2026 -> FY 26-27
    const augDate = new Date(2026, 7, 11);
    expect(getIndianFinancialYear(augDate)).toBe("26-27");

    // January 2027 -> FY 26-27
    const janDate = new Date(2027, 0, 15);
    expect(getIndianFinancialYear(janDate)).toBe("26-27");

    // April 2027 -> FY 27-28
    const aprDate = new Date(2027, 3, 1);
    expect(getIndianFinancialYear(aprDate)).toBe("27-28");
  });

  it("generates compliant GST Tax Invoice numbers", () => {
    const augDate = new Date(2026, 7, 11);
    const invoiceNum = generateDocumentNumber("tax_invoice", 1, {}, augDate);
    expect(invoiceNum).toBe("INV/26-27/0001");
  });

  it("generates separate Non-GST Bill of Supply numbers", () => {
    const augDate = new Date(2026, 7, 11);
    const bosNum = generateDocumentNumber("bill_of_supply", 5, {}, augDate);
    expect(bosNum).toBe("BOS/26-27/0005");
  });

  it("generates Quotation document numbers", () => {
    const augDate = new Date(2026, 7, 11);
    const qtnNum = generateDocumentNumber("quotation", 12, {}, augDate);
    expect(qtnNum).toBe("QTN-26-27-0012");
  });
});
