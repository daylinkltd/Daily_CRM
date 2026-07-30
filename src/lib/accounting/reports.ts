// ============================================================
// Financial report computation — pure, unit-testable, no I/O.
//
// Modeled on the company's daylink accounting module:
//   - balances derive from journal lines; account cards never store
//     running balances
//   - Asset/Expense accounts are debit-positive, the rest
//     credit-positive
//   - the Balance Sheet's "Reserves & Surplus" line is NOT a posted
//     entry: it is cumulative net profit (Revenue − Expenses since
//     inception, as we never write year-end closing entries),
//     computed and plugged under Equity so the sheet always balances:
//       Assets = Liabilities + Equity + cumulative net P&L
//   - default reporting period is the Indian financial year
//     (April 1 → today)
// ============================================================

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface ReportAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  ledger_group?: string | null;
  opening_balance?: number | null;
  is_system?: boolean | null;
}

export interface ReportEntry {
  id: string;
  voucher_date: string; // ISO date
  deleted_at?: string | null;
}

export interface ReportLine {
  journal_entry_id: string;
  account_id: string;
  debit_amount: number | null;
  credit_amount: number | null;
}

/** Per-account debit/credit activity for a period and cumulatively. */
export interface AccountActivity {
  periodDebit: number;
  periodCredit: number;
  cumDebit: number;   // inception → end
  cumCredit: number;
}

export function isDebitPositive(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}

/** Signed balance from activity: positive in the account's natural
 *  direction, negative when it flips (e.g. overdrawn bank). */
export function naturalBalance(
  type: AccountType,
  debit: number,
  credit: number,
  opening = 0
): number {
  return isDebitPositive(type) ? opening + debit - credit : opening + credit - debit;
}

/**
 * Aggregate journal lines into per-account activity.
 * `start`/`end` are inclusive ISO dates (YYYY-MM-DD). Soft-deleted
 * entries are excluded entirely.
 */
export function computeActivity(
  entries: ReportEntry[],
  lines: ReportLine[],
  start: string,
  end: string
): Map<string, AccountActivity> {
  const entryDate = new Map<string, string>();
  for (const e of entries) {
    if (e.deleted_at) continue;
    entryDate.set(e.id, e.voucher_date);
  }

  const out = new Map<string, AccountActivity>();
  for (const l of lines) {
    const date = entryDate.get(l.journal_entry_id);
    if (!date || date > end) continue;
    let a = out.get(l.account_id);
    if (!a) {
      a = { periodDebit: 0, periodCredit: 0, cumDebit: 0, cumCredit: 0 };
      out.set(l.account_id, a);
    }
    const d = Number(l.debit_amount ?? 0);
    const c = Number(l.credit_amount ?? 0);
    a.cumDebit += d;
    a.cumCredit += c;
    if (date >= start) {
      a.periodDebit += d;
      a.periodCredit += c;
    }
  }
  return out;
}

/** Indian financial year containing `today`: April 1 → today. */
export function defaultPeriod(today: Date): { start: string; end: string } {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: `${y}-04-01`, end: iso(today) };
}

const EMPTY: AccountActivity = { periodDebit: 0, periodCredit: 0, cumDebit: 0, cumCredit: 0 };

// ── trial balance ────────────────────────────────────────────

export interface TrialBalanceRow {
  account: ReportAccount;
  periodDebit: number;
  periodCredit: number;
  /** Closing balance as-on end, presented Dr/Cr style. */
  closingDebit: number;
  closingCredit: number;
}

