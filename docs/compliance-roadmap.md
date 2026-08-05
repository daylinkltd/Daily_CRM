# Closing the gaps — plan and structure

Written 2026-08-06. This is the engineering plan behind the roadmap section
on `/compare`. Each item leaves that list only when it ships.

The scoping below is based on the **live schema** (181 tables, read via
PostgREST's OpenAPI doc), not on assumptions. That mattered: several items
turned out to be far smaller than they looked, and one turned out to be a
defect rather than a gap.

---

## 0. Already fixed while scoping this

These were not gaps. They were shipping code making false claims, and they
are done (commit `4043b4b`).

| Defect | What it did | Fix |
|---|---|---|
| Fabricated IRNs | Built a fake 64-char IRN locally, stored it, showed "IRN Active", exported it in the GST report | Deleted. `recordIrpResponse()` is now the only writer, and validates the response came from outside |
| Hardcoded Maharashtra | `source_state_code`/`destination_state_code` both defaulted to `'27'`, so every sale booked intra-state whatever the workspace | Seller state from the workspace (migration 099), buyer state from their GSTIN's first two digits |
| Placeholder seller GSTIN | `'27AAAAA0000A1Z5'`, belonging to nobody | Removed; workspace GSTIN is now a real field |

**Action required:** paste `supabase/migrations/099_workspace_gst_identity.sql`.
It carries its own verification queries.

---

## What already exists (so the estimates are honest)

The accounting spine is real and does not need rebuilding:

- `commerce_journal_entries` / `commerce_journal_lines` — double-entry, with
  a deferred trigger rejecting unbalanced entries. Already carries
  `branch_id`, `cost_center_id`, `financial_year`, `deleted_at`.
- `commerce_chart_of_accounts`, `commerce_bank_accounts`, `commerce_gst_ledgers`
- `invoices` / `invoice_items` / `invoice_payments` (the last already links a
  `journal_entry_id` and a `bank_account_id`)
- `commerce_sales_returns`, `commerce_stock_transfers`, `commerce_warehouses`,
  `master_cost_centers`
- `payroll_cycles`, `payslips`, `hr_salary_components` (already flagged
  `is_statutory` / `is_taxable`), `hr_salary_structures`

`commerce_gst_ledgers` already has every column e-invoicing and e-way bills
need: `irn_number`, `ack_number`, `ack_date`, `qr_code_payload`,
`eway_bill_number`, `vehicle_number`, `transporter_name`, `transporter_id`,
`distance_km`, plus `is_reverse_charge`, `is_lut_export`, `is_sez`,
`is_import`, `is_composition_dealer`.

**So e-invoicing is not a schema project. It is an integration project.**

---

## Phase 1 — Compliance (the only genuinely urgent tier)

Everything here is legally mandatory for some slice of the customer base.
It ships first because a customer who cannot file is a customer who leaves.

### 1.1 E-invoicing (IRN) — integration only

**Blocked on a commercial decision, not on engineering.** Pick a GSP/ASP
(ClearTax, Masters India, IRIS, Zoho) or register directly with NIC. This
needs a signed agreement and a company GSTIN, so start it before the code.

Structure:

```
src/lib/commerce/gst/irp/
  client.ts        auth token cache (tokens are ~6h), retry, error mapping
  schema.ts        invoice → IRP schema 1.1 payload
  register.ts      registerInvoice(): returns IrpAcknowledgement | error
  cancel.ts        24-hour cancellation window only
```

Non-obvious requirements, each of which bites in production:

- **Error 2150 (duplicate IRN) is a success**, not a failure. The invoice is
  already registered; fetch and store the existing IRN.
- Store `SignedQRCode` **verbatim**. It is signed by the government's key;
  re-encoding it invalidates it.
- The IRP is genuinely down sometimes. Registration must be a **queued job**
  with retry, never inline in the invoice-save path — a POS sale must not
  fail because a government server is slow.
- Cancellation is allowed for 24 hours and cannot be undone.

Wiring: `recordIrpResponse()` already exists and validates. Call it with a
real response and the column, the badge and the export all light up with no
further UI work.

Estimate: 2–3 weeks after GSP credentials exist. Sandbox first.

### 1.2 E-way bills

Same GSP, same auth, different endpoint, and every column already exists.
Trigger: goods movement above the state's threshold (₹50,000 in most
states, but it is per-state and changes — make it a config table, not a
constant).

Add `commerce_eway_bills` only if part-B updates (vehicle changes in
transit) are needed; otherwise the existing columns on
`commerce_gst_ledgers` are enough.

Estimate: 1 week once 1.1's client exists.

### 1.3 Credit and debit notes

`commerce_sales_returns` exists but is a retail return, not a GST credit
note — it has no note number series, no original-invoice link in GST terms,
and does not reverse the GST ledger.

```sql
commerce_credit_notes (
  id, workspace_id, note_number, note_type,       -- credit | debit
  original_invoice_id, reason_code,               -- GST reason codes 01–06
  taxable_amount, cgst/sgst/igst amounts,
  journal_entry_id, gst_ledger_id, issued_on
)
```

Must post through `postJournal()` — reversal is a journal entry, not a
`DELETE`. `reverseGstLedgerEntry()` already exists and is the model.

Estimate: 1.5 weeks.

### 1.4 Payroll statutory output

The computation already exists — `payslips` carries `pf_deduction`,
`tds_deduction`, `professional_tax`. What is missing is the paperwork.

