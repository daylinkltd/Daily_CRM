// ============================================================
// DELETE /api/accounting/ledgers/[id]?workspace_id=…
//
// Remove one ledger from the chart of accounts — ABAC-gated.
//
// Authority is the permission matrix: `accounting:delete`
// (has_workspace_permission — owners/admins short-circuit TRUE,
// custom roles resolve their matrix key). The delete then runs on the
// USER's client so the RLS policies stay in the loop as a second
// fence; a policy that disagrees deletes zero rows, and we say so
// rather than reporting success.
//
// Books-integrity guards, checked before permission is even relevant:
//   • system accounts (is_system) are the posting engine's role
//     catalogue — deleting one bricks POS/invoice/payroll postings
//   • a ledger with journal lines is history; deleting it would
//     unbalance every voucher it appears in (void the vouchers first)
//   • a ledger with children is a group head — re-parent them first
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ABAC: the matrix key, not the enum role, decides.
    const { data: allowed, error: permError } = await supabase.rpc("has_workspace_permission", {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_permission: "accounting:delete",
    });
    if (permError) {
      console.error("[ledgers DELETE] permission check failed:", permError);
      return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
    }
    if (allowed !== true) {
      return NextResponse.json(
        { error: "Your role doesn't allow deleting ledgers (Accounting → Delete)." },
        { status: 403 },
      );
    }

    const { data: ledger } = await supabase
      .from("commerce_chart_of_accounts")
      .select("id, account_code, account_name, is_system")
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found in this workspace" }, { status: 404 });
    }
    if (ledger.is_system) {
      return NextResponse.json(
        {
          error: `${ledger.account_name} is a system account — sales, purchases and payroll post into it automatically. It cannot be deleted.`,
        },
        { status: 403 },
      );
    }

    const [{ count: lineCount }, { count: childCount }] = await Promise.all([
      supabase
        .from("commerce_journal_lines")
        .select("id", { count: "exact", head: true })
        .eq("account_id", id),
      supabase
        .from("commerce_chart_of_accounts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("parent_account_id", id),
    ]);
    if ((lineCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `${ledger.account_name} appears on ${lineCount} journal line${lineCount === 1 ? "" : "s"}. Ledgers with transactions can't be deleted — void those vouchers first, or keep the ledger for the record.`,
          code: "has_transactions",
          lines: lineCount,
        },
        { status: 409 },
      );
    }
    if ((childCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `${ledger.account_name} has ${childCount} sub-ledger${childCount === 1 ? "" : "s"} under it. Move or delete those first.`,
          code: "has_children",
        },
        { status: 409 },
      );
    }

    // User-context delete: RLS is the second fence. `count` tells us
    // whether a row actually went away — a silent zero is a policy
    // denial, not a success.
    const { error: deleteError, count } = await supabase
      .from("commerce_chart_of_accounts")
      .delete({ count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json(
        { error: "The database rejected the delete — your role may lack accounting delete rights." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: { id: ledger.id, account_code: ledger.account_code, account_name: ledger.account_name },
    });
  } catch (err) {
    console.error("[ledgers DELETE] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
