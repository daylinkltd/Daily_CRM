/**
 * Enterprise Attendance Calculation Engine
 * Calculates net productive hours, break durations, late arrivals, early exits,
 * and automated status determinations.
 */

export interface AttendanceMetricsInput {
  punchInTime: string;
  punchOutTime?: string;
  totalBreakMinutes?: number;
  shiftStartHour?: number; // e.g. 9 for 09:00 AM
  gracePeriodMinutes?: number; // e.g. 15 mins
}

export interface AttendanceMetricsResult {
  totalHours: number;
  breakHours: number;
  netProductiveHours: number;
  lateMinutes: number;
  overtimeHours: number;
  status: 'Present' | 'Late' | 'Half-Day' | 'Absent' | 'Remote';
}

export function calculateAttendanceMetrics(input: AttendanceMetricsInput): AttendanceMetricsResult {
  const {
    punchInTime,
    punchOutTime,
    totalBreakMinutes = 0,
    shiftStartHour = 9,
    gracePeriodMinutes = 15,
  } = input;

  const punchIn = new Date(punchInTime);
  const breakHours = Math.round((totalBreakMinutes / 60) * 100) / 100;

  let totalHours = 0;
  let netProductiveHours = 0;
  let overtimeHours = 0;

  if (punchOutTime) {
    const punchOut = new Date(punchOutTime);
    const diffMs = punchOut.getTime() - punchIn.getTime();
    totalHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
    netProductiveHours = Math.max(0, Math.round((totalHours - breakHours) * 100) / 100);
    
    // Overtime > 8 hours net productive
    if (netProductiveHours > 8) {
      overtimeHours = Math.round((netProductiveHours - 8) * 100) / 100;
    }
  }

  // Late calculation
  const shiftStart = new Date(punchIn);
  shiftStart.setHours(shiftStartHour, 0, 0, 0);
  const graceCutoff = new Date(shiftStart.getTime() + gracePeriodMinutes * 60 * 1000);

  let lateMinutes = 0;
  if (punchIn > graceCutoff) {
    lateMinutes = Math.round((punchIn.getTime() - shiftStart.getTime()) / (1000 * 60));
  }

  let status: 'Present' | 'Late' | 'Half-Day' | 'Absent' | 'Remote' = 'Present';
  if (lateMinutes > 0) {
    status = 'Late';
  }
  if (netProductiveHours > 0 && netProductiveHours < 4) {
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
