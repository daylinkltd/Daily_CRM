// ============================================================
// HR / Accounting sync — outbound side (this CRM -> NDH).
//
// Generalizes banking.ts's payroll-only push into every other event
// NDH's new HR module needs to mirror: employee changes, attendance,
// leave, and expense-claim decisions. Reuses the SAME paired connection
// (getBankingConfig) — a workspace that has connected a banking system
// gets this sync for free, no second pairing step.
//
// Two write paths land rows in hr_sync_pushes:
//
//   1. DB triggers (migration 112) enqueue employee/attendance/leave/
//      expense-CREATED events straight from the client-direct writes
//      those tables take (no server route to hook a synchronous send
//      into). Those rows sit 'pending' until drainHrSyncOutbox runs.
//
//   2. Server-routed decisions (expense approve/reject/reimburse,
//      policy publish) call pushHrEventToNdh directly, which enqueues
//      AND sends in the same request — mirroring pushPayrollToBanking
//      exactly, so the two pushers read the same at a glance.
//
// Signing: the bearer token already shared with NDH (issued from NDH's
// own Integrations screen, decrypted via getBankingConfig) doubles as
// the HMAC key. That token is already a secret known only to this
// pairing; asking the operator to provision and store a SECOND secret
// for the same connection buys no real separation of concerns here,
// and this operator already needed heavy hand-holding for plain env
// vars. Unlike the WhatsApp webhook verifier this mirrors structurally,
// there is no "unconfigured secret" case to soft-fail on — no config
// means no token, which already short-circuits to `skipped` below.
// ============================================================

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBankingConfig, type BankingConfig } from "@/lib/integrations/banking";

export type HrSyncEventType =
  | "employee.created"
  | "employee.updated"
  | "attendance.punched"
  | "leave.requested"
  | "leave.approved"
  | "leave.rejected"
  | "expense.created"
  | "expense.approved"
  | "expense.rejected"
  | "expense.reimbursed"
  | "policy.published";

export type HrSyncOutcome =
  | { status: "sent"; httpStatus: number }
  | { status: "duplicate"; httpStatus: number }
  | { status: "failed"; httpStatus?: number; error: string }
  | { status: "skipped"; reason: string };

interface HrSyncEvent {
  workspaceId: string;
  eventType: HrSyncEventType;
  entityTable: string;
  entityId: string;
  payload: Record<string, unknown>;
}

function signBody(token: string, rawBody: string): string {
  return "sha256=" + crypto.createHmac("sha256", token).update(rawBody).digest("hex");
}

/**
 * Enqueue (or refresh) the outbox row for one event, then send it
 * immediately. For server-routed decision points only — the
 * client-direct tables get their row from the DB trigger instead and
 * rely on drainHrSyncOutbox to actually send it.
 */
export async function pushHrEventToNdh(
  supabase: SupabaseClient,
  event: HrSyncEvent
): Promise<HrSyncOutcome> {
  const config = await getBankingConfig(supabase, event.workspaceId);
  if (!config) return { status: "skipped", reason: "No banking system connected" };
  if (!config.enabled) return { status: "skipped", reason: "Banking integration is paused" };

  await supabase.from("hr_sync_pushes").upsert(
    {
      workspace_id: event.workspaceId,
      event_type: event.eventType,
      entity_table: event.entityTable,
      entity_id: event.entityId,
      status: "pending",
      payload: event.payload,
    },
    { onConflict: "event_type,entity_id" }
  );

  const outcome = await sendOne(config, event);
  await recordOutcome(supabase, event.eventType, event.entityId, outcome);
  return outcome;
}

/**
 * Send every pending/failed row for a workspace, oldest first. This is
 * what actually delivers the trigger-enqueued client-direct events —
 * call it from a scheduled sweep (see the accompanying cron route);
 * nothing sends those rows on its own otherwise.
 */
export async function drainHrSyncOutbox(
  supabase: SupabaseClient,
  workspaceId: string,
  limit = 25
): Promise<{ sent: number; duplicate: number; failed: number; skipped: number }> {
  const config = await getBankingConfig(supabase, workspaceId);
  const tally = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  if (!config) {
    tally.skipped = 1;
    return tally;
  }
  if (!config.enabled) {
    tally.skipped = 1;
    return tally;
  }

  const { data: rows } = await supabase
    .from("hr_sync_pushes")
    .select("event_type, entity_table, entity_id, payload")
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  for (const row of rows ?? []) {
    const outcome = await sendOne(config, {
      workspaceId,
      eventType: row.event_type as HrSyncEventType,
      entityTable: row.entity_table,
      entityId: row.entity_id,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    });
    await recordOutcome(supabase, row.event_type, row.entity_id, outcome);
    if (outcome.status === "sent") tally.sent += 1;
    else if (outcome.status === "duplicate") tally.duplicate += 1;
    else if (outcome.status === "failed") tally.failed += 1;
    else tally.skipped += 1;
  }

  return tally;
}

async function recordOutcome(
  supabase: SupabaseClient,
  eventType: string,
  entityId: string,
  outcome: HrSyncOutcome
): Promise<void> {
  if (outcome.status === "skipped") return;
  const { data } = await supabase
    .from("hr_sync_pushes")
    .select("attempts")
    .eq("event_type", eventType)
    .eq("entity_id", entityId)
    .maybeSingle();

  await supabase
    .from("hr_sync_pushes")
    .update({
      status: outcome.status,
      http_status: "httpStatus" in outcome ? outcome.httpStatus ?? null : null,
      last_error: outcome.status === "failed" ? outcome.error : null,
      attempts: Number(data?.attempts ?? 0) + 1,
    })
    .eq("event_type", eventType)
    .eq("entity_id", entityId);
}

async function sendOne(config: BankingConfig, event: HrSyncEvent): Promise<HrSyncOutcome> {
  const url = `${config.baseUrl}/api/integrations/dailybiz/events`;
  const body = {
    workspaceId: config.remoteWorkspaceId,
    eventType: event.eventType,
    entityTable: event.entityTable,
    entityId: event.entityId,
    payload: event.payload,
  };
  const rawBody = JSON.stringify(body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        "X-Signature-256": signBody(config.token, rawBody),
      },
      body: rawBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let payload: { status?: string; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON response; fall through to the status-based error below.
    }

    if (!response.ok) {
      return {
        status: "failed",
        httpStatus: response.status,
        error: payload?.error || `NDH returned ${response.status}`,
      };
    }
    if (payload?.status === "duplicate") {
      return { status: "duplicate", httpStatus: response.status };
    }
    return { status: "sent", httpStatus: response.status };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "AbortError"
          ? "NDH did not respond within 15s"
          : err.message
        : "Could not reach NDH";
    return { status: "failed", error };
  }
}
