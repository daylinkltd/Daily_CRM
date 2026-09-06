// ============================================================
// DELETE /api/accounting/journal/[id]?workspace_id=…
//
// Void one voucher — a SOFT delete (`deleted_at`), never a row drop.
//
// Every report and statement in the module already derives balances
// from journal lines filtered by the entry's `deleted_at`
// (src/lib/accounting/reports.ts, the ledger statement, the
// transactions list), so stamping the timestamp removes the voucher
// from every number at once while the audit trail keeps the rows.
//
// ABAC: same matrix key as ledger deletion — `accounting:delete` via
// has_workspace_permission (owner/admin TRUE, custom roles their
// matrix). The update runs as the user so RLS stays in the loop.
//
// System-posted vouchers (POS sales, invoices, payroll) are refused:
// they mirror a source document, and voiding the journal side alone
// would make the books disagree with the document that created them.
// Void the source instead. Manual journals (single, bulk, imported)
// are fair game.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VOIDABLE_REFERENCE_TYPES = new Set(["MANUAL_JOURNAL", null as string | null]);

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

    const { data: allowed, error: permError } = await supabase.rpc("has_workspace_permission", {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_permission: "accounting:delete",
    });
    if (permError) {
      console.error("[journal DELETE] permission check failed:", permError);
      return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
    }
    if (allowed !== true) {
      return NextResponse.json(
        { error: "Your role doesn't allow voiding vouchers (Accounting → Delete)." },
        { status: 403 },
      );
    }

    const { data: entry } = await supabase
      .from("commerce_journal_entries")
      .select("id, voucher_number, reference_type, deleted_at")
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (!entry) {
      return NextResponse.json({ error: "Voucher not found in this workspace" }, { status: 404 });
    }
    if (entry.deleted_at) {
      return NextResponse.json(
        { error: `${entry.voucher_number} is already voided.` },
        { status: 409 },
      );
    }
    if (!VOIDABLE_REFERENCE_TYPES.has(entry.reference_type)) {
      return NextResponse.json(
        {
          error: `${entry.voucher_number} was posted automatically from a ${entry.reference_type
            .toLowerCase()
            .replaceAll("_", " ")}. Void or cancel that document instead — removing only its journal entry would put the books out of step with it.`,
          code: "system_posted",
        },
        { status: 403 },
      );
    }

    const { error: updateError, count } = await supabase
      .from("commerce_journal_entries")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("deleted_at", null);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json(
        { error: "The database rejected the void — your role may lack accounting rights." },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, voided: entry.voucher_number });
  } catch (err) {
    console.error("[journal DELETE] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
