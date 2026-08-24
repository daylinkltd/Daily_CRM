import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId).catch(() => null);
    if (!ctx || !ctx.accountId) {
      return NextResponse.json({ shift: null });
    }

    const admin = createAdminClient();

    // Get active open shift for current user
    const { data: openShift } = await admin
      .from("bar_shifts")
      .select("*")
      .eq("workspace_id", ctx.accountId)
      .eq("bartender_member_id", ctx.userId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false })
      .maybeSingle();

    return NextResponse.json({ shift: openShift || null });
  } catch (err: any) {
    return NextResponse.json({ shift: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId).catch(() => null);
    if (!ctx || !ctx.accountId) {
      return NextResponse.json({ error: "Unauthorized / Workspace context missing" }, { status: 401 });
    }

    const admin = createAdminClient();

    const body = await request.json().catch(() => null);
    const action = body?.action || "OPEN"; // OPEN or CLOSE

    if (action === "OPEN") {
      const startingFloat = Number(body?.starting_cash_float || 0);

      const { data: shift, error } = await admin
        .from("bar_shifts")
        .insert({
          workspace_id: ctx.accountId,
          bartender_member_id: ctx.userId,
          starting_cash_float: startingFloat,
          status: "OPEN",
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, shift });
    }

    if (action === "CLOSE") {
      const { shift_id, ending_cash_actual } = body;
      if (!shift_id) {
        return NextResponse.json({ error: "shift_id is required to close shift" }, { status: 400 });
      }

      // Fetch shift details
      const { data: shift } = await admin.from("bar_shifts").select("*").eq("id", shift_id).single();
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }

      const startingFloat = Number(shift.starting_cash_float || 0);
      const actualCash = Number(ending_cash_actual || 0);

      // Sum all cash payments settled during this shift
      const { data: cashPayments } = await admin
        .from("bar_payments")
        .select("amount")
        .eq("payment_method", "CASH")
        .gte("processed_at", shift.opened_at);

      const totalCashSales = (cashPayments || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
      const expectedCash = startingFloat + totalCashSales;
      const difference = actualCash - expectedCash;

      // Close shift row
      const { data: closedShift, error: closeError } = await admin
        .from("bar_shifts")
        .update({
          ending_cash_actual: actualCash,
          expected_cash: expectedCash,
          cash_difference: difference,
          status: "CLOSED",
          closed_at: new Date().toISOString(),
        })
        .eq("id", shift_id)
        .select()
        .single();

      if (closeError) {
        return NextResponse.json({ error: closeError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        shift: closedShift,
        z_report: {
          shift_id,
          starting_float: startingFloat,
          cash_sales: totalCashSales,
          expected_cash: expectedCash,
          actual_cash: actualCash,
          difference,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
