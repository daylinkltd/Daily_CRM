import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

const isUuid = (val: any): boolean =>
  typeof val === "string" &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

async function getOrCreateFallbackProductId(admin: any, workspaceId: string): Promise<string | null> {
  try {
    const { data: existing } = await admin
      .from("commerce_products")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created } = await admin
      .from("commerce_products")
      .insert({
        workspace_id: workspaceId,
        name: "Bar Item",
        sku: `BAR-ITEM-${Date.now()}`,
        selling_price: 100,
      })
      .select("id")
      .single();

    return created?.id || null;
  } catch (err) {
    console.error("Fallback product resolution error:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id") || undefined;
    const ctx = await getCurrentAccount(workspaceId);
    const admin = createAdminClient();

    const body = await request.json().catch(() => null);
    if (!body || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Order items list cannot be empty" }, { status: 400 });
    }

    const {
      branch_id,
      table_id,
      contact_id,
      items, // array of { product_id, portion_type, quantity, unit_price, volume_ml_per_unit, notes }
      subtotal,
      tax_amount = 0,
      discount_amount = 0,
      total_amount,
      payment_method, // CASH, CARD, UPI, ROOM_BILL, MANAGER_COMP
    } = body;

    const orderNumber = `BAR-${Date.now().toString().slice(-6)}`;

    // Sanitize UUID inputs to prevent Postgres 22P02 invalid input syntax error
    const validTableId = isUuid(table_id) ? table_id : null;
    const validBranchId = isUuid(branch_id) ? branch_id : null;
    const validContactId = isUuid(contact_id) ? contact_id : null;
    const fallbackProductId = await getOrCreateFallbackProductId(admin, ctx.accountId);

    // 1. Insert Master Bar Order
    const { data: order, error: orderError } = await admin
      .from("bar_orders")
      .insert({
        workspace_id: ctx.accountId,
        branch_id: validBranchId,
        table_id: validTableId,
        order_number: orderNumber,
        server_member_id: ctx.userId,
        contact_id: validContactId,
        subtotal: subtotal || total_amount,
        tax_amount,
        discount_amount,
        total_amount,
        order_status: body.order_status || "CLOSED",
        payment_status: payment_method ? "PAID" : "UNPAID",
      })
      .select()
      .single();

    if (orderError) {
      console.error("[POST /api/bar/orders] create order error:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 2. Insert Order Items & Trigger Atomic Stock Depletion
    const orderItemsPayload = items.map((item: any) => ({
      order_id: order.id,
      product_id: isUuid(item.product_id) ? item.product_id : fallbackProductId,
      portion_type: item.portion_type || "30ML",
      quantity: item.quantity || 1,
      volume_ml_per_unit: item.volume_ml_per_unit || 30,
      unit_price: item.unit_price || 0,
      total_price: (item.quantity || 1) * (item.unit_price || 0),
      notes: item.notes || null,
      kds_status: body.order_status === "SENT_TO_KITCHEN" ? "PENDING" : "SERVED",
    })).filter((i: any) => i.product_id !== null);

    if (orderItemsPayload.length > 0) {
      const { error: itemsError } = await admin.from("bar_order_items").insert(orderItemsPayload);
      if (itemsError) {
        console.error("[POST /api/bar/orders] insert items error:", itemsError);
      }
    }

    // 3. Process Stock Depletions (Atomic RPC with Recipe BOM Expansion)
    for (const item of items) {
      if (!isUuid(item.product_id)) continue;
      const totalItemVolumeMl = (item.quantity || 1) * (item.volume_ml_per_unit || 30);

      // Check if product has a cocktail recipe (Bill of Materials)
      const { data: recipeIngredients } = await admin
        .from("bar_cocktail_recipes")
        .select("ingredient_product_id, volume_ml")
        .eq("cocktail_product_id", item.product_id);

      if (recipeIngredients && recipeIngredients.length > 0) {
        // Expand Cocktail BOM ingredients
        for (const ing of recipeIngredients) {
          const ingredientVolumeMl = (item.quantity || 1) * Number(ing.volume_ml);
          try {
            await admin.rpc("atomic_deplete_bar_stock", {
              p_workspace_id: ctx.accountId,
              p_branch_id: validBranchId,
              p_product_id: ing.ingredient_product_id,
              p_volume_ml: ingredientVolumeMl,
            });
          } catch (rpcErr) {
            console.warn(`[POST /api/bar/orders] Atomic BOM depletion fallback for ${ing.ingredient_product_id}:`, rpcErr);
          }
        }
      } else {
        // Direct Spirit / Beverage Depletion
        try {
          await admin.rpc("atomic_deplete_bar_stock", {
            p_workspace_id: ctx.accountId,
            p_branch_id: validBranchId,
            p_product_id: item.product_id,
            p_volume_ml: totalItemVolumeMl,
          });
        } catch (rpcErr) {
          console.warn(`[POST /api/bar/orders] Atomic depletion fallback for ${item.product_id}:`, rpcErr);
        }
      }
    }

    // 4. Record Payment if provided
    if (payment_method) {
      await admin.from("bar_payments").insert({
        order_id: order.id,
        payment_method,
        amount: total_amount,
      });
    }

    // 5. Automatic Table Status Transition Lifecycle
    if (validTableId) {
      const isPaid = payment_method || body.payment_status === "PAID";
      const isKotSent = body.order_status === "SENT_TO_KITCHEN";
      const isBilling = body.order_status === "BILLING";

      const targetStatus = isPaid
        ? "VACANT"
        : isKotSent
        ? "OCCUPIED"
        : isBilling
        ? "BILLING"
        : "OCCUPIED";

      await admin.from("bar_tables").update({ status: targetStatus }).eq("id", validTableId);
    }

    return NextResponse.json({
      success: true,
      order_number: orderNumber,
      order,
    });
  } catch (err: any) {
    console.error("[POST /api/bar/orders] exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