export function trialBalance(
  accounts: ReportAccount[],
  activity: Map<string, AccountActivity>
): { rows: TrialBalanceRow[]; totals: { periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number }; isBalanced: boolean } {
  const rows: TrialBalanceRow[] = [];
  for (const acc of accounts) {
    const a = activity.get(acc.id) ?? EMPTY;
    const opening = Number(acc.opening_balance ?? 0);
    const closing = naturalBalance(acc.account_type, a.cumDebit, a.cumCredit, opening);
    // A zero-activity, zero-opening account stays off the report.
    if (a.cumDebit === 0 && a.cumCredit === 0 && opening === 0) continue;
    const debitSide = isDebitPositive(acc.account_type) ? closing >= 0 : closing < 0;
    rows.push({
      account: acc,
      periodDebit: a.periodDebit,
      periodCredit: a.periodCredit,
      closingDebit: debitSide ? Math.abs(closing) : 0,
      closingCredit: debitSide ? 0 : Math.abs(closing),
    });
  }
  const totals = rows.reduce(
    (t, r) => ({
      periodDebit: t.periodDebit + r.periodDebit,
      periodCredit: t.periodCredit + r.periodCredit,
      closingDebit: t.closingDebit + r.closingDebit,
      closingCredit: t.closingCredit + r.closingCredit,
    }),
    { periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 }
  );
  return {
    rows,
    totals,
    isBalanced: Math.abs(totals.closingDebit - totals.closingCredit) < 0.01,
  };
}

// ── profit & loss ────────────────────────────────────────────

export interface PnlRow {
  account: ReportAccount;
  /** Period movement in the account's natural direction. */
  amount: number;
}

export function profitAndLoss(
  accounts: ReportAccount[],
  activity: Map<string, AccountActivity>
): { revenue: PnlRow[]; expenses: PnlRow[]; revenueTotal: number; expenseTotal: number; netProfit: number } {
  const revenue: PnlRow[] = [];
  const expenses: PnlRow[] = [];
  for (const acc of accounts) {
    if (acc.account_type !== "REVENUE" && acc.account_type !== "EXPENSE") continue;
    const a = activity.get(acc.id) ?? EMPTY;
    // P&L is a PERIOD statement: movement between start and end,
    // openings excluded (we never close revenue/expense accounts).
    const amount = naturalBalance(acc.account_type, a.periodDebit, a.periodCredit, 0);
    if (amount === 0 && a.periodDebit === 0 && a.periodCredit === 0) continue;
    (acc.account_type === "REVENUE" ? revenue : expenses).push({ account: acc, amount });
  }
  const revenueTotal = revenue.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expenses.reduce((s, r) => s + r.amount, 0);
  return { revenue, expenses, revenueTotal, expenseTotal, netProfit: revenueTotal - expenseTotal };
}

// ── balance sheet ────────────────────────────────────────────

export interface BalanceSheetSection {
  rows: { account: ReportAccount; balance: number }[];
  total: number;
}

export interface BalanceSheet {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  /**
   * Reserves & Surplus — cumulative net profit (Revenue − Expenses,
   * inception → end). The daylink-style auto-plug from the P&L: it
   * appears under Equity without any posted closing entry.
   */
  reservesAndSurplus: number;
  isBalanced: boolean;
  difference: number;
}

export function balanceSheet(
  accounts: ReportAccount[],
  activity: Map<string, AccountActivity>
): BalanceSheet {
  const section = (): BalanceSheetSection => ({ rows: [], total: 0 });
  const assets = section();
  const liabilities = section();
  const equity = section();
  let cumRevenue = 0;
  let cumExpense = 0;

  for (const acc of accounts) {
    const a = activity.get(acc.id) ?? EMPTY;
    const opening = Number(acc.opening_balance ?? 0);
    const balance = naturalBalance(acc.account_type, a.cumDebit, a.cumCredit, opening);
    switch (acc.account_type) {
      case "ASSET":
        if (balance !== 0) assets.rows.push({ account: acc, balance });
        assets.total += balance;
        break;
      case "LIABILITY":
        if (balance !== 0) liabilities.rows.push({ account: acc, balance });
        liabilities.total += balance;
        break;
      case "EQUITY":
        if (balance !== 0) equity.rows.push({ account: acc, balance });
        equity.total += balance;
        break;
      case "REVENUE":
        cumRevenue += balance;
        break;
      case "EXPENSE":
        cumExpense += balance;
        break;
    }
  }

  const reservesAndSurplus = cumRevenue - cumExpense;
  const rightSide = liabilities.total + equity.total + reservesAndSurplus;
  const difference = assets.total - rightSide;
  return {
    assets,
    liabilities,
    equity,
    reservesAndSurplus,
    isBalanced: Math.abs(difference) < 0.01,
    difference,
  };
}
