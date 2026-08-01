import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HANDBOOK_SECTIONS } from "@/lib/hr/handbook";

/** Positions 1..13 belong to the generated sections. */
const HANDBOOK_SECTION_COUNT = HANDBOOK_SECTIONS.length;

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

    // Fetch the policies to attach. Filtering on workspace_id means a
    // caller cannot reach another tenant's policy by id.
    const { data: targetPolicies, error: fetchErr } = await supabase
      .from("hr_policies")
      .select("id, title, handbook_position")
      .eq("workspace_id", workspaceId)
      .in("id", policyIds);

    if (fetchErr) {
      // The column ships in migration 083; say so instead of falling
      // back to the destructive title-rename this route used to do.
      if (/handbook_position|column .* does not exist|schema cache/i.test(fetchErr.message)) {
        return NextResponse.json(
          { error: "Handbook ordering is not set up yet — apply migration 083, then try again." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "Failed to fetch selected policies" }, { status: 500 });
    }
    if (!targetPolicies || targetPolicies.length === 0) {
      // Previously returned success with count 0, so the UI reported
      // "Added 1 policy section" when nothing had happened.
      return NextResponse.json(
        { error: "None of those policies exist in this workspace" },
        { status: 404 },
      );
    }

    // Handbook membership is a position, NOT a title change. Renaming
    // the policy mutated it everywhere (lists, exports, audit history)
    // irreversibly, hid it from the "Linked Company Policies" pass and
    // leaked the raw prefix into the printed handbook.
    const { data: lastSection } = await supabase
      .from("hr_policies")
      .select("handbook_position")
      .eq("workspace_id", workspaceId)
      .not("handbook_position", "is", null)
      .order("handbook_position", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextPosition = Math.max(HANDBOOK_SECTION_COUNT, lastSection?.handbook_position ?? 0) + 1;

    let added = 0;
    for (const p of targetPolicies) {
      if (p.handbook_position != null) continue; // already in the handbook
      const { error: upErr } = await supabase
        .from("hr_policies")
        .update({ handbook_position: nextPosition })
        .eq("id", p.id)
        .eq("workspace_id", workspaceId);
      if (upErr) {
        // Errors used to be discarded, so an RLS denial still reported
        // success while nothing was written.
        return NextResponse.json(
          { error: `Failed to add "${p.title}": ${upErr.message}`, count: added },
          { status: 500 },
        );
      }
      nextPosition++;
      added++;
    }

    return NextResponse.json({ success: true, count: added });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add section" }, { status: 500 });
  }
}
