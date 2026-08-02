"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";

const time = (v: unknown) =>
  v ? new Date(String(v)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

/** The employee's own attendance history. */
export default function MyAttendancePage() {
  return (
    <MyRecordsList
      title="My Attendance"
      description="Your punch history, hours and work location."
      table="attendance"
      columns="id, attendance_date, punch_in_time, punch_out_time, working_hours, status, work_location"
      orderBy="attendance_date"
      emptyMessage="Your punches will appear here once you start clocking in."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{String(r.attendance_date)}</p>
            <p className="text-xs text-muted-foreground">
              In {time(r.punch_in_time)} · Out {time(r.punch_out_time)} ·{" "}
              {String(r.work_location ?? "OFFICE")}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm">
            {r.working_hours ? `${Number(r.working_hours).toFixed(1)}h` : "—"}
          </p>
        </div>
      )}
    />
  );
}
