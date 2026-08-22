// ============================================================
// Expense claim actions: approve / reject / reimburse.
//
// Submission is a plain insert from the page (RLS-scoped); the
// state machine runs here because approval is an admin/owner call
// and reimbursement moves money:
//
//   pending → approved | rejected     (admin decision)
//   approved → reimbursed             (posts DR General Expenses /
//                                      CR Cash-Bank via the engine)
//
// Reimbursement posting dedupes on the claim id, so a retry can't
// pay anyone twice.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postExpensePaid } from "@/lib/accounting/posting";
import { pushHrEventToNdh, type HrSyncEventType } from "@/lib/integrations/hrSync";

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  approve: { from: ["pending"], to: "approved" },
  reject: { from: ["pending"], to: "rejected" },
  reimburse: { from: ["approved"], to: "reimbursed" },
};

const SYNC_EVENT: Record<string, HrSyncEventType> = {
  approve: "expense.approved",
  reject: "expense.rejected",
  reimburse: "expense.reimbursed",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, payment_mode } = await request.json();
  const transition = TRANSITIONS[action];
  if (!transition) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const { data: claim, error: claimErr } = await supabase
    .from("expense_claims")
    .select("*")
    .eq("id", id)
    .single();
  if (claimErr || !claim) {
    return NextResponse.json({ error: "Expense claim not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", claim.workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only workspace admins can act on expense claims" }, { status: 403 });
  }
  if (member.id === claim.workspace_member_id && action !== "reject") {
    return NextResponse.json({ error: "You cannot approve or reimburse your own claim" }, { status: 403 });
  }

  if (!transition.from.includes(claim.status)) {
    return NextResponse.json(
      { error: `Cannot ${action} a ${claim.status} claim` },
      { status: 400 },
    );
  }

  if (action === "reimburse") {
    try {
      await postExpensePaid(supabase, {
        workspace_id: claim.workspace_id,
        expense_id: claim.id,
        amount: Number(claim.amount),
        category: claim.category,
        payment_mode: payment_mode || "BANK",
        created_by: member.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accounting posting failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { data: updated, error: upErr } = await supabase
    .from("expense_claims")
    .update({
      status: transition.to,
      approved_by: action === "reject" ? claim.approved_by : member.id,
    })
    .eq("id", id)
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Mirror the decision into NDH, if this workspace has it connected.
  // Deliberately after the decision is committed, same reasoning as
  // pushPayrollToBanking: the claim's state has already changed, and
  // an unreachable NDH must not undo or block that.
  const sync = await pushHrEventToNdh(supabase, {
    workspaceId: claim.workspace_id,
    eventType: SYNC_EVENT[action],
    entityTable: "expense_claims",
    entityId: claim.id,
    payload: updated,
  });

  return NextResponse.json({ success: true, claim: updated, sync });
}
