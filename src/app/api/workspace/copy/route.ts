// ============================================================
// GET  /api/workspace/copy?workspace_id=<target>   — what is available
// POST /api/workspace/copy                          — copy it across
//
// Bring configuration from a workspace you already set up into one you
// are setting up now: templates, policies, the handbook text,
// departments, holidays, custom roles.
//
// Guard: the caller must be able to manage BOTH ends — the source
// (because its content is being read) and the target (because rows are
// being written). Per-workspace roles make that a real check rather
// than a formality: an admin of the target may be a viewer, or nothing
// at all, in the source.
//
// Copies are ADDITIVE and idempotent. Anything whose match key already
// exists in the target is left exactly as it is, so a second run tops
// up what is missing instead of overwriting local edits — the same
// rule the Mongo importers use, for the same reason.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVITY, logActivity } from "@/lib/saas-admin/activity";
import {
  COPYABLE_ENTITIES,
  findCopyable,
  matchSignature,
  type CopyableEntity,
} from "@/lib/workspace/copyable";
import { checkTeamPermission } from "@/lib/auth/team-permissions";

type Admin = ReturnType<typeof createAdminClient>;

/** Owner/admin of a workspace, or a role granted Team & Access there. */
async function canManage(
  admin: Admin,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return false;
  if (member.role === "owner" || member.role === "admin") return true;
  return (await checkTeamPermission(admin, workspaceId, userId, "update")).allowed;
}

async function requireUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, admin: createAdminClient() };
}

function rowsOf(entity: CopyableEntity, rows: Record<string, unknown>[]) {
  return rows.filter((r) => {
    if (entity.softDeleteColumn && r[entity.softDeleteColumn]) return false;
    if (entity.skipWhenTrue && r[entity.skipWhenTrue] === true) return false;
    return true;
  });
}

/**
 * GET — the workspaces this person could copy FROM, and how much each
 * entity would bring. Counting up front means the confirm screen can
 * say "12 templates, 4 policies" instead of asking for a leap of faith.
 */
export async function GET(request: NextRequest) {
  const targetId = new URL(request.url).searchParams.get("workspace_id");
  const sourceId = new URL(request.url).searchParams.get("source_id");
  if (!targetId) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, admin } = auth;

  if (!(await canManage(admin, targetId, user.id))) {
    return NextResponse.json(
      { error: "You need permission to manage this workspace before copying into it." },
      { status: 403 },
    );
  }

  // Candidate sources: every OTHER workspace this person can manage.
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  const candidateIds = (memberships ?? [])
    .map((m) => m.workspace_id as string)
    .filter((id) => id !== targetId);

  const manageable: string[] = [];
  for (const id of candidateIds) {
    if (await canManage(admin, id, user.id)) manageable.push(id);
  }

  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name")
    .in("id", manageable.length ? manageable : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at");

  // Without a chosen source there is nothing to count yet.
  if (!sourceId) {
    return NextResponse.json({ sources: workspaces ?? [], entities: [] });
  }
  if (!manageable.includes(sourceId)) {
    return NextResponse.json(
      { error: "You cannot copy from a workspace you do not manage." },
      { status: 403 },
    );
  }

  const entities = [];
  for (const entity of COPYABLE_ENTITIES) {
    const [{ data: srcRows }, { data: dstRows }] = await Promise.all([
      admin.from(entity.table).select("*").eq("workspace_id", sourceId),
      admin.from(entity.table).select("*").eq("workspace_id", targetId),
    ]);

    const available = rowsOf(entity, (srcRows as Record<string, unknown>[]) ?? []);
    const present = new Set(
      rowsOf(entity, (dstRows as Record<string, unknown>[]) ?? []).map((r) =>
        matchSignature(entity, r),
      ),
    );
    const newRows = available.filter((r) => !present.has(matchSignature(entity, r)));

    entities.push({
      key: entity.key,
      label: entity.label,
      description: entity.description,
      available: available.length,
      alreadyPresent: available.length - newRows.length,
      willCopy: newRows.length,
    });
  }

  return NextResponse.json({ sources: workspaces ?? [], entities });
}

/** POST { workspace_id (target), source_id, keys: string[] } */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { workspace_id: targetId, source_id: sourceId, keys } = body as {
    workspace_id?: string;
    source_id?: string;
    keys?: string[];
  };

  if (!targetId || !sourceId || !Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json(
      { error: "workspace_id, source_id and a non-empty keys array are required" },
      { status: 400 },
    );
  }
  if (targetId === sourceId) {
    return NextResponse.json(
      { error: "Pick a different workspace to copy from." },
      { status: 400 },
    );
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, admin } = auth;

  if (!(await canManage(admin, targetId, user.id)) || !(await canManage(admin, sourceId, user.id))) {
    return NextResponse.json(
      { error: "You need permission to manage both workspaces to copy between them." },
      { status: 403 },
    );
  }

  const results: { key: string; copied: number; skipped: number; error?: string }[] = [];

  for (const key of keys) {
    const entity = findCopyable(key);
    if (!entity) {
      results.push({ key, copied: 0, skipped: 0, error: "Unknown item" });
      continue;
    }

    try {
      const [{ data: srcRows }, { data: dstRows }] = await Promise.all([
        admin.from(entity.table).select("*").eq("workspace_id", sourceId),
        admin.from(entity.table).select("*").eq("workspace_id", targetId),
      ]);

      const source = rowsOf(entity, (srcRows as Record<string, unknown>[]) ?? []);
      const present = new Set(
        rowsOf(entity, (dstRows as Record<string, unknown>[]) ?? []).map((r) =>
          matchSignature(entity, r),
        ),
      );

      let copied = 0;
      let skipped = 0;

      for (const row of source) {
        if (present.has(matchSignature(entity, row))) { skipped++; continue; }

        const payload: Record<string, unknown> = { workspace_id: targetId };
        for (const col of entity.columns) {
          if (row[col] !== undefined) payload[col] = row[col];
        }

        const { data: inserted, error } = await admin
          .from(entity.table)
          .insert(payload)
          .select("id")
          .maybeSingle();
        if (error) throw error;

        // Children are what make the parent useful — a policy with no
        // version has no text to read.
        if (entity.children && inserted?.id) {
          for (const child of entity.children) {
            const { data: childRows } = await admin
              .from(child.table)
              .select("*")
              .eq(child.parentColumn, row.id as string);

            const childPayload = ((childRows as Record<string, unknown>[]) ?? []).map((c) => {
              const out: Record<string, unknown> = {
                workspace_id: targetId,
                [child.parentColumn]: inserted.id,
              };
              for (const col of child.columns) {
                if (c[col] !== undefined) out[col] = c[col];
              }
              return out;
            });
            if (childPayload.length) {
              await admin.from(child.table).insert(childPayload);
            }
          }
        }

        present.add(matchSignature(entity, row));
        copied++;
      }

      results.push({ key, copied, skipped });
    } catch (err) {
      // One failing entity must not abandon the rest: a workspace that
      // got its templates but not its holidays is still better off than
      // one that got nothing.
      results.push({
        key,
        copied: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : "Copy failed",
      });
    }
  }

  const totalCopied = results.reduce((n, r) => n + r.copied, 0);

  await logActivity({
    event: ACTIVITY.WORKSPACE_CONFIG_COPIED,
    workspaceId: targetId,
    userId: user.id,
    userEmail: user.email,
    details: { source_workspace_id: sourceId, results },
    request,
  });

  return NextResponse.json({ ok: true, totalCopied, results });
}
