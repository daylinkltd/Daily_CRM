import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, policyIds } = await request.json();
    if (!workspaceId || !Array.isArray(policyIds) || policyIds.length === 0) {
      return NextResponse.json(
        { error: "Workspace ID and policyIds array are required" },
        { status: 400 }
      );
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json(
        { error: "Only workspace admins can modify the handbook" },
        { status: 403 }
      );
    }

    // Fetch the policies to attach
    const { data: targetPolicies, error: fetchErr } = await supabase
      .from("hr_policies")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .in("id", policyIds);

    if (fetchErr || !targetPolicies) {
      return NextResponse.json({ error: "Failed to fetch selected policies" }, { status: 500 });
    }

    // Prefix titles with "Handbook §" if not already prefixed so GET /api/hr/handbook includes them
    for (let i = 0; i < targetPolicies.length; i++) {
      const p = targetPolicies[i];
      if (!p.title.startsWith("Handbook §")) {
        const newTitle = `Handbook §Addendum — ${p.title}`;
        await supabase
          .from("hr_policies")
          .update({ title: newTitle })
          .eq("id", p.id);
      }
    }

    return NextResponse.json({ success: true, count: targetPolicies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add section" }, { status: 500 });
  }
}
