// ============================================================
// Central double-entry posting engine.
//
// Every module that moves money posts through here — POS, khata
// collections, purchases, returns, invoices, payroll, expenses.
// Modules never insert into commerce_journal_entries/_lines
// directly; this file is the one place that knows how.
//
// Guarantees (belt) on top of the DB (braces, migration 075):
//   - lines are validated to balance before anything is written
//   - the same source document can't post twice (unique index;
//     a duplicate resolves to the existing voucher, not an error)
//   - all legs of an entry are written in ONE insert statement, so
//     the deferred balance trigger accepts or rejects atomically
//   - a header whose lines failed is compensated (deleted), never
//     left orphaned — that bug is how the corrupt khata vouchers
//     of pre-075 were born
//
// Modeled on the company's internal daylink accounting module:
// vouchers carry an approval status (system postings auto-approve),
// ledger accounts are found by role, balances derive from lines.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ── account catalog ─────────────────────────────────────────

/** Role → the account the posting rules target. Mirrors the
 *  sub_category CHECK widened in migration 075. */
export type AccountRole =
  | "CASH"
  | "BANK"
  | "CHEQUE_IN_HAND"
  | "CUSTOMER_KHATA"
  | "SALES_REVENUE"
  | "TAX_PAYABLE"
  | "PURCHASE_EXPENSE"
  | "ACCOUNTS_RECEIVABLE"
  | "ACCOUNTS_PAYABLE"
  | "GST_OUTPUT"
  | "GST_INPUT"
  | "SALARY_EXPENSE"
  | "SALARIES_PAYABLE"
  | "SALES_RETURNS"
  | "GENERAL_EXPENSE"
  | "INVENTORY"
  | "OWNERS_EQUITY";

export interface CatalogAccount {
  account_code: string;
  account_name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  sub_category: AccountRole;
}

/**
 * The default chart of accounts a workspace gets on first posting.
 * Superset of the 6 accounts the POS engine used to seed — same
 * codes kept so existing workspaces gain the new accounts without
 * duplicating the old ones.
 */
export const DEFAULT_ACCOUNTS: readonly CatalogAccount[] = [
  { account_code: "1010", account_name: "Cash in Hand", account_type: "ASSET", sub_category: "CASH" },
  { account_code: "1020", account_name: "Bank", account_type: "ASSET", sub_category: "BANK" },
  { account_code: "1030", account_name: "Cheques in Hand", account_type: "ASSET", sub_category: "CHEQUE_IN_HAND" },
  { account_code: "1040", account_name: "Customer Khata (Accounts Receivable)", account_type: "ASSET", sub_category: "CUSTOMER_KHATA" },
  { account_code: "1050", account_name: "Accounts Receivable (Invoices)", account_type: "ASSET", sub_category: "ACCOUNTS_RECEIVABLE" },
  { account_code: "1130", account_name: "GST Input Credit", account_type: "ASSET", sub_category: "GST_INPUT" },
  { account_code: "1200", account_name: "Inventory", account_type: "ASSET", sub_category: "INVENTORY" },
  { account_code: "2010", account_name: "Accounts Payable (Suppliers)", account_type: "LIABILITY", sub_category: "ACCOUNTS_PAYABLE" },
  { account_code: "2120", account_name: "Salaries Payable", account_type: "LIABILITY", sub_category: "SALARIES_PAYABLE" },
  { account_code: "2210", account_name: "GST Output Payable", account_type: "LIABILITY", sub_category: "GST_OUTPUT" },
  { account_code: "3010", account_name: "Owner's Equity", account_type: "EQUITY", sub_category: "OWNERS_EQUITY" },
  { account_code: "4010", account_name: "Sales Revenue", account_type: "REVENUE", sub_category: "SALES_REVENUE" },
  { account_code: "4910", account_name: "Sales Returns", account_type: "REVENUE", sub_category: "SALES_RETURNS" },
  { account_code: "5010", account_name: "Purchases", account_type: "EXPENSE", sub_category: "PURCHASE_EXPENSE" },
  { account_code: "5110", account_name: "Salary Expense", account_type: "EXPENSE", sub_category: "SALARY_EXPENSE" },
  { account_code: "6010", account_name: "General Expenses", account_type: "EXPENSE", sub_category: "GENERAL_EXPENSE" },
] as const;

export type AccountMap = Record<AccountRole, { id: string; account_code: string }>;

/**
 * Seed any missing default accounts for the workspace and return
 * the role → account map the posting rules resolve against.
 */
