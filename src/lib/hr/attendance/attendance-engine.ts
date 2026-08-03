/**
 * Enterprise Attendance Calculation Engine
 * Calculates net productive hours, break durations, late arrivals, early exits,
 * and automated status determinations.
 */

import { round2 } from "@/lib/hr/salary";

export interface AttendanceMetricsInput {
  punchInTime: string;
  punchOutTime?: string;
  totalBreakMinutes?: number;
  /**
   * Shift start as minutes after midnight IN THE WORKSPACE'S timezone
   * (e.g. 540 for 09:00), together with the UTC offset that timezone was
   * at on the punch date.
   *
   * Both are required to score lateness and there is deliberately NO
   * default: `hr_shifts` is empty in every workspace today and no
   * timezone is stored anywhere, so a default would invent policy. A
   * punch at 06:04Z is on time for a 09:00 UTC shift and 2h34m late for
   * a 09:00 IST one — guessing silently mislabels people as late in a
   * field that feeds payroll disputes. Omit `shift` and lateness is
   * reported as null ("not assessed"), never as zero ("on time").
   */
  shift?: {
    startMinutesLocal: number;
    /** Minutes to ADD to UTC for the workspace's local time (IST = 330). */
    utcOffsetMinutes: number;
    gracePeriodMinutes?: number;
  };
  /** Net hours below which a present day counts as a half day. */
  halfDayThresholdHours?: number;
  /** Net hours beyond which the excess is overtime. */
  standardDayHours?: number;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Half-Day' | 'Absent' | 'Remote';

export interface AttendanceMetricsResult {
  totalHours: number;
  breakHours: number;
  netProductiveHours: number;
  /** Null when no shift was supplied — "not assessed", distinct from 0. */
  lateMinutes: number | null;
  overtimeHours: number;
  status: AttendanceStatus;
}

export function calculateAttendanceMetrics(input: AttendanceMetricsInput): AttendanceMetricsResult {
  const {
    punchInTime,
    punchOutTime,
    totalBreakMinutes = 0,
    shift,
    halfDayThresholdHours = 4,
    standardDayHours = 8,
  } = input;

  const punchIn = new Date(punchInTime);
  const breakHours = round2(totalBreakMinutes / 60);

  let totalHours = 0;
  let netProductiveHours = 0;
  let overtimeHours = 0;

  if (punchOutTime) {
    const punchOut = new Date(punchOutTime);
    const diffMs = punchOut.getTime() - punchIn.getTime();
    totalHours = Math.max(0, round2(diffMs / (1000 * 60 * 60)));
    netProductiveHours = Math.max(0, round2(totalHours - breakHours));

    if (netProductiveHours > standardDayHours) {
      overtimeHours = round2(netProductiveHours - standardDayHours);
    }
  }

  // Lateness is measured entirely in workspace-local minutes-after-midnight,
  // so it never depends on the server's timezone. Comparing UTC instants
  // through `setHours` — as this did before — silently scored every punch in
  // whatever zone the container happened to run in.
  let lateMinutes: number | null = null;
  if (shift) {
    const localMs = punchIn.getTime() + shift.utcOffsetMinutes * 60 * 1000;
    const local = new Date(localMs);
    const minutesAfterLocalMidnight = local.getUTCHours() * 60 + local.getUTCMinutes();
    const grace = shift.gracePeriodMinutes ?? 0;
    const minutesLate = minutesAfterLocalMidnight - shift.startMinutesLocal;
    // Past grace, the whole delay counts — grace forgives the arrival, it
    // does not shorten it.
    lateMinutes = minutesLate > grace ? minutesLate : 0;
  }

  let status: AttendanceStatus = 'Present';
  if (lateMinutes !== null && lateMinutes > 0) {
    status = 'Late';
  }
  // A short day outranks a late one: it is the more consequential fact for
  // payroll, and the two are reported separately anyway via lateMinutes.
  if (netProductiveHours > 0 && netProductiveHours < halfDayThresholdHours) {
    status = 'Half-Day';
  }

  return {
    totalHours,
    breakHours,
    netProductiveHours,
    lateMinutes,
    overtimeHours,
    status,
  };
}
