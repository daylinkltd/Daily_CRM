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
    if (!body || !body.product_id || !body.damage_type || !body.volume_ml_damaged) {
      return NextResponse.json(
        { error: "Missing required damage fields (product_id, damage_type, volume_ml_damaged)" },
        { status: 400 }
      );
    }

    const {
      branch_id,
      product_id,
      damage_type, // TRANSIT_DAMAGE, COUNTER_BREAKAGE, EXPIRED_BEER, CORKAGE_SPOILAGE
      bottles_damaged = 1,
      volume_ml_damaged,
      ksbcl_permit_no,
      photo_url,
      reason,
    } = body;

    // 1. Log Damage Entry
    const { data: damageLog, error: damageError } = await admin
      .from("bar_damage_logs")
      .insert({
        workspace_id: ctx.accountId,
        branch_id: branch_id || null,
        product_id,
        damage_type,
        bottles_damaged,
        volume_ml_damaged,
        ksbcl_permit_no: ksbcl_permit_no || null,
        photo_url: photo_url || null,
        reason: reason || null,
        authorized_by: ctx.userId,
      })
      .select()
      .single();

    if (damageError) {
      console.error("[POST /api/bar/inventory/damage] insert error:", damageError);
      return NextResponse.json({ error: damageError.message }, { status: 500 });
    }

    // 2. Deduct stock atomically for recorded damage
    try {
      await admin.rpc("atomic_deplete_bar_stock", {
        p_workspace_id: ctx.accountId,
        p_branch_id: branch_id || null,
        p_product_id: product_id,
        p_volume_ml: Number(volume_ml_damaged),
      });
    } catch (rpcErr) {
      console.warn("[POST /api/bar/inventory/damage] atomic depletion error:", rpcErr);
    }

    return NextResponse.json({
      success: true,
      damage_log: damageLog,
    });
  } catch (err: any) {
    console.error("[POST /api/bar/inventory/damage] exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
