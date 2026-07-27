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

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  // Fetch products with calculated total stock movements
  const { data: products, error: prodError } = await supabase
    .from("commerce_products")
    .select(`
      *,
      category:commerce_categories(name)
    `)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (prodError) {
    return NextResponse.json({ error: prodError.message }, { status: 500 });
  }

  // Fetch all stock movements for this workspace
  const { data: movements, error: moveError } = await supabase
    .from("commerce_inventory_movements")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (moveError) {
    return NextResponse.json({ error: moveError.message }, { status: 500 });
  }

  // Calculate net stock per product
  const stockMap: Record<string, number> = {};
  (movements || []).forEach((m) => {
    stockMap[m.product_id] = (stockMap[m.product_id] || 0) + Number(m.quantity || 0);
  });

  const productsWithStock = (products || []).map((p) => ({
    ...p,
    current_stock: stockMap[p.id] || 0,
  }));

  return NextResponse.json({ inventory: productsWithStock, movements: movements || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, product_id, movement_type = "INWARD", quantity, notes } = body;

  if (!workspace_id || !product_id || !quantity) {
    return NextResponse.json({ error: "Workspace ID, Product ID, and Quantity are required" }, { status: 400 });
  }

  // Find member id
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();

  const qty = movement_type === "OUTWARD_SALE" ? -Math.abs(Number(quantity)) : Number(quantity);

  const { data, error } = await supabase
    .from("commerce_inventory_movements")
    .insert({
      workspace_id,
      product_id,
      movement_type,
      quantity: qty,
      notes: notes || "Manual stock adjustment",
      created_by: member?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, movement: data });
}