export async function ensureAccounts(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<AccountMap> {
  const { data: existing, error } = await supabase
    .from("commerce_chart_of_accounts")
    .select("id, account_code, sub_category")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Failed to read chart of accounts: ${error.message}`);

  const byCode = new Set((existing ?? []).map((a) => a.account_code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !byCode.has(a.account_code));

  if (missing.length > 0) {
    const { error: insErr } = await supabase
      .from("commerce_chart_of_accounts")
      .insert(missing.map((a) => ({ ...a, workspace_id: workspaceId, is_system: true })));
    // A concurrent seeder may have won the race; only real failures matter.
    if (insErr && insErr.code !== "23505") {
      throw new Error(`Failed to seed default accounts: ${insErr.message}`);
    }
  }

  const { data: all, error: reErr } = await supabase
    .from("commerce_chart_of_accounts")
    .select("id, account_code, sub_category")
    .eq("workspace_id", workspaceId);
  if (reErr || !all) throw new Error(`Failed to re-read chart of accounts: ${reErr?.message}`);

  const map = {} as AccountMap;
  for (const acc of all) {
    const role = acc.sub_category as AccountRole | null;
    // First account per role wins; custom duplicates don't override
    // the system account posting rules target.
    if (role && !map[role]) map[role] = { id: acc.id, account_code: acc.account_code };
  }
  return map;
}

// ── payment-mode → account resolution ───────────────────────

/** Payment modes accepted from every caller. `KHATA` is the sales-
 *  order enum spelling, `KHATA_CREDIT` the engine's — both were in
 *  live use, and the mismatch silently debited credit sales to Cash
 *  in Hand. Both now resolve identically. */
export type PaymentMode =
  | "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE"
  | "KHATA" | "KHATA_CREDIT" | "BANK";

export function roleForPaymentMode(mode: string): AccountRole {
  switch ((mode || "").toUpperCase()) {
    case "CASH": return "CASH";
    case "UPI":
    case "CARD":
    case "BANK_TRANSFER":
    case "BANK": return "BANK";
    case "CHEQUE": return "CHEQUE_IN_HAND";
    case "KHATA":
    case "KHATA_CREDIT": return "CUSTOMER_KHATA";
    default: return "CASH";
  }
}

export function isKhataMode(mode: string): boolean {
  const m = (mode || "").toUpperCase();
  return m === "KHATA" || m === "KHATA_CREDIT";
}

/**
 * Resolve a commerce_bank_accounts id to the chart-of-accounts
 * ledger it maps to (`ledger_id`). Non-UUID or unknown values fall
 * back to the default BANK account — the POS UI historically sent a
 * free-text label here, which must never reach a journal line.
 */
export async function resolveBankLedger(
  supabase: SupabaseClient,
  workspaceId: string,
  bankAccountId: string | undefined | null,
  fallback: { id: string }
): Promise<string> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!bankAccountId || !UUID_RE.test(bankAccountId)) return fallback.id;
  const { data } = await supabase
    .from("commerce_bank_accounts")
    .select("ledger_id")
    .eq("workspace_id", workspaceId)
    .eq("id", bankAccountId)
    .maybeSingle();
  return data?.ledger_id || fallback.id;
}

// ── journal posting ──────────────────────────────────────────

export interface PostingLine {
  /** Resolve the account by role… */
  role?: AccountRole;
  /** …or target an exact chart-of-accounts id. */
  account_id?: string;
  debit?: number;
  credit?: number;
  contact_id?: string | null;
}

export interface PostingRequest {
  workspace_id: string;
  reference_type:
    | "POS_SALE" | "KHATA_COLLECTION" | "CHEQUE_CLEARANCE" | "EXPENSE" | "MANUAL_JOURNAL"
    | "INVOICE" | "INVOICE_PAYMENT" | "CREDIT_NOTE"
    | "PURCHASE" | "PURCHASE_PAYMENT" | "SALES_RETURN" | "PAYROLL";
  /** Source document id. Required for one-shot types (the DB
   *  enforces one posting per source). */
  reference_id?: string | null;
  narration: string;
  created_by?: string | null;
  utr_number?: string | null;
  lines: PostingLine[];
}

export interface PostingResult {
  journal_entry_id: string;
  voucher_number: string;
  /** True when the source document had already been posted and the
   *  existing voucher was returned instead of a new one. */
  already_posted: boolean;
}

const BALANCE_TOLERANCE = 0.005;

/**
 * Pure validation — exported for unit tests. Returns an error
 * string or null.
 */
export function validateLines(lines: PostingLine[]): string | null {
  if (!Array.isArray(lines) || lines.length < 2) {
    return "A journal entry needs at least two lines";
  }
  let debits = 0;
  let credits = 0;
  for (const [i, l] of lines.entries()) {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (!Number.isFinite(d) || !Number.isFinite(c)) return `Line ${i + 1}: amounts must be numbers`;
    if (d < 0 || c < 0) return `Line ${i + 1}: negative amounts are not allowed`;
    if (d > 0 && c > 0) return `Line ${i + 1}: a line is a debit or a credit, not both`;
    if (d === 0 && c === 0) return `Line ${i + 1}: zero-amount line`;
    if (!l.role && !l.account_id) return `Line ${i + 1}: no account (role or account_id)`;
    debits += d;
    credits += c;
  }
  if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
    return `Entry does not balance: debits ${debits.toFixed(2)} vs credits ${credits.toFixed(2)}`;
  }
  return null;
}

/**
 * Post a balanced journal entry. Resolves roles to accounts,
 * numbers the voucher, writes header + all lines. Duplicate
 * postings of the same source resolve to the existing voucher.
 */
export async function postJournal(
  supabase: SupabaseClient,
  req: PostingRequest
): Promise<PostingResult> {
  const problem = validateLines(req.lines);
  if (problem) throw new Error(`Refusing to post: ${problem}`);

  const accounts = await ensureAccounts(supabase, req.workspace_id);

  const resolved = req.lines.map((l) => {
    const accountId = l.account_id ?? (l.role ? accounts[l.role]?.id : undefined);
    if (!accountId) {
      throw new Error(`Refusing to post: no account for role ${l.role}`);
    }
    return {
      account_id: accountId,
      contact_id: l.contact_id ?? null,
      debit_amount: Number(l.debit ?? 0),
      credit_amount: Number(l.credit ?? 0),
    };
  });

  // Atomic per-workspace sequence (falls back to a random suffix
  // when the workspace has no JOURNAL series row).
  const { data: voucherNumber } = await supabase.rpc("generate_next_document_number", {
    p_workspace_id: req.workspace_id,
    p_document_type: "JOURNAL",
  });
  const voucher = (voucherNumber as string) || `JV-${Date.now().toString(36).toUpperCase()}`;

  const { data: header, error: headErr } = await supabase
    .from("commerce_journal_entries")
    .insert({
      workspace_id: req.workspace_id,
      voucher_number: voucher,
      reference_type: req.reference_type,
      reference_id: req.reference_id ?? null,
      narration: req.narration,
      created_by: req.created_by ?? null,
      utr_number: req.utr_number ?? null,
    })
    .select("id, voucher_number")
    .single();

  if (headErr) {
    // 23505 on (workspace, reference_type, reference_id) = this
    // source document is already posted. Return the existing voucher.
    if (headErr.code === "23505" && req.reference_id) {
      const { data: existing } = await supabase
        .from("commerce_journal_entries")
        .select("id, voucher_number")
        .eq("workspace_id", req.workspace_id)
        .eq("reference_type", req.reference_type)
        .eq("reference_id", req.reference_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) {
        return {
          journal_entry_id: existing.id,
          voucher_number: existing.voucher_number,
          already_posted: true,
        };
      }
    }
    throw new Error(`Failed to create journal entry: ${headErr.message}`);
  }

  // One insert = one transaction = the DB balance trigger accepts or
  // rejects all legs together.
  const { error: linesErr } = await supabase
    .from("commerce_journal_lines")
    .insert(resolved.map((l) => ({ ...l, journal_entry_id: header.id })));

  if (linesErr) {
    // Compensate: never leave a headerless voucher (the pre-075 bug).
    await supabase.from("commerce_journal_entries").delete().eq("id", header.id);
    throw new Error(`Failed to write journal lines: ${linesErr.message}`);
  }

  return {
    journal_entry_id: header.id,
    voucher_number: header.voucher_number,
    already_posted: false,
  };
}

// ── domain posting rules ─────────────────────────────────────
// One function per money event. Callers pass amounts; the rules
// know the accounts. All of them throw on validation failure and
// resolve idempotently on repeats.

/** Khata (udhar) collection: DR Cash/Bank/Cheque, CR Customer Khata. */
export async function postKhataCollection(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    contact_id: string;
    amount: number;
    payment_mode: string;
    narration?: string;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "KHATA_COLLECTION",
    reference_id: null, // repeatable by design
    narration: args.narration || `Khata collection via ${args.payment_mode}`,
    created_by: args.created_by,
    lines: [
      { role: roleForPaymentMode(args.payment_mode), debit: args.amount },
      { role: "CUSTOMER_KHATA", credit: args.amount, contact_id: args.contact_id },
    ],
  });
}

/** Purchase received: DR Purchases, CR Accounts Payable. */
export async function postPurchaseReceived(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    purchase_order_id: string;
    po_number: string;
    total_amount: number;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "PURCHASE",
    reference_id: args.purchase_order_id,
    narration: `Goods received against PO #${args.po_number}`,
    created_by: args.created_by,
    lines: [
      { role: "PURCHASE_EXPENSE", debit: args.total_amount },
      { role: "ACCOUNTS_PAYABLE", credit: args.total_amount },
    ],
  });
}

