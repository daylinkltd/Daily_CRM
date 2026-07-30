import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultAccounts } from "@/lib/commerce/accounting-engine";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  try {
    // 1. Ensure chart of accounts exist
    const accountsList = await getOrCreateDefaultAccounts(supabase, workspaceId);

    // Create Account Lookup Map
    const accountMap: Record<string, any> = {};
    (accountsList || []).forEach((acc) => {
      accountMap[acc.id] = acc;
    });

    // 2. Fetch journal entries
    const { data: journalEntries, error: jError } = await supabase
      .from("commerce_journal_entries")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (jError) {
      return NextResponse.json({ error: jError.message }, { status: 500 });
    }

    const journalIds = (journalEntries || []).map((j) => j.id);

    // 3. Fetch journal lines for these entries
    let journalLines: any[] = [];
    if (journalIds.length > 0) {
      const { data: linesData, error: linesErr } = await supabase
        .from("commerce_journal_lines")
        .select("*")
        .in("journal_entry_id", journalIds);

      if (!linesErr && linesData) {
        journalLines = linesData;
      }
    }

    // Group lines by journal_entry_id
    const linesByEntry: Record<string, any[]> = {};
    const accountBalances: Record<string, { debit: number; credit: number }> = {};

    journalLines.forEach((line) => {
      if (!linesByEntry[line.journal_entry_id]) {
        linesByEntry[line.journal_entry_id] = [];
      }

      const accObj = accountMap[line.account_id] || null;
      linesByEntry[line.journal_entry_id].push({
        ...line,
        account: accObj
          ? {
              account_code: accObj.account_code,
              account_name: accObj.account_name,
              account_type: accObj.account_type,
              sub_category: accObj.sub_category,
            }
          : null,
      });

      if (!accountBalances[line.account_id]) {
        accountBalances[line.account_id] = { debit: 0, credit: 0 };
      }
      accountBalances[line.account_id].debit += Number(line.debit_amount || 0);
      accountBalances[line.account_id].credit += Number(line.credit_amount || 0);
    });

    // Attach items to journal entries
    const formattedVouchers = (journalEntries || []).map((entry) => ({
      ...entry,
      items: linesByEntry[entry.id] || [],
    }));

    // Calculate live GL account balances
    const updatedAccounts = (accountsList || []).map((acc) => {
      const totals = accountBalances[acc.id] || { debit: 0, credit: 0 };
      let calcBalance = 0;
      if (acc.account_type === "ASSET" || acc.account_type === "EXPENSE") {
        calcBalance = totals.debit - totals.credit;
      } else {
        calcBalance = totals.credit - totals.debit;
      }

      return {
        ...acc,
        total_debit: totals.debit,
        total_credit: totals.credit,
        current_balance: Math.max(0, calcBalance),
      };
    });

    // Calculate live summary stats
    let cashInHand = 0;
    let bankAccounts = 0;
    let customerKhata = 0;
    let totalRevenue = 0;

    updatedAccounts.forEach((acc) => {
      const sub = acc.sub_category || "";
      if (sub === "CASH") cashInHand += acc.current_balance;
      if (sub === "BANK") bankAccounts += acc.current_balance;
      if (sub === "CUSTOMER_KHATA") customerKhata += acc.current_balance;
      if (acc.account_type === "REVENUE" || sub === "SALES_REVENUE") totalRevenue += acc.current_balance;
    });

    return NextResponse.json({
      accounts: updatedAccounts,
      journal_vouchers: formattedVouchers,
      summary: {
        cash_in_hand: cashInHand,
        bank_accounts: bankAccounts,
        customer_khata: customerKhata,
        total_sales_revenue: totalRevenue,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load accounting data" }, { status: 500 });
  }
}
