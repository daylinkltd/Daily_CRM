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

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    workspace_id,
    sku,
    barcode,
    name,
    alias_name,
    manufacturer_name,
    department_name,
    brand_name,
    category_name,
    sub_category_name,
    preferred_supplier,
    product_status,
    hsn_sac_code,
    base_unit,
    purchase_unit,
    unit_conversion_factor,
    purchase_price,
    selling_price,
    wholesale_rate,
    distributor_rate,
    online_rate,
    mrp,
    min_selling_price,
    tax_rate,
    cess_rate,
    is_tax_inclusive,
    initial_stock,
    reorder_level,
    reorder_quantity,
    min_stock_level,
    max_stock_level,
    shelf_number,
    bin_location,
    allow_negative_stock,
    track_batch,
    track_serial,
    track_expiry,
    attributes,
  } = body;

  if (!id || !workspace_id || !sku || !name) {
    return NextResponse.json(
      { error: "Product ID, Workspace ID, SKU, and Product Name are required" },
      { status: 400 }
    );
  }

  const autoBarcode =
    barcode && String(barcode).trim() !== ""
      ? String(barcode).trim()
      : `890${Date.now().toString().slice(-10)}`;

  const updateData: Record<string, any> = {
    name,
    sku,
    barcode: autoBarcode,
    unit: base_unit || "PCS",
    base_unit: base_unit || "PCS",
    purchase_unit: purchase_unit || "BOX",
    unit_conversion_factor: Number(unit_conversion_factor || 1),
    purchase_price: Number(purchase_price || 0),
    purchase_rate: Number(purchase_price || 0),
    selling_price: Number(selling_price || 0),
    selling_rate: Number(selling_price || 0),
    mrp: Number(mrp || selling_price || 0),
    wholesale_rate: Number(wholesale_rate || selling_price || 0),
    distributor_rate: Number(distributor_rate || selling_price || 0),
    online_rate: Number(online_rate || selling_price || 0),
    min_selling_price: Number(min_selling_price || 0),
    hsn_sac_code: hsn_sac_code || "6203",
    tax_rate: Number(tax_rate || 0),
    cess_rate: Number(cess_rate || 0),
    is_tax_inclusive: is_tax_inclusive ?? true,
    reorder_level: Number(reorder_level || 10),
    reorder_quantity: Number(reorder_quantity || 50),
    min_stock_level: Number(min_stock_level || 5),
    max_stock_level: Number(max_stock_level || 1000),
    allow_negative_stock: !!allow_negative_stock,
    track_batch: !!track_batch,
    track_serial: !!track_serial,
    track_expiry: !!track_expiry,
    attributes: attributes || {},
  };

  if (alias_name !== undefined) updateData.alias_name = alias_name;
  if (manufacturer_name !== undefined) updateData.manufacturer_name = manufacturer_name;
  if (department_name !== undefined) updateData.department_name = department_name;
  if (brand_name !== undefined) updateData.brand_name = brand_name;
  if (category_name !== undefined) updateData.category_name = category_name;
  if (sub_category_name !== undefined) updateData.sub_category_name = sub_category_name;
  if (preferred_supplier !== undefined) updateData.preferred_supplier = preferred_supplier;
  if (product_status !== undefined) updateData.product_status = product_status;
  if (shelf_number !== undefined) updateData.shelf_number = shelf_number;
  if (bin_location !== undefined) updateData.bin_location = bin_location;
  if (initial_stock !== undefined) updateData.initial_stock = Number(initial_stock || 0);

  const { data, error } = await supabase
    .from("commerce_products")
    .update(updateData)
    .eq("id", id)
    .eq("workspace_id", workspace_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}
