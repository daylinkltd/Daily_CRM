import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isKhataMode, postSalesReturn } from "@/lib/accounting/posting";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  try {
    const { data: returnsData, error } = await supabase
      .from("commerce_sales_returns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orderIds = (returnsData || []).map((r) => r.sales_order_id).filter(Boolean);
    let ordersMap: Record<string, any> = {};

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from("commerce_sales_orders")
        .select("id, order_number, grand_total, customer_mobile")
        .in("id", orderIds);

      (orders || []).forEach((o) => {
        ordersMap[o.id] = o;
      });
    }

    const formattedReturns = (returnsData || []).map((ret) => ({
      ...ret,
      sales_order: ordersMap[ret.sales_order_id] || null,
    }));

    return NextResponse.json({ returns: formattedReturns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load returns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    workspace_id,
    sales_order_id,
    customer_id,
    return_reason = "CUSTOMER_MIND_CHANGE",
    refund_mode = "CASH",
    total_refund_amount,
    product_id,
    quantity_returned = 1,
    restock_inventory = true,
  } = body;

  if (!workspace_id || !total_refund_amount) {
    return NextResponse.json({ error: "Workspace ID and Refund Amount are required" }, { status: 400 });
  }

  const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

  const { data: returnTicket, error: retErr } = await supabase
    .from("commerce_sales_returns")
    .insert({
      workspace_id,
      return_number: returnNumber,
      sales_order_id: sales_order_id || null,
      customer_id: customer_id || null,
      return_reason,
      refund_mode,
      total_refund_amount: Number(total_refund_amount),
    })
    .select()
    .single();

  if (retErr || !returnTicket) {
    return NextResponse.json({ error: retErr?.message || "Failed to log return ticket" }, { status: 500 });
  }

  // If restock requested and product_id provided, add INWARD return movement
  if (restock_inventory && product_id) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    await supabase.from("commerce_inventory_movements").insert({
      workspace_id,
      product_id,
      movement_type: "RETURN",
      quantity: Math.abs(Number(quantity_returned || 1)),
      reference_id: returnTicket.id,
      notes: `Restocked returned item from Return Ticket #${returnTicket.return_number}`,
      created_by: member?.id || null,
    });
  }

  // Refunds previously left the books untouched — cash left the
  // drawer and the GL never learned. Post the reversal: DR Sales
  // Returns (contra revenue), CR the refund leg.
  let accounting_posted = false;
  let accounting_error: string | null = null;
  try {
    await postSalesReturn(supabase, {
      workspace_id,
      return_id: returnTicket.id,
      return_number: returnTicket.return_number,
      amount: Number(total_refund_amount),
      refund_mode,
      contact_id: customer_id || null,
    });
    accounting_posted = true;

    // Khata-credit and store-credit refunds reduce what the customer
    // owes (a balance below zero is store credit the customer holds).
    const creditsKhata = isKhataMode(refund_mode) || refund_mode === "STORE_CREDIT_VOUCHER";
    if (creditsKhata && customer_id) {
      const { data: khata } = await supabase
        .from("commerce_customer_khata")
        .select("id, outstanding_balance")
        .eq("workspace_id", workspace_id)
        .eq("contact_id", customer_id)
        .maybeSingle();
      if (khata) {
        await supabase
          .from("commerce_customer_khata")
          .update({ outstanding_balance: Number(khata.outstanding_balance || 0) - Number(total_refund_amount) })
          .eq("id", khata.id);
      } else {
        await supabase.from("commerce_customer_khata").insert({
          workspace_id,
          contact_id: customer_id,
          outstanding_balance: -Number(total_refund_amount),
        });
      }
    }
  } catch (err) {
    accounting_error = err instanceof Error ? err.message : "Accounting posting failed";
  }

  return NextResponse.json({
    success: true,
    return_ticket: returnTicket,
    accounting_posted,
    ...(accounting_error ? { accounting_error } : {}),
  });
}