/** Sales return: DR Sales Returns (contra revenue), CR refund leg. */
export async function postSalesReturn(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    return_id: string;
    return_number: string;
    amount: number;
    refund_mode: string; // CASH | BANK | KHATA_CREDIT | STORE_CREDIT_VOUCHER
    contact_id?: string | null;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  const refundRole: AccountRole =
    args.refund_mode === "BANK" ? "BANK"
    : args.refund_mode === "KHATA_CREDIT" || args.refund_mode === "STORE_CREDIT_VOUCHER"
      ? "CUSTOMER_KHATA"
      : "CASH";
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "SALES_RETURN",
    reference_id: args.return_id,
    narration: `Refund for return #${args.return_number} via ${args.refund_mode}`,
    created_by: args.created_by,
    lines: [
      { role: "SALES_RETURNS", debit: args.amount },
      { role: refundRole, credit: args.amount, contact_id: args.contact_id ?? null },
    ],
  });
}

/** Invoice issued: DR Accounts Receivable, CR Revenue (+ CR GST). */
export async function postInvoiceIssued(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    invoice_id: string;
    invoice_number: string;
    contact_id?: string | null;
    total_amount: number;
    tax_amount?: number;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  const tax = Number(args.tax_amount ?? 0);
  const revenue = args.total_amount - tax;
  const lines: PostingLine[] = [
    { role: "ACCOUNTS_RECEIVABLE", debit: args.total_amount, contact_id: args.contact_id ?? null },
    { role: "SALES_REVENUE", credit: revenue },
  ];
  if (tax > 0) lines.push({ role: "GST_OUTPUT", credit: tax });
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "INVOICE",
    reference_id: args.invoice_id,
    narration: `Invoice ${args.invoice_number} issued`,
    created_by: args.created_by,
    lines,
  });
}

