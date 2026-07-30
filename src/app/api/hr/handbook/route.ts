// ============================================================
// Employee handbook generator.
//
// POST { workspace_id } — renders the 13 handbook sections from
// company_details into hr_policies + hr_policy_versions (v1 DRAFT),
// one policy per section. HR then reviews/edits/publishes through
// the existing Policies flow, and employees acknowledge through the
// existing signed-acknowledgement reader.
//
// Idempotent: a section whose policy already exists (matched by
// title) is skipped, so regenerating after filling more company
// details only creates what's missing. Existing edits are never
// overwritten.
//
// GET ?workspace_id=… — handbook status: company details, per-
// section policy + acknowledgement progress.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  HANDBOOK_SECTIONS,
  missingDetails,
  type CompanyDetails,
} from "@/lib/hr/handbook";

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

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const [{ data: details, error: detErr }, { data: policies }, { data: members }] = await Promise.all([
    supabase.from("company_details").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase
      .from("hr_policies")
      .select("id, title, status, versions:hr_policy_versions(id, version_number)")
      .eq("workspace_id", workspaceId)
      .like("title", "Handbook §%"),
    supabase.from("workspace_members").select("id").eq("workspace_id", workspaceId),
  ]);

  if (detErr && /relation .* does not exist|schema cache/i.test(detErr.message)) {
    return NextResponse.json({ error: "MIGRATION_078_PENDING" }, { status: 400 });
  }

  // Acknowledgement counts per policy (latest version).
  const policyIds = (policies ?? []).map((p) => p.id);
  const ackByPolicy = new Map<string, number>();
  if (policyIds.length > 0) {
    const { data: acks } = await supabase
      .from("hr_policy_acknowledgements")
      .select("policy_id, workspace_member_id, status")
      .eq("workspace_id", workspaceId)
      .in("policy_id", policyIds)
      .eq("status", "ACTIVE");
    for (const a of acks ?? []) {
      ackByPolicy.set(a.policy_id, (ackByPolicy.get(a.policy_id) ?? 0) + 1);
    }
  }

  const sections = HANDBOOK_SECTIONS.map((s) => {
    const policy = (policies ?? []).find((p) => p.title === s.title);
    return {
      order: s.order,
      key: s.key,
      title: s.title,
      mandatory: s.mandatory,
      policy_id: policy?.id ?? null,
      status: policy?.status ?? null,
      acknowledged: policy ? ackByPolicy.get(policy.id) ?? 0 : 0,
    };
  });

  return NextResponse.json({
    success: true,
    details: details ?? null,
    missing: missingDetails(details as Partial<CompanyDetails> | null),
    member_count: (members ?? []).length,
    sections,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspace_id } = await request.json();
  if (!workspace_id) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .single();
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only workspace admins can generate the handbook" }, { status: 403 });
  }

  const { data: details, error: detErr } = await supabase
    .from("company_details")
    .select("*")
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  if (detErr) {
    return NextResponse.json({ error: detErr.message }, { status: 500 });
  }

  const missing = missingDetails(details as Partial<CompanyDetails> | null);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Fill company details first — missing: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("hr_policies")
    .select("title")
    .eq("workspace_id", workspace_id)
    .like("title", "Handbook §%");
  const existingTitles = new Set((existing ?? []).map((p) => p.title));

  // The handbook depends on the workspace's real policies, not just
  // company details: every PUBLISHED standalone policy whose category
  // matches a section is linked into that section, with a note that
  // the detailed policy prevails. Policies published later supersede
  // the handbook's summary text by design.
  const { data: standalone } = await supabase
    .from("hr_policies")
    .select("title, category, status")
    .eq("workspace_id", workspace_id)
    .eq("status", "PUBLISHED")
    .not("title", "like", "Handbook §%");
  const byCategory = new Map<string, string[]>();
  for (const p of standalone ?? []) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p.title);
    byCategory.set(p.category, list);
  }

  let created = 0;
  let skipped = 0;
  for (const section of HANDBOOK_SECTIONS) {
    if (existingTitles.has(section.title)) {
      skipped++;
      continue;
    }
    let content = section.build(details as CompanyDetails);
    const linked = byCategory.get(section.category) ?? [];
    if (linked.length > 0) {
      content += `\n\n---\n\n## Linked Company Policies\n\nThe following standalone policies apply to this section. Where they are more specific than the text above, **the standalone policy prevails**:\n\n${linked.map((t) => `- ${t}`).join("\n")}\n`;
    }

    const { data: policy, error: pErr } = await supabase
      .from("hr_policies")
      .insert({
        workspace_id,
        title: section.title,
        category: section.category,
        owner_workspace_member_id: member.id,
        linked_module: "NONE",
        status: "DRAFT",
      })
      .select("id")
      .single();
    if (pErr || !policy) {
      return NextResponse.json(
        { error: `Failed at "${section.title}": ${pErr?.message}`, created, skipped },
        { status: 500 },
      );
    }

    const { error: vErr } = await supabase.from("hr_policy_versions").insert({
      workspace_id,
      policy_id: policy.id,
      version_number: 1,
      content,
      change_summary: "Generated from company details",
      mandatory: section.mandatory,
      created_by: member.id,
    });
    if (vErr) {
      await supabase.from("hr_policies").delete().eq("id", policy.id);
      return NextResponse.json(
        { error: `Failed at "${section.title}": ${vErr.message}`, created, skipped },
        { status: 500 },
      );
    }
    created++;
  }

  return NextResponse.json({ success: true, created, skipped });
}
