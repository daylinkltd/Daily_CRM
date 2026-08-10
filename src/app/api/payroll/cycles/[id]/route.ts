// ============================================================
// Payroll cycle actions.
//
// POST { action: "process" }  — generate payslips for every ACTIVE
//   employee from their employee_profiles salary fields, deduct
//   approved salary advances (marking them 'deducted'), total the
//   cycle, flip it to 'processed', and post DR Salary Expense /
//   CR Salaries Payable.
// POST { action: "pay", payment_mode? } — flip a processed cycle to
//   'paid' (payslips too) and post DR Salaries Payable / CR Bank.
//
// Both actions are admin/owner-only and idempotent: reprocessing a
// processed cycle or re-paying a paid one is a no-op success, and
// the postings dedupe on their reference ids.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postPayrollPaid, postPayrollProcessed } from "@/lib/accounting/posting";
import { pushPayrollToBanking, totalsFromPayslips } from "@/lib/integrations/banking";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  if (!["process", "pay"].includes(action)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const { data: cycle, error: cycErr } = await supabase
    .from("payroll_cycles")
    .select("*")
    .eq("id", id)
    .single();
  if (cycErr || !cycle) {
    return NextResponse.json({ error: "Payroll cycle not found" }, { status: 404 });
  }

  // Money leaves the company here — admin/owner only.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", cycle.workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only workspace admins can run payroll" }, { status: 403 });
  }

  const periodLabel = `${MONTHS[cycle.month - 1]} ${cycle.year}`;

  // ── process ─────────────────────────────────────────────
  if (action === "process") {
    if (cycle.status === "paid") {
      return NextResponse.json({ error: "Cycle is already paid" }, { status: 400 });
    }
    if (cycle.status === "processed") {
      return NextResponse.json({ success: true, cycle, already_processed: true });
    }

    const { data: employees, error: empErr } = await supabase
      .from("employee_profiles")
      .select("workspace_member_id, employee_code, status, basic_salary, hra, special_allowance, pf_deduction, professional_tax, tds_deduction")
      .eq("workspace_id", cycle.workspace_id)
      .eq("status", "ACTIVE");
    if (empErr) {
      // Missing salary columns → migration 077 not applied yet.
      if (/column .* does not exist/i.test(empErr.message)) {
        return NextResponse.json(
          { error: "Salary fields are not set up yet — apply migration 077 first" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }
    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: "No active employees to pay" }, { status: 400 });
    }

    const withSalary = employees.filter(
      (e) => Number(e.basic_salary) + Number(e.hra) + Number(e.special_allowance) > 0
    );
    if (withSalary.length === 0) {
      return NextResponse.json(
        { error: "No employee has a salary configured. Set salaries first (Payroll → Salaries)." },
        { status: 400 },
      );
    }

    // Approved advances per member, deducted in this cycle.
    const { data: advances } = await supabase
      .from("salary_advances")
      .select("id, workspace_member_id, amount")
      .eq("workspace_id", cycle.workspace_id)
      .eq("status", "approved");
    const advanceByMember = new Map<string, { total: number; ids: string[] }>();
    for (const adv of advances ?? []) {
      const a = advanceByMember.get(adv.workspace_member_id) ?? { total: 0, ids: [] };
      a.total += Number(adv.amount);
      a.ids.push(adv.id);
      advanceByMember.set(adv.workspace_member_id, a);
    }

    const payslips = withSalary.map((e) => {
      const earnings = Number(e.basic_salary) + Number(e.hra) + Number(e.special_allowance);
      const advance = advanceByMember.get(e.workspace_member_id)?.total ?? 0;
      const baseDeductions = Number(e.pf_deduction) + Number(e.professional_tax) + Number(e.tds_deduction);
      // An advance never pushes net below zero; the surplus stays owed.
      const advanceDeduction = Math.min(advance, Math.max(0, earnings - baseDeductions));
      const deductions = baseDeductions + advanceDeduction;
      return {
        workspace_id: cycle.workspace_id,
        payroll_cycle_id: cycle.id,
        workspace_member_id: e.workspace_member_id,
        basic_salary: Number(e.basic_salary),
        hra: Number(e.hra),
        special_allowance: Number(e.special_allowance),
        total_earnings: earnings,
        pf_deduction: Number(e.pf_deduction),
        professional_tax: Number(e.professional_tax),
        tds_deduction: Number(e.tds_deduction),
        advance_deduction: advanceDeduction,
        total_deductions: deductions,
        net_payable: earnings - deductions,
        status: "published",
      };
    });

    // Delete-then-insert rather than upsert: schema drift has
    // silently dropped UNIQUE constraints in this database before
    // (message_reactions), and ON CONFLICT dies without one. A
    // half-failed earlier run leaves stale slips; this clears them.
    await supabase.from("payslips").delete().eq("payroll_cycle_id", cycle.id);
    const { error: slipErr } = await supabase.from("payslips").insert(payslips);
    if (slipErr) {
      return NextResponse.json({ error: `Failed to write payslips: ${slipErr.message}` }, { status: 500 });
    }

    const totalPayout = payslips.reduce((s, p) => s + p.net_payable, 0);

    try {
      await postPayrollProcessed(supabase, {
        workspace_id: cycle.workspace_id,
        payroll_cycle_id: cycle.id,
        period_label: periodLabel,
        total_net_payable: totalPayout,
        created_by: member.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accounting posting failed";
      return NextResponse.json({ error: `Payslips generated but posting failed: ${message}` }, { status: 500 });
    }

    // Mark consumed advances only after slips + posting succeeded.
    const usedAdvanceIds = payslips.flatMap(
      (p) => (p.advance_deduction > 0 ? advanceByMember.get(p.workspace_member_id)?.ids ?? [] : [])
    );
    if (usedAdvanceIds.length > 0) {
      await supabase.from("salary_advances").update({ status: "deducted" }).in("id", usedAdvanceIds);
    }

    const { data: updated } = await supabase
      .from("payroll_cycles")
      .update({ status: "processed", total_payout: totalPayout, processed_by: member.id })
      .eq("id", cycle.id)
      .select()
      .single();

    // Mirror the accrual into the customer's statutory books, if they have a
    // banking system connected. Deliberately after the cycle is committed and
    // deliberately not awaited into the failure path: payroll has run, and an
    // unreachable ledger must not undo it. The attempt is recorded and
    // retryable from Settings → Integrations.
    const bankingPush = await pushPayrollToBanking(supabase, {
      workspaceId: cycle.workspace_id,
      cycleId: cycle.id,
      periodLabel,
      stage: "processed",
      totals: totalsFromPayslips(payslips),
    });

    return NextResponse.json({
      success: true,
      cycle: updated,
      payslip_count: payslips.length,
      banking: bankingPush,
    });
  }

  // ── pay ─────────────────────────────────────────────────
  if (cycle.status === "draft") {
    return NextResponse.json({ error: "Process the cycle before paying it" }, { status: 400 });
  }
  if (cycle.status === "paid") {
    return NextResponse.json({ success: true, cycle, already_paid: true });
  }

  try {
    await postPayrollPaid(supabase, {
      workspace_id: cycle.workspace_id,
      payroll_cycle_id: cycle.id,
      period_label: periodLabel,
      amount: Number(cycle.total_payout),
      payment_mode: payment_mode || "BANK",
      created_by: member.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accounting posting failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await supabase.from("payslips").update({ status: "paid" }).eq("payroll_cycle_id", cycle.id);
  const { data: updated } = await supabase
    .from("payroll_cycles")
    .update({ status: "paid" })
    .eq("id", cycle.id)
    .select()
    .single();

  // Clear the liability in the customer's statutory books. Same reasoning as
  // the accrual: recorded and retryable, never able to fail the payout.
  const bankingPush = await pushPayrollToBanking(supabase, {
    workspaceId: cycle.workspace_id,
    cycleId: cycle.id,
    periodLabel,
    stage: "paid",
    amount: Number(cycle.total_payout),
  });

  return NextResponse.json({ success: true, cycle: updated, banking: bankingPush });
}
