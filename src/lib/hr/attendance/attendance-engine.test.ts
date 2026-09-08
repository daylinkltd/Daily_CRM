import { describe, it, expect } from "vitest";
import { calculateAttendanceMetrics, minutesAfterShiftStart, statusFromPunchDelay } from "./attendance-engine";

/** 09:00 local, 15 min grace, in IST (UTC+5:30). */
const IST_9AM = { startMinutesLocal: 9 * 60, utcOffsetMinutes: 330, gracePeriodMinutes: 15 };

describe("calculateAttendanceMetrics", () => {
  it("computes total, break and net productive hours", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T04:00:00Z",
      punchOutTime: "2026-08-01T13:00:00Z", // 9h elapsed
      totalBreakMinutes: 60,
    });
    expect(r.totalHours).toBe(9);
    expect(r.breakHours).toBe(1);
    expect(r.netProductiveHours).toBe(8);
  });

  it("counts only net hours beyond the standard day as overtime", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T04:00:00Z",
      punchOutTime: "2026-08-01T14:30:00Z", // 10.5h elapsed
      totalBreakMinutes: 30,
    });
    expect(r.netProductiveHours).toBe(10);
    expect(r.overtimeHours).toBe(2);
  });

  it("reports no overtime for a day that never punched out", () => {
    const r = calculateAttendanceMetrics({ punchInTime: "2026-08-01T04:00:00Z" });
    expect(r.totalHours).toBe(0);
    expect(r.netProductiveHours).toBe(0);
    expect(r.overtimeHours).toBe(0);
  });

  // The bug this engine shipped with: lateness was measured by calling
  // setHours() on a UTC instant, so the answer depended on the server's
  // timezone. These two cases pin the boundary in workspace-local terms.
  it("scores lateness in the workspace timezone, not the server's", () => {
    // 06:04Z = 11:34 IST — 2h34m past a 09:00 IST shift.
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T06:04:00Z",
      punchOutTime: "2026-08-01T13:00:00Z",
      shift: IST_9AM,
    });
    expect(r.lateMinutes).toBe(154);
    expect(r.status).toBe("Late");
  });

  it("treats the same instant as on time for a UTC workspace", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T06:04:00Z",
      punchOutTime: "2026-08-01T13:00:00Z",
      shift: { startMinutesLocal: 9 * 60, utcOffsetMinutes: 0, gracePeriodMinutes: 15 },
    });
    // 06:04 UTC is before a 09:00 UTC shift — early, not late.
    expect(r.lateMinutes).toBe(0);
    expect(r.status).toBe("Present");
  });

  it("forgives arrival within grace but counts the full delay past it", () => {
    // 09:10 IST = 03:40Z — inside the 15 min grace.
    const inGrace = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T03:40:00Z",
      punchOutTime: "2026-08-01T13:00:00Z",
      shift: IST_9AM,
    });
    expect(inGrace.lateMinutes).toBe(0);

    // 09:20 IST = 03:50Z — past grace, so all 20 minutes count.
    const pastGrace = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T03:50:00Z",
      punchOutTime: "2026-08-01T13:00:00Z",
      shift: IST_9AM,
    });
    expect(pastGrace.lateMinutes).toBe(20);
  });

  it("reports lateness as null, not zero, when no shift is configured", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T06:04:00Z",
      punchOutTime: "2026-08-01T13:00:00Z",
    });
    // Null is "not assessed". Zero would claim the punch was on time,
    // which nothing in the database currently supports.
    expect(r.lateMinutes).toBeNull();
    expect(r.status).not.toBe("Late");
  });

  it("calls a short day a half day even when the arrival was late", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T06:04:00Z",
      punchOutTime: "2026-08-01T08:04:00Z", // 2h
      shift: IST_9AM,
    });
    expect(r.netProductiveHours).toBe(2);
    expect(r.status).toBe("Half-Day");
    // Still reported separately, so nothing is lost by the status.
    expect(r.lateMinutes).toBe(154);
  });

  it("honours configured half-day and standard-day thresholds", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T04:00:00Z",
      punchOutTime: "2026-08-01T09:00:00Z", // 5h
      halfDayThresholdHours: 6,
      standardDayHours: 4,
    });
    expect(r.status).toBe("Half-Day"); // 5 < 6
    expect(r.overtimeHours).toBe(1); // 5 - 4
  });

  it("never returns negative hours when punch out precedes punch in", () => {
    const r = calculateAttendanceMetrics({
      punchInTime: "2026-08-01T13:00:00Z",
      punchOutTime: "2026-08-01T04:00:00Z",
    });
    expect(r.totalHours).toBe(0);
    expect(r.netProductiveHours).toBe(0);
  });
});

describe('statusFromPunchDelay — the handbook ladder in minutes', () => {
  const daylink = { gracePeriodMinutes: 0, halfDayAfterMinutes: 1, absentAfterMinutes: 15 };

  it('matches the Daylink handbook: by 10:00 on time, 10:00-10:15 half day, 10:15+ absent', () => {
    expect(statusFromPunchDelay(-30, daylink)).toBe('Present'); // early
    expect(statusFromPunchDelay(0, daylink)).toBe('Present');   // 10:00 sharp
    expect(statusFromPunchDelay(1, daylink)).toBe('Half-Day');  // 10:01
    expect(statusFromPunchDelay(14, daylink)).toBe('Half-Day'); // 10:14
    expect(statusFromPunchDelay(15, daylink)).toBe('Absent');   // 10:15
    expect(statusFromPunchDelay(120, daylink)).toBe('Absent');
  });

  it('grace forgives, then Late fills the gap before the half-day mark', () => {
    const rules = { gracePeriodMinutes: 10, halfDayAfterMinutes: 30, absentAfterMinutes: 120 };
    expect(statusFromPunchDelay(10, rules)).toBe('Present');
    expect(statusFromPunchDelay(11, rules)).toBe('Late');
    expect(statusFromPunchDelay(29, rules)).toBe('Late');
    expect(statusFromPunchDelay(30, rules)).toBe('Half-Day');
    expect(statusFromPunchDelay(120, rules)).toBe('Absent');
  });

  it('missing thresholds degrade to plain Present/Late', () => {
    const rules = { gracePeriodMinutes: 15 };
    expect(statusFromPunchDelay(20, rules)).toBe('Late');
    expect(statusFromPunchDelay(500, rules)).toBe('Late');
  });
});

describe('minutesAfterShiftStart', () => {
  it('scores an IST punch against an IST shift', () => {
    // 04:35Z = 10:05 IST → 5 minutes after a 10:00 shift.
    expect(minutesAfterShiftStart('2026-09-08T04:35:00Z', '10:00', 330)).toBe(5);
  });
  it('early arrivals are negative', () => {
    expect(minutesAfterShiftStart('2026-09-08T04:00:00Z', '10:00', 330)).toBe(-30);
  });
});
