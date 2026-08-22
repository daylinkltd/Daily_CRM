import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/admin-client";
import { drainHrSyncOutbox } from "@/lib/integrations/hrSync";
import { BANKING_PROVIDER } from "@/lib/integrations/banking";

/**
 * Drain hr_sync_pushes for every workspace with an active banking
 * (NDH) connection.
 *
 * employee/attendance/leave/expense-created rows are written by the
 * DB triggers in migration 112 straight from the client-direct writes
 * those tables take — nothing sends them on its own. This sweep is
 * the only thing that does, the same role /api/flows/cron plays for
 * abandoned flow runs. Decision-point events (expense approve/reject/
 * reimburse, policy publish) are pushed synchronously by their own
 * route already and normally clear before this ever sees them; a row
 * only lingers here if that direct send itself failed, in which case
 * this sweep is also what retries it.
 *
 * Auth: reuses AUTOMATION_CRON_SECRET, same convention as
 * /api/flows/cron and /api/automations/cron — one secret for every
 * scheduled sweep in this app rather than one per feature.
 *
 * Hosting: hit on a schedule (Vercel Cron / GitHub Actions / external
 * pinger) — there is no in-app scheduler. Every 5 minutes is enough
 * for HR/attendance data; nothing here is as time-sensitive as money
 * movement.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }
  const supplied = request.headers.get("x-cron-secret") ?? "";
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expected);
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: connections, error } = await admin
    .from("workspace_integrations")
    .select("workspace_id")
    .eq("provider", BANKING_PROVIDER)
    .eq("status", "active");

  if (error) {
    console.error("[hr-sync-cron] failed to list connected workspaces:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!connections?.length) return NextResponse.json({ workspaces: 0 });

  const totals: Record<string, number> & { sent: number; duplicate: number; failed: number; skipped: number } = {
    sent: 0,
    duplicate: 0,
    failed: 0,
    skipped: 0,
  };
  for (const { workspace_id } of connections) {
    const result = await drainHrSyncOutbox(admin, workspace_id as string);
    totals.sent += result.sent;
    totals.duplicate += result.duplicate;
    totals.failed += result.failed;
    totals.skipped += result.skipped;
  }

  return NextResponse.json({ workspaces: connections.length, ...totals });
}
