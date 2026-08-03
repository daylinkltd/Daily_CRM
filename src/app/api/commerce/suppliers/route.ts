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

  const { data, error } = await supabase
    .from("commerce_suppliers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("company_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suppliers: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, company_name, contact_person, phone, email, gstin, address, outstanding_balance } = body;

  if (!workspace_id || !company_name) {
    return NextResponse.json({ error: "Workspace ID and Company Name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("commerce_suppliers")
    .insert({
      workspace_id,
      company_name,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      gstin: gstin || null,
      address: address || null,
      outstanding_balance: Number(outstanding_balance || 0),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplier: data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, workspace_id, company_name, contact_person, phone, email, gstin, address, outstanding_balance } = body;

  if (!id || !workspace_id || !company_name) {
    return NextResponse.json({ error: "Supplier ID, Workspace ID, and Company Name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("commerce_suppliers")
    .update({
      company_name,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      gstin: gstin || null,
      address: address || null,
      outstanding_balance: outstanding_balance !== undefined ? Number(outstanding_balance || 0) : undefined,
    })
    .eq("id", id)
    .eq("workspace_id", workspace_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplier: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  let workspaceId = searchParams.get("workspace_id");
  let ids: string[] = [];

  // Support JSON body for bulk deletion
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await request.json();
      if (body.workspace_id) workspaceId = body.workspace_id;
      if (Array.isArray(body.ids)) ids = body.ids;
      if (body.id) id = body.id;
    } catch {}
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  if (ids.length > 0) {
    const { error } = await supabase
      .from("commerce_suppliers")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: ids.length });
  }

  if (!id) {
    return NextResponse.json({ error: "Supplier ID or array of IDs is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("commerce_suppliers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

