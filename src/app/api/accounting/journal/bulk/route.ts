// ============================================================
// Bulk journal entry — Daylink's bulk-entry grid, ported.
//
// POST { workspace_id, vouchers: [{ voucher_date, narration,
//        debit_account_id, credit_account_id, amount }, …] }
//
// Each ROW is one two-legged voucher (the Daylink model: a date, a
// narration, one debit ledger, one credit ledger, one amount). Vouchers
// post INDEPENDENTLY through the same postJournal engine as the single
// entry screen — a typo in row 14 fails row 14 and only row 14, and the
// response says exactly which rows landed and which did not. An
// all-or-nothing batch would force re-keying 13 good vouchers to fix
// one bad one, which is precisely the drudgery bulk entry exists to
// remove.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postJournal } from "@/lib/accounting/posting";

const MAX_VOUCHERS = 200;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { workspace_id, vouchers } = body;
  if (!workspace_id || !Array.isArray(vouchers) || vouchers.length === 0) {
    return NextResponse.json(
      { error: "workspace_id and a non-empty vouchers array are required" },
      { status: 400 },
    );
  }
  if (vouchers.length > MAX_VOUCHERS) {
    return NextResponse.json(
      { error: `At most ${MAX_VOUCHERS} vouchers per batch — split larger imports.` },
      { status: 400 },
    );
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  // One ownership check for every account referenced anywhere in the
  // batch, up front — same tenant-isolation rule as the single route.
  const accountIds = [
    ...new Set(
      vouchers
        .flatMap((v: Record<string, unknown>) => [v.debit_account_id, v.credit_account_id])
        .filter(Boolean),
    ),
  ] as string[];
  const { data: owned } = await supabase
    .from("commerce_chart_of_accounts")
    .select("id")
    .eq("workspace_id", workspace_id)
    .in("id", accountIds);
  if ((owned ?? []).length !== accountIds.length) {
    return NextResponse.json(
      { error: "One or more accounts do not belong to this workspace" },
      { status: 400 },
    );
  }

  interface RowResult {
    row: number;
    ok: boolean;
    voucher_number?: string;
    error?: string;
  }
  const results: RowResult[] = [];

  for (let i = 0; i < vouchers.length; i++) {
    const v = vouchers[i];
    const amount = Number(v.amount);
    const narration = String(v.narration ?? "").trim();

    if (!v.debit_account_id || !v.credit_account_id || !narration || !(amount > 0)) {
      results.push({ row: i + 1, ok: false, error: "Missing ledger, narration or positive amount" });
      continue;
    }
    if (v.debit_account_id === v.credit_account_id) {
      results.push({ row: i + 1, ok: false, error: "Debit and credit ledger are the same" });
      continue;
    }

    try {
      const posting = await postJournal(supabase, {
        workspace_id,
        reference_type: "MANUAL_JOURNAL",
        reference_id: null,
        narration: narration.slice(0, 500),
        created_by: member.id,
        lines: [
          { account_id: v.debit_account_id, debit: amount, credit: 0 },
          { account_id: v.credit_account_id, debit: 0, credit: amount },
        ],
      });
      // Same pattern as the single-entry route: the engine stamps today,
      // then the requested voucher date is set explicitly.
      if (v.voucher_date && /^\d{4}-\d{2}-\d{2}$/.test(String(v.voucher_date))) {
        await supabase
          .from("commerce_journal_entries")
          .update({ voucher_date: v.voucher_date })
          .eq("id", posting.journal_entry_id);
      }
      results.push({ row: i + 1, ok: true, voucher_number: posting.voucher_number });
    } catch (err) {
      results.push({
        row: i + 1,
        ok: false,
        error: err instanceof Error ? err.message : "Posting failed",
      });
    }
  }

  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({
    posted,
    failed: results.length - posted,
    results,
  });
}
