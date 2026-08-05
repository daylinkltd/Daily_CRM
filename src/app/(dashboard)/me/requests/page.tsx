"use client";

import { useState } from "react";
import { CalendarClock, Umbrella, Send, CheckCircle2 } from "lucide-react";

import { EmployeeGuard } from "@/components/layout/employee-guard";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { AttendanceRequestModal } from "@/components/attendance/request-modal";

/**
 * Submit-only. Deliberately shows no list, no status and no history.
 *
 * Once a request is sent it belongs to HR: they see it, action it and
 * communicate the outcome. A status column here would create a second
 * place to check and invite "why is it still pending?" before HR has even
 * opened it.
 *
 * Leave lives here too — there is no separate My Leave page any more. The
 * employee submits and everything after that happens in the HR module.
 * The two forms write to different tables (`leave_requests` and
 * `hr_attendance_requests`), so this page routes to the right one rather
 * than pretending they are one thing.
 */
function MyRequestsContent() {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raise a Request"
        description="Send a request to HR. They'll pick it up and get back to you."
      />

      {sent && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-foreground">{sent} sent to HR</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              HR will review it and get back to you directly.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <Umbrella className="size-5 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Leave request</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Planned time off — holiday, sick leave, personal days.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Send className="size-3" /> Submit
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAttendanceOpen(true)}
          className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <CalendarClock className="size-5 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Attendance request
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Missed punch, correction, early exit, work from home or overtime.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Send className="size-3" /> Submit
          </span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Submitted requests are handled by HR. You won&apos;t see a status here —
        speak to HR if you need an update.
      </p>

      <LeaveRequestForm
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onSaved={() => setSent("Leave request")}
      />
      <AttendanceRequestModal
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
        onSubmitted={() => setSent("Attendance request")}
      />
    </div>
  );
}

/**
 * Employee-only. A member without an `employee_profiles` row sees an
 * explanation instead of an empty page — see EmployeeGuard.
 */
export default function MyRequestsPage() {
  return (
    <EmployeeGuard feature="Requests">
      <MyRequestsContent />
    </EmployeeGuard>
  );
}
