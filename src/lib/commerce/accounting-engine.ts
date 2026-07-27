import { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeErrorMessage } from "./barcode-utils";

export interface PaymentLinePayload {
  mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "KHATA_CREDIT";
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
 */
export async function getOrCreateDefaultAccounts(supabase: SupabaseClient, workspaceId: string) {
  const defaultAccounts = [
    { account_code: "1010", account_name: "Cash in Hand Ledger", account_type: "ASSET", sub_category: "CASH", is_system: true },
    { account_code: "1020", account_name: "SBI Current Bank Ledger", account_type: "ASSET", sub_category: "BANK", is_system: true },
    { account_code: "1021", account_name: "HDFC Bank Ledger", account_type: "ASSET", sub_category: "BANK", is_system: true },
    { account_code: "1030", account_name: "Cheque in Hand Ledger", account_type: "ASSET", sub_category: "CHEQUE_IN_HAND", is_system: true },
    { account_code: "1040", account_name: "Customer Khata (Accounts Receivable)", account_type: "ASSET", sub_category: "CUSTOMER_KHATA", is_system: true },
    { account_code: "4010", account_name: "Sales Revenue Account", account_type: "REVENUE", sub_category: "SALES_REVENUE", is_system: true },
  ];

  const { data: existing } = await supabase
    .from("commerce_chart_of_accounts")
    .select("*")
    .eq("workspace_id", workspaceId);

  const existingCodes = new Set((existing || []).map((a) => a.account_code));
  const missing = defaultAccounts.filter((a) => !existingCodes.has(a.account_code));

  if (missing.length > 0) {
    const toInsert = missing.map((a) => ({ ...a, workspace_id: workspaceId }));
    await supabase.from("commerce_chart_of_accounts").insert(toInsert);
  }

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

  // 3. Build Debit Lines per payment mode
  for (const p of payments) {
    const amt = Number(p.amount || 0);
    if (amt <= 0) continue;

    let targetAccountId = cashAccount.id;

    if (p.mode === "CASH") {
      targetAccountId = cashAccount.id;
    } else if (p.mode === "UPI" || p.mode === "CARD" || p.mode === "BANK_TRANSFER") {
      targetAccountId = p.bank_account_id || bankAccount.id;
    } else if (p.mode === "CHEQUE") {
      targetAccountId = chequeAccount.id;
    } else if (p.mode === "KHATA_CREDIT") {
      targetAccountId = khataAccount.id;
      customerKhataAddition += amt;
    }

    linesToInsert.push({
      journal_entry_id: journalEntry.id,
      account_id: targetAccountId,
      contact_id: p.mode === "KHATA_CREDIT" ? customer_id || null : null,
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

  await supabase.from("commerce_journal_lines").insert(linesToInsert);

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