- **PF ECR** — fixed-width text file, monthly
- **ESI return** — CSV, monthly
- **Form 16 Part B** — annual, per employee, PDF
- **Full and final settlement** — leave encashment, notice recovery, gratuity

Needs a `hr_statutory_filings` table (period, type, generated file, status)
so a regenerated file does not silently replace a filed one.

Estimate: 3–4 weeks. Form 16 alone is a week because the format is fussy
and wrong output is worse than none.

---

## Phase 2 — Finance completeness

Not legally required, but each one is a reason a finance lead says no.

### 2.1 Bank reconciliation

```sql
commerce_bank_statements       (bank_account_id, period, imported_by, source)
commerce_bank_statement_lines  (date, description, debit, credit, balance,
                                match_status, matched_journal_line_id)
```

The import is easy; the **matching** is the product. Ship in order:

1. Exact match on amount + date ± 3 days → auto-reconcile
2. Fuzzy match on UTR/cheque number — `commerce_journal_entries` already
   stores `utr_number`, `cheque_number`, `payment_app`, `card_last_digits`
3. Manual match UI for the remainder
4. "Create a journal entry from this line" for bank charges and interest

Formats: start with CSV and the big banks' exports. Do **not** start with
PDF statements.

Estimate: 3 weeks. The matching heuristics will need tuning against real
statements — budget for a second pass.

### 2.2 Recurring invoices

```sql
commerce_recurring_invoices (
  template_invoice_id, frequency, next_run_on, end_on,
  auto_send, last_generated_invoice_id, status
)
```

Needs a scheduled job. The trap is idempotency: a retried run must not
issue two invoices for one period. Unique constraint on
`(recurring_id, period_key)`, not a timestamp check.

Estimate: 1.5 weeks.

### 2.3 Fixed assets and depreciation

```sql
commerce_fixed_assets        (name, category, purchase_date, cost,
                              salvage_value, useful_life_months, method,
                              ledger_id, disposal_date)
commerce_depreciation_runs   (asset_id, period, amount, journal_entry_id)
```

Two schedules are needed and they differ: Companies Act (books) and Income
Tax Act (block-of-assets, WDV). Model the method per schedule from day one —
retrofitting the second one means re-running history.

Every run posts through `postJournal()`.

Estimate: 2.5 weeks.

### 2.4 TDS on purchases

Sections 194C, 194J, 194H, 194I with per-section thresholds and rates.
Deduct at bill entry, accumulate to a liability ledger, produce Form 26Q
data. Rates change in the Budget, so they belong in a table with effective
dates — never in code.

Estimate: 2 weeks.

---

## Phase 3 — Platform

### 3.1 Two-factor authentication

Supabase Auth supports TOTP enrolment natively, so this is mostly UI plus a
workspace-level "require 2FA" policy enforced in `src/proxy.ts`. Recovery
codes are the part people forget; without them, support becomes an account
recovery desk.

Estimate: 1 week. **Highest value-per-day on this list** — workspaces hold
payroll and banking data.

### 3.2 Multi-branch

Half-built already: `commerce_journal_entries.branch_id` and
`cost_center_id` exist, `master_cost_centers` and `commerce_warehouses`
exist, `commerce_stock_transfers` exists. Missing: a `branches` table, a
branch selector in the shell, branch scoping in RLS, and per-branch P&L.

The RLS work is the real cost — every policy generated from
`src/lib/auth/resources.ts` needs a branch dimension.

Estimate: 3 weeks.

### 3.3 Multi-currency

Genuinely large, and deliberately last.

- `currencies`, `exchange_rates` (date, pair, source)
- Every money column needs a currency and a base-currency amount
- Realised and unrealised exchange differences post as journal entries
- Revaluation at period end

Do not start this until Phase 1 and 2 are done. Bolting currency onto a
ledger later is painful; bolting it on **twice** because the first attempt
missed revaluation is worse.

Estimate: 6–8 weeks.

---

## Phase 4 — Manufacturing

Not started, and honestly out of scope until there is a customer asking and
paying. Minimum credible version:

```
commerce_boms, commerce_bom_lines, commerce_work_orders,
commerce_work_order_consumption, commerce_routings
```

Plus WIP valuation, which is where naive implementations get the books
wrong.

Estimate: 8–12 weeks for something a real factory would keep using. Until
then Odoo is the better answer, and the roadmap entry says so.

---

## Sequencing

```
Now      → 099 pasted; 2FA (1w)
Parallel → GSP commercial process starts (weeks of paperwork, no code)
Q1       → E-invoicing (2–3w) → E-way bills (1w) → Credit/debit notes (1.5w)
Q2       → Bank reconciliation (3w) → Recurring invoices (1.5w)
           → Payroll statutory (3–4w)
Q3       → Fixed assets (2.5w) → TDS on purchases (2w) → Multi-branch (3w)
Q4       → Multi-currency (6–8w)
Later    → Manufacturing, when a paying customer asks
```

2FA is first because it is a week and it removes a security objection.
The GSP paperwork runs alongside everything because it is the long pole and
costs no engineering time.

## Rules for this list

1. **An item leaves `/compare`'s roadmap only when it ships.** Not when it
   is started, not when it is nearly done.
2. **Never fake an external authority.** The IRN incident is the reason this
   rule is written down. If an integration does not exist, the field stays
   empty and the UI says so.
3. **Rates and thresholds live in tables with effective dates**, never in
   code. GST rates, TDS sections, e-way bill thresholds and PF ceilings all
   change on budget day.
4. **Every money movement posts through `src/lib/accounting/posting.ts`.**
   No feature gets its own path to the ledger.
