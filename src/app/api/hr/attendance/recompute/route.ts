// ============================================================
// POST /api/hr/attendance/recompute
//
// Re-score recorded punch-ins against the CURRENT punch ladder from an
// effective date — the retroactive half of "the policy changed".
//
//   { workspaceId, effectiveFrom: 'YYYY-MM-DD' }
//
// What it touches, precisely:
//   • only rows WITH a punch_in_time — a day with no punch is not
//     rewritten into an Absent row; inventing records is a different
//     (and dangerous) feature;
//   • only statuses the ladder owns: Present / Late / Half-Day /
//     Absent. 'Remote' is a work-mode statement, not a lateness verdict,
//     and is left alone.
//
// Scoring is timezone-explicit (settings carry utc_offset_minutes,
// IST 330 by default) — the server's zone must never decide who was
// late. Rules come from the WORKSPACE_DEFAULT scope; department and
// designation overrides are display-level policy that can join later.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  minutesAfterShiftStart,
  statusFromPunchDelay,
  type PunchLadderRules,
} from "@/lib/hr/attendance/attendance-engine";

const LADDER_STATUSES = new Set(["Present", "Late", "Half-Day", "Absent"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspaceId, effectiveFrom } = body as {
      workspaceId?: string;
      effectiveFrom?: string;
    };
    if (!workspaceId || !effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return NextResponse.json(
        { error: "workspaceId and effectiveFrom (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rewriting attendance history is a people-management power.
    const { data: allowed } = await supabase.rpc("has_workspace_permission", {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_permission: "attendance_manage",
    });
    if (allowed !== true) {
      return NextResponse.json(
        { error: "Your role doesn't allow rewriting attendance records." },
        { status: 403 },
      );
    }

    const { data: settingRow } = await supabase
      .from("hr_operational_settings")
      .select("settings_json")
      .eq("workspace_id", workspaceId)
      .eq("setting_type", "ATTENDANCE_SHIFT")
      .eq("scope_type", "WORKSPACE_DEFAULT")
      .is("scope_id", null)
      .maybeSingle();
    const cfg = (settingRow?.settings_json ?? {}) as Record<string, unknown>;
    const shiftStart = typeof cfg.shift_start === "string" ? cfg.shift_start : null;
    if (!shiftStart) {
      return NextResponse.json(
        { error: "Set a shift start time in HR settings first — without it lateness cannot be scored." },
        { status: 400 },
      );
    }
    const rules: PunchLadderRules = {
      gracePeriodMinutes: Number(cfg.grace_period_minutes) || 0,
      halfDayAfterMinutes: cfg.half_day_after_minutes != null ? Number(cfg.half_day_after_minutes) : null,
      absentAfterMinutes: cfg.absent_after_minutes != null ? Number(cfg.absent_after_minutes) : null,
    };
    const utcOffset = Number(cfg.utc_offset_minutes) || 330;

    // Everything scoreable from the effective date. 5k rows ≈ 7 years
    // of one 2-person shop or a year of 20 staff — enough for one pass;
    // a bigger tenant reruns with a later date per batch.
    const { data: rows, error: rowsError } = await supabase
      .from("attendance")
      .select("id, attendance_date, punch_in_time, status")
      .eq("workspace_id", workspaceId)
      .gte("attendance_date", effectiveFrom)
      .not("punch_in_time", "is", null)
      .order("attendance_date")
      .limit(5000);
    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    let scanned = 0;
    let updated = 0;
    const failures: string[] = [];
    for (const row of rows ?? []) {
      if (!LADDER_STATUSES.has(row.status ?? "Present")) continue; // Remote etc.
      scanned += 1;
      const delay = minutesAfterShiftStart(row.punch_in_time, shiftStart, utcOffset);
      const next = statusFromPunchDelay(delay, rules);
      if (next === (row.status ?? "Present")) continue;
      const { error: updErr } = await supabase
        .from("attendance")
        .update({ status: next })
        .eq("id", row.id);
      if (updErr) failures.push(`${row.attendance_date}: ${updErr.message}`);
      else updated += 1;
    }

    if (failures.length > 0) {
      return NextResponse.json(
        { error: `Re-scored ${updated}, but ${failures.length} failed: ${failures[0]}`, scanned, updated },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, scanned, updated, effectiveFrom });
  } catch (err) {
    console.error("[attendance/recompute] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
