// ============================================================
// Financial reports: trial balance, P&L, balance sheet.
//
// GET /api/accounting/reports?workspace_id=…&type=trial_balance|pnl|balance_sheet
//     [&start=YYYY-MM-DD&end=YYYY-MM-DD]
//
// Period defaults to the Indian financial year (April 1 → today).
// All computation lives in src/lib/accounting/reports.ts (pure,
// unit-tested); this route only fetches and shapes.
// Replaces the hardcoded-mock /commerce/reports figures.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  balanceSheet,
  computeActivity,
  defaultPeriod,
  profitAndLoss,
  trialBalance,
  type ReportAccount,
} from "@/lib/accounting/reports";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  const type = searchParams.get("type") ?? "trial_balance";
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }
  if (!["trial_balance", "pnl", "balance_sheet"].includes(type)) {
    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const fallback = defaultPeriod(new Date());
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const start = startParam && ISO_DATE.test(startParam) ? startParam : fallback.start;
  const end = endParam && ISO_DATE.test(endParam) ? endParam : fallback.end;

  const [{ data: accounts, error: accErr }, { data: entries, error: entErr }] = await Promise.all([
    supabase
      .from("commerce_chart_of_accounts")
      .select("id, account_code, account_name, account_type, ledger_group, opening_balance, is_system")
      .eq("workspace_id", workspaceId)
      .order("account_code"),
    supabase
      .from("commerce_journal_entries")
      .select("id, voucher_date, deleted_at")
      .eq("workspace_id", workspaceId),
  ]);
  if (accErr || entErr) {
    return NextResponse.json({ error: accErr?.message || entErr?.message }, { status: 500 });
  }

  const entryIds = (entries ?? []).filter((e) => !e.deleted_at).map((e) => e.id);
  let lines: { journal_entry_id: string; account_id: string; debit_amount: number | null; credit_amount: number | null }[] = [];
  if (entryIds.length > 0) {
    // Chunk the IN() filter — a workspace with years of vouchers
    // would otherwise blow the URL length limit.
    for (let i = 0; i < entryIds.length; i += 200) {
      const { data: chunk, error: lineErr } = await supabase
        .from("commerce_journal_lines")
        .select("journal_entry_id, account_id, debit_amount, credit_amount")
        .in("journal_entry_id", entryIds.slice(i, i + 200));
      if (lineErr) {
        return NextResponse.json({ error: lineErr.message }, { status: 500 });
      }
      lines = lines.concat(chunk ?? []);
    }
  }

  const accts = (accounts ?? []) as ReportAccount[];
  const activity = computeActivity(entries ?? [], lines, start, end);

  const report =
    type === "pnl" ? profitAndLoss(accts, activity)
    : type === "balance_sheet" ? balanceSheet(accts, activity)
    : trialBalance(accts, activity);

  return NextResponse.json({ success: true, type, start, end, report });
}
