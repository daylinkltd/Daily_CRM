import { describe, expect, it } from "vitest";

import {
  B2CL_INVOICE_VALUE_THRESHOLD,
  classifySupply,
  isInterstate,
  ledgerExceptions,
  resolvePlaceOfSupply,
  stateCodeFromGstin,
} from "./supply-classification";

/**
 * The bucket decides how the sale is reported, so these are the tests
 * that stand between the ledger and a wrong return. A misfiled B2B sale
 * costs the BUYER their input credit, and nothing in the filing process
 * complains — a B2CS return is perfectly valid, just wrong.
 */

const KARNATAKA = "29";
const MAHARASHTRA = "27";
const KA_GSTIN = "29AABCU9603R1ZM";
const MH_GSTIN = "27AABCU9603R1ZX";

describe("stateCodeFromGstin", () => {
  it("reads the state from the first two digits", () => {
    expect(stateCodeFromGstin(KA_GSTIN)).toBe("29");
  });

  it("rejects anything that is not a two-digit prefix", () => {
    expect(stateCodeFromGstin("NOTAGSTIN")).toBeNull();
    expect(stateCodeFromGstin("")).toBeNull();
    expect(stateCodeFromGstin(null)).toBeNull();
    expect(stateCodeFromGstin(undefined)).toBeNull();
  });
});

describe("resolvePlaceOfSupply", () => {
  const base = { invoiceValue: 1000, gstRate: 18 };

  it("prefers an explicit place of supply over the buyer's registration", () => {
    // Services are not always supplied where the buyer is registered.
    expect(
      resolvePlaceOfSupply({ ...base, placeOfSupply: "07", buyerGstin: KA_GSTIN, sellerStateCode: MAHARASHTRA }),
    ).toBe("07");
  });

  it("falls back to the buyer's GSTIN", () => {
    expect(resolvePlaceOfSupply({ ...base, buyerGstin: KA_GSTIN, sellerStateCode: MAHARASHTRA })).toBe("29");
  });

  it("falls back to the seller's own state for a walk-in buyer", () => {
    // A counter sale genuinely is supplied where the counter is.
    expect(resolvePlaceOfSupply({ ...base, sellerStateCode: KARNATAKA })).toBe("29");
  });

  it("returns null when nothing is known rather than inventing a state", () => {
    expect(resolvePlaceOfSupply(base)).toBeNull();
  });
});

describe("isInterstate", () => {
  const base = { invoiceValue: 1000, gstRate: 18 };

  it("is interstate when the states differ", () => {
    expect(isInterstate({ ...base, sellerStateCode: KARNATAKA, buyerGstin: MH_GSTIN })).toBe(true);
  });

  it("is intra-state when they match", () => {
    expect(isInterstate({ ...base, sellerStateCode: KARNATAKA, buyerGstin: KA_GSTIN })).toBe(false);
  });

  it("treats an unknown seller state as intra-state, matching the ledger", () => {
    expect(isInterstate({ ...base, buyerGstin: MH_GSTIN })).toBe(false);
  });
});

describe("classifySupply", () => {
  const shop = { sellerStateCode: KARNATAKA, gstRate: 18 };

  it("is B2B whenever the buyer gave a GSTIN, however small the sale", () => {
    expect(classifySupply({ ...shop, buyerGstin: KA_GSTIN, invoiceValue: 50 })).toBe("B2B");
  });

  it("is B2CS for a walk-in customer — the small shop's whole day", () => {
    expect(classifySupply({ ...shop, invoiceValue: 450 })).toBe("B2CS");
  });

  it("stays B2CS for a large sale inside the state", () => {
    // Value only promotes a sale to B2CL when it also crosses a border.
    expect(classifySupply({ ...shop, invoiceValue: 500_000 })).toBe("B2CS");
  });

  it("is B2CL for a large inter-state sale to an unregistered buyer", () => {
    expect(
      classifySupply({ ...shop, placeOfSupply: MAHARASHTRA, invoiceValue: B2CL_INVOICE_VALUE_THRESHOLD + 1 }),
    ).toBe("B2CL");
  });

  it("stays B2CS exactly at the threshold — the rule is 'above', not 'at'", () => {
    expect(
      classifySupply({ ...shop, placeOfSupply: MAHARASHTRA, invoiceValue: B2CL_INVOICE_VALUE_THRESHOLD }),
    ).toBe("B2CS");
  });

  it("lets a declared tax treatment override the arithmetic", () => {
    // A zero rate cannot say WHY it is zero; only the seller can.
    expect(classifySupply({ ...shop, gstRate: 0, invoiceValue: 900, taxTreatment: "EXEMPT" })).toBe("EXEMPT");
    expect(classifySupply({ ...shop, gstRate: 0, invoiceValue: 900, taxTreatment: "NIL_RATED" })).toBe("NIL_RATED");
    expect(classifySupply({ ...shop, invoiceValue: 900, taxTreatment: "EXPORT" })).toBe("EXPORT");
  });

  it("keeps an export an export even when the buyer is registered here", () => {
    expect(
      classifySupply({ ...shop, buyerGstin: KA_GSTIN, invoiceValue: 900, taxTreatment: "SEZ" }),
    ).toBe("SEZ");
  });
});

describe("ledgerExceptions", () => {
  const clean = {
    supplyType: "B2B" as const,
    hsnSacCode: "8471",
    buyerGstin: KA_GSTIN,
    sourceStateCode: KARNATAKA,
    placeOfSupply: KARNATAKA,
    invoiceNumber: "INV/000001",
  };

  it("passes a complete row", () => {
    expect(ledgerExceptions(clean)).toEqual([]);
  });

  it("does not demand an HSN for B2CS, which is summarised by rate", () => {
    // Requiring one here would bury a shop in data entry for a field
    // the return never asks them for.
    const row = { ...clean, supplyType: "B2CS" as const, hsnSacCode: null, buyerGstin: null };
    expect(ledgerExceptions(row)).toEqual([]);
  });

  it("demands an HSN for B2B", () => {
    expect(ledgerExceptions({ ...clean, hsnSacCode: null })).toContain(
      "No HSN/SAC code, which this supply must be reported with.",
    );
  });

  it("catches a B2B row with no buyer GSTIN, naming who it costs", () => {
    const problems = ledgerExceptions({ ...clean, buyerGstin: null });
    expect(problems.some((p) => p.includes("cannot claim credit"))).toBe(true);
  });

  it("flags the old jewellery default rather than trusting it", () => {
    const problems = ledgerExceptions({ ...clean, hsnSacCode: "7113" });
    expect(problems.some((p) => p.includes("7113"))).toBe(true);
  });

  it("catches a missing state, which decides CGST/SGST versus IGST", () => {
    const problems = ledgerExceptions({ ...clean, sourceStateCode: null });
    expect(problems.some((p) => p.includes("CGST/SGST"))).toBe(true);
  });
});
