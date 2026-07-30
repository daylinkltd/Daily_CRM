import { describe, expect, it } from "vitest";
import {
  balanceSheet,
  computeActivity,
  defaultPeriod,
  naturalBalance,
  profitAndLoss,
  trialBalance,
  type ReportAccount,
  type ReportEntry,
  type ReportLine,
} from "./reports";

// A tiny books fixture:
//  Jan 10 (before period): sale on credit  — DR AR 500 / CR Revenue 500
//  Apr 05 (in period):     cash sale       — DR Cash 1000 / CR Revenue 1000
//  Apr 20 (in period):     rent paid       — DR Rent 300 / CR Cash 300
//  May 01 (deleted):       must be ignored — DR Cash 999 / CR Revenue 999
const ACCOUNTS: ReportAccount[] = [
  { id: "cash", account_code: "1010", account_name: "Cash", account_type: "ASSET" },
  { id: "ar", account_code: "1050", account_name: "Accounts Receivable", account_type: "ASSET" },
  { id: "rev", account_code: "4010", account_name: "Sales Revenue", account_type: "REVENUE" },
  { id: "rent", account_code: "6010", account_name: "Rent", account_type: "EXPENSE" },
  { id: "capital", account_code: "3010", account_name: "Owner's Equity", account_type: "EQUITY", opening_balance: 0 },
];

const ENTRIES: ReportEntry[] = [
  { id: "e1", voucher_date: "2026-01-10" },
  { id: "e2", voucher_date: "2026-04-05" },
  { id: "e3", voucher_date: "2026-04-20" },
  { id: "e4", voucher_date: "2026-05-01", deleted_at: "2026-05-02T00:00:00Z" },
];

const LINES: ReportLine[] = [
  { journal_entry_id: "e1", account_id: "ar", debit_amount: 500, credit_amount: 0 },
  { journal_entry_id: "e1", account_id: "rev", debit_amount: 0, credit_amount: 500 },
  { journal_entry_id: "e2", account_id: "cash", debit_amount: 1000, credit_amount: 0 },
  { journal_entry_id: "e2", account_id: "rev", debit_amount: 0, credit_amount: 1000 },
  { journal_entry_id: "e3", account_id: "rent", debit_amount: 300, credit_amount: 0 },
  { journal_entry_id: "e3", account_id: "cash", debit_amount: 0, credit_amount: 300 },
  { journal_entry_id: "e4", account_id: "cash", debit_amount: 999, credit_amount: 0 },
  { journal_entry_id: "e4", account_id: "rev", debit_amount: 0, credit_amount: 999 },
];

const PERIOD = { start: "2026-04-01", end: "2026-06-30" };
const activity = () => computeActivity(ENTRIES, LINES, PERIOD.start, PERIOD.end);

describe("computeActivity", () => {
  it("splits period vs cumulative and skips soft-deleted entries", () => {
    const a = activity();
    expect(a.get("cash")).toEqual({ periodDebit: 1000, periodCredit: 300, cumDebit: 1000, cumCredit: 300 });
    // AR moved before the period: cumulative only.
    expect(a.get("ar")).toEqual({ periodDebit: 0, periodCredit: 0, cumDebit: 500, cumCredit: 0 });
    // Revenue: 500 pre-period + 1000 in-period; deleted 999 ignored.
    expect(a.get("rev")).toEqual({ periodDebit: 0, periodCredit: 1000, cumDebit: 0, cumCredit: 1500 });
  });

  it("ignores lines dated after the period end", () => {
    const a = computeActivity(ENTRIES, LINES, "2026-01-01", "2026-01-31");
    expect(a.get("cash")).toBeUndefined();
    expect(a.get("rev")?.cumCredit).toBe(500);
  });
});

describe("naturalBalance", () => {
  it("is debit-positive for assets/expenses, credit-positive otherwise", () => {
    expect(naturalBalance("ASSET", 100, 30)).toBe(70);
    expect(naturalBalance("EXPENSE", 100, 0)).toBe(100);
    expect(naturalBalance("LIABILITY", 30, 100)).toBe(70);
    expect(naturalBalance("REVENUE", 0, 100)).toBe(100);
  });

  it("applies opening balances", () => {
    expect(naturalBalance("ASSET", 100, 30, 50)).toBe(120);
  });
});

describe("trialBalance", () => {
  it("produces Dr/Cr closing columns whose totals balance", () => {
    const tb = trialBalance(ACCOUNTS, activity());
    const byCode = Object.fromEntries(tb.rows.map((r) => [r.account.account_code, r]));
    expect(byCode["1010"].closingDebit).toBe(700);   // cash 1000-300
    expect(byCode["1050"].closingDebit).toBe(500);   // AR
    expect(byCode["4010"].closingCredit).toBe(1500); // revenue cumulative
    expect(byCode["6010"].closingDebit).toBe(300);   // rent
    expect(tb.totals.closingDebit).toBe(1500);
    expect(tb.totals.closingCredit).toBe(1500);
    expect(tb.isBalanced).toBe(true);
  });

  it("omits accounts with no activity and no opening", () => {
    const tb = trialBalance(ACCOUNTS, activity());
    expect(tb.rows.some((r) => r.account.account_code === "3010")).toBe(false);
  });
});

describe("profitAndLoss", () => {
  it("reports PERIOD movement only — pre-period revenue excluded", () => {
    const pnl = profitAndLoss(ACCOUNTS, activity());
    expect(pnl.revenueTotal).toBe(1000); // not the 1500 cumulative
    expect(pnl.expenseTotal).toBe(300);
    expect(pnl.netProfit).toBe(700);
  });
});

describe("balanceSheet", () => {
  it("plugs cumulative net P&L as Reserves & Surplus so the sheet balances", () => {
    const bs = balanceSheet(ACCOUNTS, activity());
    expect(bs.assets.total).toBe(1200);           // cash 700 + AR 500
    expect(bs.liabilities.total).toBe(0);
    expect(bs.equity.total).toBe(0);
    // Cumulative (inception-to-date), NOT the period P&L — otherwise
    // pre-period profit would unbalance the sheet.
    expect(bs.reservesAndSurplus).toBe(1200);     // 1500 revenue - 300 rent
    expect(bs.isBalanced).toBe(true);
    expect(bs.difference).toBe(0);
  });
});

describe("defaultPeriod", () => {
  it("uses the Indian financial year (April 1)", () => {
    expect(defaultPeriod(new Date("2026-07-31T12:00:00Z")).start).toBe("2026-04-01");
    expect(defaultPeriod(new Date("2026-02-15T12:00:00Z")).start).toBe("2025-04-01");
  });
});
