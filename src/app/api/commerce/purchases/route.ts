import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postPurchaseReceived } from "@/lib/accounting/posting";
import { recordGstLedgerEntry } from "@/lib/commerce/gst/gst-ledger-manager";

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
    const { data: purchaseOrders, error } = await supabase
      .from("commerce_purchase_orders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const poIds = (purchaseOrders || []).map((p) => p.id);
    const supplierIds = (purchaseOrders || []).map((p) => p.supplier_id).filter(Boolean);

    // Fetch Suppliers Map
    const supplierMap: Record<string, any> = {};
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from("commerce_suppliers")
        .select("id, company_name, contact_person, phone, gstin")
        .in("id", supplierIds);

      (suppliers || []).forEach((s) => {
        supplierMap[s.id] = s;
      });
    }

    // Fetch PO Items Map
    const itemsMap: Record<string, any[]> = {};
    if (poIds.length > 0) {
      const { data: items } = await supabase
        .from("commerce_purchase_items")
        .select("*")
        .in("po_id", poIds);

      const productIds = Array.from(new Set((items || []).map((i) => i.product_id).filter(Boolean)));
      const productMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("commerce_products")
          .select("id, name, sku, barcode")
          .in("id", productIds);

        (products || []).forEach((p) => {
          productMap[p.id] = p;
        });
      }

      (items || []).forEach((item) => {
        if (!itemsMap[item.po_id]) itemsMap[item.po_id] = [];
        itemsMap[item.po_id].push({
          ...item,
          product: productMap[item.product_id] || null,
        });
      });
    }

    const formattedPOs = (purchaseOrders || []).map((po) => ({
      ...po,
      supplier: supplierMap[po.supplier_id] || null,
      items: itemsMap[po.id] || [],
    }));

    return NextResponse.json({ purchase_orders: formattedPOs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load purchase orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, supplier_id, status = "ORDERED", notes = "", items = [] } = body;

  if (!workspace_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Workspace ID and items are required" }, { status: 400 });
  }

  // Calculate total purchase amount
  const totalAmount = items.reduce(
    (acc: number, item: any) => acc + Number(item.quantity || 0) * Number(item.unit_cost || 0),
    0
  );

  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  const { data: po, error: poErr } = await supabase
    .from("commerce_purchase_orders")
    .insert({
      workspace_id,
      po_number: poNumber,
      supplier_id: supplier_id || null,
      status,
      total_amount: totalAmount,
      notes,
    })
    .select()
    .single();

  if (poErr || !po) {
    return NextResponse.json({ error: poErr?.message || "Failed to create Purchase Order" }, { status: 500 });
  }

  // Insert PO Line Items
  const poItems = items.map((item: any) => ({
    po_id: po.id,
    product_id: item.product_id,
    quantity: Number(item.quantity || 1),
    unit_cost: Number(item.unit_cost || 0),
    total_cost: Number(item.quantity || 1) * Number(item.unit_cost || 0),
  }));

  await supabase.from("commerce_purchase_items").insert(poItems);

  // If status is RECEIVED, automatically add Inward Stock Movements
  if (status === "RECEIVED") {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    const inwardMovements = items.map((item: any) => ({
      workspace_id,
      product_id: item.product_id,
      movement_type: "INWARD",
      quantity: Math.abs(Number(item.quantity || 1)),
      reference_id: po.id,
      notes: `Inward stock received via Purchase Order #${po.po_number}`,
      created_by: member?.id || null,
    }));

    await supabase.from("commerce_inventory_movements").insert(inwardMovements);

    // Receiving goods creates a liability: DR Purchases, CR Accounts
    // Payable. Purchases previously moved stock without ever touching
    // the books, so supplier money was invisible to accounting.
    let accounting_posted = false;
    let accounting_error: string | null = null;
    try {
      await postPurchaseReceived(supabase, {
        workspace_id,
        purchase_order_id: po.id,
        po_number: po.po_number,
        total_amount: totalAmount,
        created_by: member?.id || null,
      });
      accounting_posted = true;

      if (supplier_id) {
        const { data: supplier } = await supabase
          .from("commerce_suppliers")
          .select("id, outstanding_balance")
          .eq("id", supplier_id)
          .single();
        if (supplier) {
          await supabase
            .from("commerce_suppliers")
            .update({ outstanding_balance: Number(supplier.outstanding_balance || 0) + totalAmount })
            .eq("id", supplier.id);
        }
      }
    } catch (err) {
      // The PO and stock are already committed; surface the posting
      // failure to the caller instead of a silent console.error.
      accounting_error = err instanceof Error ? err.message : "Accounting posting failed";
    }

    // Receiving goods is also when input tax credit arises, so the
    // purchase enters the INPUT side of the GST ledger here.
    //
    // Nothing has ever written that side. `commerce_gst_ledgers` has an
    // INPUT ledger_type and, until now, no code path that produced one —
    // so ITC was permanently zero, GSTR-3B could not be computed, and
    // there was nothing for a GSTR-2B download to reconcile against.
    // Every rupee of credit a customer was entitled to was invisible.
    let gst_recorded = false;
    let gst_error: string | null = null;
    try {
      const { data: supplierTax } = supplier_id
        ? await supabase
            .from("commerce_suppliers")
            .select("company_name, gstin")
            .eq("id", supplier_id)
            .maybeSingle()
        : { data: null };

      // Purchase lines carry cost, not tax, so the rate comes from the
      // products bought. A single rate across the order is recorded when
      // the order is uniform, and left at zero when it is not — an
      // averaged rate would be a number that matches no invoice.
      const productIds: string[] = Array.from(
        new Set(
          (items as Array<{ product_id?: string }>)
            .map((i) => i.product_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      let gstRate = 0;
      let hsn: string | null = null;
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("commerce_products")
          .select("id, gst_rate, hsn_sac_code")
          .in("id", productIds);
        const taxable = (products ?? []) as Array<{
          gst_rate?: number | null;
          hsn_sac_code?: string | null;
        }>;
        const rates = new Set(taxable.map((p) => Number(p.gst_rate || 0)));
        if (rates.size === 1) gstRate = [...rates][0];
        const codes = new Set(
          taxable.map((p) => p.hsn_sac_code).filter((c): c is string => Boolean(c)),
        );
        if (codes.size === 1) hsn = [...codes][0];
      }

      // An inward supply runs the other way: FROM the supplier's state
      // TO ours. Both ends must be passed explicitly, because the
      // manager's defaults assume an outward sale — it would otherwise
      // read the counterparty GSTIN as the destination and book every
      // purchase as intra-state, splitting real IGST into CGST+SGST that
      // can never be reconciled against the supplier's own return.
      const { data: ws } = await supabase
        .from("workspaces")
        .select("state_code, gstin")
        .eq("id", workspace_id)
        .maybeSingle();
      const ourState =
        ws?.state_code || (ws?.gstin ? String(ws.gstin).slice(0, 2) : null);
      const supplierState = supplierTax?.gstin
        ? String(supplierTax.gstin).slice(0, 2)
        : null;

      // Supplier costs are entered exclusive of tax, so the order total
      // is the taxable value.
      const entry = await recordGstLedgerEntry(supabase, {
        workspace_id,
        ledger_type: "INPUT",
        invoice_id: po.id,
        invoice_number: po.po_number,
        party_name: supplierTax?.company_name ?? undefined,
        gstin: supplierTax?.gstin ?? undefined,
        source_state_code: supplierState ?? ourState ?? undefined,
        destination_state_code: ourState ?? undefined,
        place_of_supply: ourState ?? undefined,
        hsn_sac_code: hsn ?? undefined,
        base_amount: totalAmount,
        gst_rate: gstRate,
        is_tax_inclusive: false,
        is_b2b: Boolean(supplierTax?.gstin),
        source_document: "PURCHASE",
      });
      gst_recorded = Boolean(entry);
      if (!entry) gst_error = "The GST input-credit row could not be written.";
    } catch (err) {
      gst_error = err instanceof Error ? err.message : "GST ledger write failed";
    }

    return NextResponse.json({
      success: true,
      purchase_order: po,
      accounting_posted,
      gst_recorded,
      ...(accounting_error ? { accounting_error } : {}),
      ...(gst_error ? { gst_error } : {}),
    });
  }

  return NextResponse.json({ success: true, purchase_order: po, accounting_posted: false });
}
