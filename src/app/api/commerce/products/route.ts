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

  let dbQuery = supabase
    .from("commerce_products")
    .select(`
      *,
      category:commerce_categories(name)
    `)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, sku, barcode, name, category_id, brand, unit, tax_rate, purchase_price, selling_price, mrp, reorder_level, attributes } = body;

  if (!workspace_id || !sku || !name) {
    return NextResponse.json({ error: "Workspace ID, SKU, and Product Name are required" }, { status: 400 });
  }

  const autoBarcode = barcode && String(barcode).trim() !== "" ? String(barcode).trim() : `890${Date.now().toString().slice(-10)}`;

  const { data, error } = await supabase
    .from("commerce_products")
    .insert({
      workspace_id,
      sku,
      barcode: autoBarcode,
      name,
      category_id: category_id || null,
      brand: brand || null,
      unit: unit || "PCS",
      tax_rate: tax_rate || 0,
      purchase_price: purchase_price || 0,
      selling_price: selling_price || 0,
      mrp: mrp || selling_price || 0,
      reorder_level: reorder_level || 10,
      attributes: attributes || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If initial_stock provided, auto insert Stock Inward movement
  const initialStockNum = Number(body.initial_stock || 0);
  if (initialStockNum > 0) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    await supabase.from("commerce_inventory_movements").insert({
      workspace_id,
      product_id: data.id,
      movement_type: "INWARD",
      quantity: initialStockNum,
      notes: "Initial stock upon product creation",
      created_by: member?.id || null,
    });
  }

  return NextResponse.json({ product: data });
}
