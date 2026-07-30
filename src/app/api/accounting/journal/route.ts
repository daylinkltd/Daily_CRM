// ============================================================
// Manual journal entry (the "New Entry" screen).
//
// POST { workspace_id, narration, voucher_date?, lines: [{ account_id,
//        debit?, credit? }, …] }
//
// Multi-line entries are allowed (compound vouchers). Balance is
// validated by the posting engine before anything is written, and
// again by the DB's deferred trigger at commit.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postJournal, type PostingLine } from "@/lib/accounting/posting";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, narration, voucher_date, lines } = body;
  if (!workspace_id || !narration || !Array.isArray(lines)) {
    return NextResponse.json(
      { error: "workspace_id, narration and lines are required" },
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

  // Only exact account ids are accepted from the client — roles are
  // for internal posting rules, not user input.
  const postingLines: PostingLine[] = lines.map((l: { account_id?: string; debit?: number; credit?: number }) => ({
    account_id: l.account_id,
    debit: Number(l.debit ?? 0),
    credit: Number(l.credit ?? 0),
  }));

  // Every account must belong to this workspace; a foreign id would
  // otherwise let a member post into another tenant's books.
  const accountIds = [...new Set(postingLines.map((l) => l.account_id).filter(Boolean))] as string[];
  if (accountIds.length > 0) {
    const { data: owned } = await supabase
      .from("commerce_chart_of_accounts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .in("id", accountIds);
    if ((owned ?? []).length !== accountIds.length) {
      return NextResponse.json({ error: "One or more accounts do not belong to this workspace" }, { status: 400 });
    }
  }

  try {
    const posting = await postJournal(supabase, {
      workspace_id,
      reference_type: "MANUAL_JOURNAL",
      reference_id: null,
      narration: String(narration).slice(0, 500),
      created_by: member.id,
      lines: postingLines,
    });

    if (voucher_date && /^\d{4}-\d{2}-\d{2}$/.test(voucher_date)) {
      await supabase
        .from("commerce_journal_entries")
        .update({ voucher_date })
        .eq("id", posting.journal_entry_id);
    }

    return NextResponse.json({ success: true, voucher: posting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post journal entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
