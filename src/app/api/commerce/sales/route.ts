import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  const query = searchParams.get("query") || "";

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  try {
    let dbQuery = supabase
      .from("commerce_sales_orders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (query) {
      dbQuery = dbQuery.or(`order_number.ilike.%${query}%,customer_mobile.ilike.%${query}%`);
    }

    const { data: salesOrders, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orderIds = (salesOrders || []).map((o) => o.id);
    const customerIds = (salesOrders || []).map((o) => o.customer_id).filter(Boolean);

    // Fetch customer contacts if any
    const contactsMap: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, phone, email, company")
        .in("id", customerIds);

      (contacts || []).forEach((c) => {
        contactsMap[c.id] = c;
      });
    }

    // Fetch items for sales orders
    const itemsByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("commerce_sales_items")
        .select("*")
        .in("sales_order_id", orderIds);

      const productIds = Array.from(new Set((itemsData || []).map((i) => i.product_id).filter(Boolean)));
      const productsMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from("commerce_products")
          .select("id, name, sku, barcode")
          .in("id", productIds);

        (productsData || []).forEach((p) => {
          productsMap[p.id] = p;
        });
      }

      (itemsData || []).forEach((item) => {
        if (!itemsByOrder[item.sales_order_id]) {
          itemsByOrder[item.sales_order_id] = [];
        }
        itemsByOrder[item.sales_order_id].push({
          ...item,
          product: productsMap[item.product_id] || null,
        });
      });
    }

    const formattedOrders = (salesOrders || []).map((order) => ({
      ...order,
      customer: contactsMap[order.customer_id] || null,
      items: itemsByOrder[order.id] || [],
    }));

    return NextResponse.json({ sales_orders: formattedOrders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load sales orders" }, { status: 500 });
  }
}
