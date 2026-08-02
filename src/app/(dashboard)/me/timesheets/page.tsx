"use client";

import { MyRecordsList } from "@/components/self-service/my-records-list";
import { Badge } from "@/components/ui/badge";

/** The employee's own logged time. */
export default function MyTimesheetsPage() {
  return (
    <MyRecordsList
      title="My Timesheets"
      description="The time you have logged against projects and tasks."
      table="time_logs"
      columns="id, log_date, duration, description, billable"
      orderBy="log_date"
      emptyMessage="Time you log against tasks will appear here."
      renderRow={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{String(r.log_date)}</p>
            {r.description ? (
              <p className="truncate text-xs text-muted-foreground">{String(r.description)}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {r.billable ? (
              <Badge variant="secondary" className="text-[10px]">Billable</Badge>
            ) : null}
            <p className="font-mono text-sm">
              {r.duration ? `${Number(r.duration).toFixed(1)}h` : "—"}
            </p>
          </div>
        </div>
      )}
    />
  );
}