/** Invoice payment: DR Cash/Bank, CR Accounts Receivable. */
export async function postInvoicePayment(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    payment_id: string;
    invoice_number: string;
    contact_id?: string | null;
    amount: number;
    mode: string;
    bank_account_id?: string | null;
    reference_number?: string | null;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  const role = roleForPaymentMode(args.mode);
  let debitLine: PostingLine = { role, debit: args.amount };
  if (role === "BANK" && args.bank_account_id) {
    const accounts = await ensureAccounts(supabase, args.workspace_id);
    const ledgerId = await resolveBankLedger(
      supabase, args.workspace_id, args.bank_account_id, accounts.BANK
    );
    debitLine = { account_id: ledgerId, debit: args.amount };
  }
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "INVOICE_PAYMENT",
    reference_id: args.payment_id,
    narration: `Payment received against invoice ${args.invoice_number}`,
    created_by: args.created_by,
    utr_number: args.reference_number ?? null,
    lines: [
      debitLine,
      { role: "ACCOUNTS_RECEIVABLE", credit: args.amount, contact_id: args.contact_id ?? null },
    ],
  });
}

/** Expense reimbursed/paid: DR General Expenses, CR Cash/Bank. */
export async function postExpensePaid(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    expense_id: string;
    amount: number;
    category?: string;
    payment_mode?: string;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "EXPENSE",
    reference_id: args.expense_id,
    narration: `Expense${args.category ? ` (${args.category})` : ""} reimbursed`,
    created_by: args.created_by,
    lines: [
      { role: "GENERAL_EXPENSE", debit: args.amount },
      { role: roleForPaymentMode(args.payment_mode || "CASH"), credit: args.amount },
    ],
  });
}

/** Payroll cycle processed: DR Salary Expense, CR Salaries Payable.
 *  (Payment of the liability posts separately when the cycle is
 *  marked paid: DR Salaries Payable, CR Bank.) */
export async function postPayrollProcessed(
  supabase: SupabaseClient,
  args: {
    workspace_id: string;
    payroll_cycle_id: string;
    period_label: string;
    total_net_payable: number;
    created_by?: string | null;
  }
): Promise<PostingResult> {
  return postJournal(supabase, {
    workspace_id: args.workspace_id,
    reference_type: "PAYROLL",
    reference_id: args.payroll_cycle_id,
    narration: `Payroll processed for ${args.period_label}`,
    created_by: args.created_by,
    lines: [
      { role: "SALARY_EXPENSE", debit: args.total_net_payable },
      { role: "SALARIES_PAYABLE", credit: args.total_net_payable },
    ],
  });
}
