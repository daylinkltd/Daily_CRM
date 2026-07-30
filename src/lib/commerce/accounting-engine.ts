import { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeErrorMessage } from "./barcode-utils";
import {
  ensureAccounts,
  isKhataMode,
  resolveBankLedger,
  roleForPaymentMode,
} from "@/lib/accounting/posting";

export interface PaymentLinePayload {
  /** 'KHATA' (the sales-order enum spelling) and 'KHATA_CREDIT' are
   *  both accepted — the historical mismatch between them silently
   *  debited credit sales to Cash in Hand. */
  mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "KHATA_CREDIT" | "KHATA";
  bank_account_id?: string;
  amount: number;
  utr_number?: string;
  payment_app?: "PhonePe" | "Google Pay" | "Paytm" | "BHIM" | string;
  card_type?: "DEBIT" | "CREDIT";
  card_last_digits?: string;
  cheque_number?: string;
  cheque_bank?: string;
  credit_days?: number;
}

export interface POSAccountingPayload {
  workspace_id: string;
  sales_order_id: string;
  order_number: string;
  customer_id?: string | null;
  total_sales_amount: number;
  payments: PaymentLinePayload[];
  cashier_member_id?: string | null;
}

/**
 * On-the-fly Chart of Accounts Auto-Seeder (Rule #6)
 * Ensures standard default GL accounts exist for the workspace.
 * Seeding is delegated to the central posting engine's catalog so
 * the POS path and every other module share one chart of accounts.
 */
export async function getOrCreateDefaultAccounts(supabase: SupabaseClient, workspaceId: string) {
  await ensureAccounts(supabase, workspaceId);

  const { data: allAccounts } = await supabase
    .from("commerce_chart_of_accounts")
    .select("*")
    .eq("workspace_id", workspaceId);

  return allAccounts || [];
}

/**
 * Automatic Double-Entry Journal Generator for POS Sales
 */
export async function postPOSSalesJournal(supabase: SupabaseClient, payload: POSAccountingPayload) {
  const { workspace_id, sales_order_id, order_number, customer_id, total_sales_amount, payments, cashier_member_id } = payload;

  // 1. Get GL Accounts Map
  const accounts = await getOrCreateDefaultAccounts(supabase, workspace_id);
  const accountMapBySub: Record<string, any> = {};
  accounts.forEach((acc) => {
    if (acc.sub_category) accountMapBySub[acc.sub_category] = acc;
  });

  const cashAccount = accountMapBySub["CASH"] || accounts[0];
  const bankAccount = accountMapBySub["BANK"] || accounts[0];
  const chequeAccount = accountMapBySub["CHEQUE_IN_HAND"] || accounts[0];
  const khataAccount = accountMapBySub["CUSTOMER_KHATA"] || accounts[0];
  const salesAccount = accountMapBySub["SALES_REVENUE"] || accounts[0];

  const voucherNumber = `JV-${Date.now().toString().slice(-6)}`;

  // Check UTR duplicate validation
  for (const p of payments) {
    if (p.utr_number && p.utr_number.trim() !== "") {
      const { data: dup } = await supabase
        .from("commerce_journal_entries")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("utr_number", p.utr_number.trim())
        .maybeSingle();

      if (dup) {
        throw new Error(`Duplicate UTR/Transaction number: ${p.utr_number}`);
      }
    }
  }

  // 2. Create Journal Header
  const { data: journalEntry, error: jError } = await supabase
    .from("commerce_journal_entries")
    .insert({
      workspace_id,
      voucher_number: voucherNumber,
      reference_type: "POS_SALE",
      reference_id: sales_order_id,
      utr_number: payments.map((p) => p.utr_number).filter(Boolean).join(", ") || null,
      payment_app: payments.map((p) => p.payment_app).filter(Boolean).join(", ") || null,
      card_last_digits: payments.map((p) => p.card_last_digits).filter(Boolean).join(", ") || null,
      cheque_number: payments.map((p) => p.cheque_number).filter(Boolean).join(", ") || null,
      narration: `Automated accounting entry for POS Order #${order_number}`,
      created_by: cashier_member_id,
    })
    .select()
    .single();

  if (jError || !journalEntry) {
    throw new Error(sanitizeErrorMessage(jError, "Failed to create journal entry"));
  }

  const linesToInsert: any[] = [];
  let customerKhataAddition = 0;

  // 3. Build Debit Lines per payment mode.
  //    roleForPaymentMode treats 'KHATA' and 'KHATA_CREDIT' alike,
  //    and bank_account_id is resolved through the bank account's
  //    ledger_id — it is a commerce_bank_accounts id, not a
  //    chart-of-accounts id, and non-UUID junk (the POS UI used to
  //    send a free-text label) falls back to the default bank ledger.
  for (const p of payments) {
    const amt = Number(p.amount || 0);
    if (amt <= 0) continue;

    const role = roleForPaymentMode(p.mode);
    let targetAccountId =
      role === "CASH" ? cashAccount.id
      : role === "BANK" ? bankAccount.id
      : role === "CHEQUE_IN_HAND" ? chequeAccount.id
      : khataAccount.id;

    if (role === "BANK" && p.bank_account_id) {
      targetAccountId = await resolveBankLedger(supabase, workspace_id, p.bank_account_id, bankAccount);
    }
    if (isKhataMode(p.mode)) {
      customerKhataAddition += amt;
    }

    linesToInsert.push({
      journal_entry_id: journalEntry.id,
      account_id: targetAccountId,
      contact_id: isKhataMode(p.mode) ? customer_id || null : null,
      debit_amount: amt,
      credit_amount: 0,
    });
  }

  // 4. Build Credit Line for Sales Revenue Account
  linesToInsert.push({
    journal_entry_id: journalEntry.id,
    account_id: salesAccount.id,
    contact_id: customer_id || null,
    debit_amount: 0,
    credit_amount: total_sales_amount,
  });

  const { error: linesError } = await supabase
    .from("commerce_journal_lines")
    .insert(linesToInsert);
  if (linesError) {
    // The DB rejects unbalanced entries at commit (075). Never leave
    // the header behind as an orphan voucher.
    await supabase.from("commerce_journal_entries").delete().eq("id", journalEntry.id);
    throw new Error(sanitizeErrorMessage(linesError, "Failed to write journal lines"));
  }

  // 5. Update Customer Khata balance if credit purchase was made
  if (customerKhataAddition > 0 && customer_id) {
    const { data: existingKhata } = await supabase
      .from("commerce_customer_khata")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("contact_id", customer_id)
      .maybeSingle();

    if (existingKhata) {
      await supabase
        .from("commerce_customer_khata")
        .update({
          outstanding_balance: Number(existingKhata.outstanding_balance || 0) + customerKhataAddition,
        })
        .eq("id", existingKhata.id);
    } else {
      await supabase.from("commerce_customer_khata").insert({
        workspace_id,
        contact_id: customer_id,
        outstanding_balance: customerKhataAddition,
      });
    }
  }

  return { journalEntry, lines: linesToInsert };
}
