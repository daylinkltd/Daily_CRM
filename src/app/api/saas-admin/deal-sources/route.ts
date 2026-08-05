import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function isSuperAdmin(userId: string) {
  const supabase = createAdminClient();
  // `profiles.is_super_admin` does not exist — the flag is `system_role`,
  // and the row is keyed by `user_id` (an auth user id), not `id` (the
  // profile's own PK; the two are never equal). Both mistakes made this
  // select error, so `data` was null and every caller — including genuine
  // super admins — got a permanent 401.
  const { data } = await supabase
    .from("profiles")
    .select("system_role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.system_role === "super_admin";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isSuperAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.from("deal_sources").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isSuperAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("deal_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
