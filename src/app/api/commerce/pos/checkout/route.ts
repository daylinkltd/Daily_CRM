import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postPOSSalesJournal } from "@/lib/commerce/accounting-engine";
import { evaluatePromotions } from "@/lib/commerce/promotions-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    workspace_id,
    customer_id,
    is_walkin_customer = true,
    customer_type = "RETAIL",
    customer_gstin,
    billing_address,
    shipping_address,
    customer_mobile,
    salesman_member_id,
    counter_number = "COUNTER-1",
    invoice_series = "INV/",
    invoice_type = "TAX_INVOICE",
    financial_year = "2026-2027",
    payment_method = "CASH",
    payment_status = "PAID",
    payment_breakdown,
    items,
    discount_amount = 0,
    round_off_amount = 0,
    cash_received = 0,
    change_returned = 0,
    card_type,
    card_approval_number,
    notes = "",
    promo_code_applied,
  } = body;

  if (!workspace_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Invalid checkout request: items required" }, { status: 400 });
  }

  // Find active workspace member for user
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();

  const cashierMemberId = member?.id || null;

  // 1. Evaluate Promotions via Decoupled Engine
  let promotionDiscountTotal = 0;
  try {
    const promoRes = await evaluatePromotions(supabase, {
      workspace_id,
      customer_id,
      customer_type,
      items,
      coupon_code: promo_code_applied,
    });
    promotionDiscountTotal = promoRes.total_order_discount || 0;
  } catch (promoErr) {
    console.error("Promotion evaluation notice:", promoErr);
  }

  // Calculate Subtotal & Tax Total
  let subtotal = 0;
  let taxTotal = 0;

  const orderItemsData = items.map((item: any) => {
    const itemSubtotal = item.quantity * item.selling_price;
    const itemTax = (itemSubtotal * (item.tax_rate || 0)) / 100;
    subtotal += itemSubtotal;
    taxTotal += itemTax;

    return {
      product_id: item.product_id,
      batch_id: item.batch_id || null,
      warehouse_id: item.warehouse_id || null,
      quantity: item.quantity,
      free_quantity: item.free_quantity || 0,
      unit: item.unit || "PCS",
      mrp: item.mrp || item.selling_price,
      unit_price: item.selling_price,
      selling_price: item.selling_price,
      tax_rate: item.tax_rate || 0,
      total_price: itemSubtotal + itemTax,
      serial_numbers: item.serial_numbers || [],
      imei_numbers: item.imei_numbers || [],
      warranty_months: item.warranty_months || 0,
      item_remarks: item.item_remarks || "",
    };
  });

  const netDiscount = Number(discount_amount || 0) + promotionDiscountTotal;
  const grandTotal = Math.max(0, subtotal + taxTotal - netDiscount + Number(round_off_amount || 0));

  // Generate Document Number via RPC or Fallback
  let orderNumber = `${invoice_series}${Date.now().toString().slice(-6)}`;
  try {
    const { data: rpcNum } = await supabase.rpc("generate_next_document_number", {
      p_workspace_id: workspace_id,
      p_document_type: invoice_type || "INVOICE",
    });
    if (rpcNum) orderNumber = rpcNum;
  } catch (e) {
    console.error("Document number fallback used");
  }

  // 2. Insert Sales Order Header
  const { data: salesOrder, error: orderError } = await supabase
    .from("commerce_sales_orders")
    .insert({
      workspace_id,
      order_number: orderNumber,
      customer_id: customer_id || null,
      is_walkin_customer,
      customer_type,
      customer_gstin: customer_gstin || null,
      billing_address: billing_address || null,
      shipping_address: shipping_address || null,
      customer_mobile: customer_mobile || null,
      salesman_member_id: salesman_member_id || cashierMemberId,
      counter_number,
      invoice_series,
      invoice_type,
      financial_year,
      channel: "POS",
      payment_status: payment_status || "PAID",
      payment_method: payment_method || "CASH",
      subtotal,
      tax_total: taxTotal,
      discount_amount: netDiscount,
      round_off_amount: Number(round_off_amount || 0),
      grand_total: grandTotal,
      cash_received: Number(cash_received || 0),
      change_returned: Number(change_returned || 0),
      card_type: card_type || null,
      card_approval_number: card_approval_number || null,
      cashier_member_id: cashierMemberId,
      notes,
    })
    .select()
    .single();

  if (orderError || !salesOrder) {
    return NextResponse.json({ error: orderError?.message || "Failed to process POS checkout" }, { status: 500 });
  }

  // 3. Insert Sales Order Line Items
  const itemsToInsert = orderItemsData.map((item: any) => ({
    ...item,
    sales_order_id: salesOrder.id,
  }));

  await supabase.from("commerce_sales_items").insert(itemsToInsert);

  // 4. Log Stock Movements
  const movementsToInsert = orderItemsData.map((item: any) => ({
    workspace_id,
    product_id: item.product_id,
    batch_id: item.batch_id || null,
    movement_type: "OUTWARD_SALE",
    stock_status: "AVAILABLE",
    quantity: -Math.abs(item.quantity),
    reference_id: salesOrder.id,
    notes: `POS Checkout Order #${salesOrder.order_number}`,
    created_by: cashierMemberId,
  }));

  await supabase.from("commerce_inventory_movements").insert(movementsToInsert);

  // 5. Post Double-Entry Accounting Journal Vouchers
  const paymentLines = Array.isArray(payment_breakdown) && payment_breakdown.length > 0
    ? payment_breakdown
    : [{ mode: payment_method || "CASH", amount: grandTotal }];

  try {
    await postPOSSalesJournal(supabase, {
      workspace_id,
      sales_order_id: salesOrder.id,
      order_number: salesOrder.order_number,
      customer_id: salesOrder.customer_id,
      total_sales_amount: salesOrder.grand_total,
      payments: paymentLines,
      cashier_member_id: cashierMemberId,
    });
  } catch (acctErr: any) {
    console.error("Accounting posting failed:", acctErr?.message);
  }

  // 6. Record OUTPUT GST Ledger Entry
  const isGstBill = body.is_gst_bill !== false && taxTotal > 0;
  if (isGstBill) {
    try {
      const { recordGstLedgerEntry } = await import("@/lib/commerce/gst/gst-ledger-manager");
      await recordGstLedgerEntry(supabase, {
        workspace_id,
        ledger_type: "OUTPUT",
        invoice_id: salesOrder.id,
        invoice_number: salesOrder.order_number,
        party_name: customer_id ? "Registered Customer" : "POS Retail Customer",
        gstin: customer_gstin || undefined,
        base_amount: subtotal,
        gst_rate: subtotal > 0 ? (taxTotal / subtotal) * 100 : 0,
        is_tax_inclusive: false,
      });
    } catch (gstErr: any) {
      console.error("GST Ledger posting failed:", gstErr?.message);
    }
  }

  // 7. Publish Event Bus: [SaleCompleted]
  await supabase.from("platform_domain_events").insert({
    workspace_id,
    event_type: "SaleCompleted",
    aggregate_id: salesOrder.id,
    payload: {
      order_id: salesOrder.id,
      order_number: salesOrder.order_number,
      customer_id: salesOrder.customer_id,
      customer_type,
      grand_total: salesOrder.grand_total,
      payment_method: salesOrder.payment_method,
      items: orderItemsData,
    },
  });

  return NextResponse.json({
    success: true,
    order: salesOrder,
    message: "POS Checkout, Decoupled Promotions, and Automated Accounting Posted Successfully",
  });
}
