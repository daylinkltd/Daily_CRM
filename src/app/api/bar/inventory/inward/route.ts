import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId);
    const admin = createAdminClient();

    const body = await request.json().catch(() => null);
    if (!body || !body.product_id || !body.cases_received || !body.case_purchase_price) {
      return NextResponse.json(
        { error: "Missing required inward stock fields (product_id, cases_received, case_purchase_price)" },
        { status: 400 }
      );
    }

    const {
      branch_id,
      product_id,
      ksbcl_permit_no,
      indent_no,
      eal_serial_start,
      eal_serial_end,
      batch_number,
      mfd_date,
      cases_received,
      bottles_per_case = 12,
      bottle_size_ml = 750,
      case_purchase_price,
      excise_duty_amount = 0,
    } = body;

    const bottles_received = cases_received * bottles_per_case;
    const total_volume_ml = bottles_received * bottle_size_ml;
    const total_cost = (cases_received * case_purchase_price) + Number(excise_duty_amount);
    const unit_cost_per_ml = total_cost / total_volume_ml;

    // 1. Insert KSBCL Inward Record
    const { data: inwardRecord, error: inwardError } = await admin
      .from("bar_inward_stock")
      .insert({
        workspace_id: ctx.accountId,
        branch_id: branch_id || null,
        product_id,
        ksbcl_permit_no: ksbcl_permit_no || "PERMIT-PENDING",
        indent_no: indent_no || null,
        eal_serial_start: eal_serial_start || null,
        eal_serial_end: eal_serial_end || null,
        batch_number: batch_number || null,
        mfd_date: mfd_date || null,
        cases_received,
        bottles_received,
        total_volume_ml,
        case_purchase_price,
        unit_cost_per_ml,
        excise_duty_amount,
        received_by: ctx.userId,
      })
      .select()
      .single();

    if (inwardError) {
      console.error("[POST /api/bar/inventory/inward] insert error:", inwardError);
      return NextResponse.json({ error: inwardError.message }, { status: 500 });
    }

    // 2. Fetch or initialize Bar Inventory row & Recalculate WAC (Weighted Average Cost)
    const { data: currentInventory } = await admin
      .from("bar_inventory")
      .select("*")
      .eq("workspace_id", ctx.accountId)
      .eq("product_id", product_id)
      .maybeSingle();

    let new_total_volume_ml = total_volume_ml;
    let new_wac_cost_per_ml = unit_cost_per_ml;
    let new_sealed_bottles = bottles_received;

    if (currentInventory) {
      const old_volume = Number(currentInventory.total_volume_ml || 0);
      const old_wac = Number(currentInventory.wac_cost_per_ml || 0);
      const old_sealed = Number(currentInventory.sealed_bottles || 0);

      new_total_volume_ml = old_volume + total_volume_ml;
      new_sealed_bottles = old_sealed + bottles_received;
      
      // Recalculate Weighted Average Costing (WAC) formula:
      // (Old Volume * Old WAC + New Volume * New Unit Cost) / New Total Volume
      if (new_total_volume_ml > 0) {
        new_wac_cost_per_ml = ((old_volume * old_wac) + (total_volume_ml * unit_cost_per_ml)) / new_total_volume_ml;
      }

      const { error: updateError } = await admin
        .from("bar_inventory")
        .update({
          sealed_bottles: new_sealed_bottles,
          total_volume_ml: new_total_volume_ml,
          wac_cost_per_ml: new_wac_cost_per_ml,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentInventory.id);

      if (updateError) {
        console.error("[POST /api/bar/inventory/inward] update inventory error:", updateError);
      }
    } else {
      const { error: insertInvError } = await admin
        .from("bar_inventory")
        .insert({
          workspace_id: ctx.accountId,
          branch_id: branch_id || null,
          product_id,
          sealed_bottles: new_sealed_bottles,
          open_bottles_ml: 0,
          total_volume_ml: new_total_volume_ml,
          wac_cost_per_ml: new_wac_cost_per_ml,
        });

      if (insertInvError) {
        console.error("[POST /api/bar/inventory/inward] insert inventory error:", insertInvError);
      }
    }

    return NextResponse.json({
      success: true,
      inward: inwardRecord,
      updated_stock_ml: new_total_volume_ml,
      new_wac_cost_per_ml: new_wac_cost_per_ml,
    });
  } catch (err: any) {
    console.error("[POST /api/bar/inventory/inward] exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
