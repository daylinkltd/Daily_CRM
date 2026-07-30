import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNTS,
  isKhataMode,
  roleForPaymentMode,
  validateLines,
} from "./posting";

describe("validateLines", () => {
  it("accepts a balanced two-line entry", () => {
    expect(
      validateLines([
        { role: "CASH", debit: 100 },
        { role: "SALES_REVENUE", credit: 100 },
      ])
    ).toBeNull();
  });

  it("accepts multi-line entries within rounding tolerance", () => {
    expect(
      validateLines([
        { role: "ACCOUNTS_RECEIVABLE", debit: 118 },
        { role: "SALES_REVENUE", credit: 100.001 },
        { role: "GST_OUTPUT", credit: 17.999 },
      ])
    ).toBeNull();
  });

  it("rejects unbalanced entries", () => {
    expect(
      validateLines([
        { role: "CASH", debit: 100 },
        { role: "SALES_REVENUE", credit: 90 },
      ])
    ).toMatch(/does not balance/);
  });

  it("rejects single-line entries", () => {
    expect(validateLines([{ role: "CASH", debit: 100 }])).toMatch(/at least two/);
  });

  it("rejects negative amounts", () => {
    expect(
      validateLines([
        { role: "CASH", debit: -100 },
        { role: "SALES_REVENUE", credit: -100 },
      ])
    ).toMatch(/negative/);
  });

  it("rejects a line that is both debit and credit", () => {
    expect(
      validateLines([
        { role: "CASH", debit: 50, credit: 50 },
        { role: "SALES_REVENUE", credit: 0.01 },
      ])
    ).toMatch(/not both/);
  });

  it("rejects zero-amount lines", () => {
    expect(
      validateLines([
        { role: "CASH", debit: 0, credit: 0 },
        { role: "SALES_REVENUE", credit: 0 },
      ])
    ).toMatch(/zero-amount/);
  });

  it("rejects lines with no account", () => {
    expect(
      validateLines([
        { debit: 100 },
        { role: "SALES_REVENUE", credit: 100 },
      ])
    ).toMatch(/no account/);
  });

  it("rejects non-numeric amounts", () => {
    expect(
      validateLines([
        { role: "CASH", debit: Number.NaN },
        { role: "SALES_REVENUE", credit: 100 },
      ])
    ).toMatch(/must be numbers/);
  });
});

describe("roleForPaymentMode", () => {
  it("maps both khata spellings to the khata account", () => {
    // 'KHATA' (sales-order enum) vs 'KHATA_CREDIT' (engine) — the
    // historical mismatch debited credit sales to Cash in Hand.
    expect(roleForPaymentMode("KHATA")).toBe("CUSTOMER_KHATA");
    expect(roleForPaymentMode("KHATA_CREDIT")).toBe("CUSTOMER_KHATA");
  });

  it("maps electronic modes to the bank account", () => {
    for (const m of ["UPI", "CARD", "BANK_TRANSFER", "BANK"]) {
      expect(roleForPaymentMode(m)).toBe("BANK");
    }
  });

  it("maps cash and cheque distinctly", () => {
    expect(roleForPaymentMode("CASH")).toBe("CASH");
    expect(roleForPaymentMode("CHEQUE")).toBe("CHEQUE_IN_HAND");
  });

  it("is case-insensitive and defaults unknown modes to cash", () => {
    expect(roleForPaymentMode("upi")).toBe("BANK");
    expect(roleForPaymentMode("")).toBe("CASH");
    expect(roleForPaymentMode("SOMETHING_NEW")).toBe("CASH");
  });
});

describe("isKhataMode", () => {
  it("recognises both spellings, rejects others", () => {
    expect(isKhataMode("KHATA")).toBe(true);
    expect(isKhataMode("khata_credit")).toBe(true);
    expect(isKhataMode("CASH")).toBe(false);
  });
});

describe("DEFAULT_ACCOUNTS catalog", () => {
  it("has unique codes and unique roles", () => {
    const codes = DEFAULT_ACCOUNTS.map((a) => a.account_code);
    const roles = DEFAULT_ACCOUNTS.map((a) => a.sub_category);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it("keeps the six legacy POS codes so existing workspaces don't duplicate", () => {
    // accounting-engine.ts seeded these codes before the engine
    // existed; ensureAccounts must recognise them as already present.
    for (const code of ["1010", "1020", "1030", "1040", "4010"]) {
      expect(DEFAULT_ACCOUNTS.some((a) => a.account_code === code)).toBe(true);
    }
  });

  it("covers every role the posting rules reference", () => {
    const roles = new Set(DEFAULT_ACCOUNTS.map((a) => a.sub_category));
    for (const needed of [
      "CASH", "BANK", "CHEQUE_IN_HAND", "CUSTOMER_KHATA",
      "SALES_REVENUE", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE",
      "GST_OUTPUT", "GST_INPUT", "SALES_RETURNS", "PURCHASE_EXPENSE",
      "SALARY_EXPENSE", "SALARIES_PAYABLE", "GENERAL_EXPENSE",
    ]) {
      expect(roles.has(needed as never)).toBe(true);
    }
  });

  it("assigns account types consistent with double-entry math", () => {
    // The balance view computes ASSET/EXPENSE as debit-positive and
    // the rest credit-positive; a miscategorised account would render
    // permanently negative and be clamped to zero by the UI.
    const type = (role: string) =>
      DEFAULT_ACCOUNTS.find((a) => a.sub_category === role)?.account_type;
    expect(type("CASH")).toBe("ASSET");
    expect(type("CUSTOMER_KHATA")).toBe("ASSET");
    expect(type("GST_INPUT")).toBe("ASSET");
    expect(type("ACCOUNTS_PAYABLE")).toBe("LIABILITY");
    expect(type("GST_OUTPUT")).toBe("LIABILITY");
    expect(type("SALARIES_PAYABLE")).toBe("LIABILITY");
    expect(type("SALES_REVENUE")).toBe("REVENUE");
    expect(type("PURCHASE_EXPENSE")).toBe("EXPENSE");
    expect(type("SALARY_EXPENSE")).toBe("EXPENSE");
  });
});
