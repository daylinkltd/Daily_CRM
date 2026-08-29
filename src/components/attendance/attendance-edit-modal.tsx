"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { assertAffected } from "@/lib/supabase/affected-rows";
import { calculateAttendanceMetrics } from "@/lib/hr/attendance/attendance-engine";
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextArea } from "@/components/ui/rich-textarea";

export interface AttendanceEditRow {
  id?: string;
  workspace_member_id?: string | null;
  attendance_date?: string | null;
  punch_in_time?: string | null;
  punch_out_time?: string | null;
  status?: string | null;
  work_location?: string | null;
  break_hours?: number | null;
  remarks?: string | null;
}

export interface MemberOption {
  id: string;
  name: string;
}

const STATUSES = ["Present", "Absent", "Half-Day", "Remote", "Late"];
const WORK_LOCATIONS = ["OFFICE", "REMOTE", "FIELD", "CLIENT_SITE"];

/**
 * Convert a stored timestamptz to the `datetime-local` value the input
 * needs, in the browser's own timezone.
 *
 * `toISOString().slice(0,16)` would render the UTC wall clock, so an
 * 09:30 IST punch would show as 04:00 and HR would "correct" it into a
 * genuinely wrong time.
 */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` back to an ISO instant, or null when cleared. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * HR logs or corrects one attendance record.
 *
 * Hours are never typed by hand — `working_hours`, `break_hours`,
 * `net_productive_hours` and `overtime_hours` are recomputed from the
 * punch times through the same engine punch-out uses, so a record HR
 * edits and one the employee created are arithmetically identical.
 *
 * `late_minutes` and `status` are deliberately NOT derived: no shift or
 * workspace timezone is configured anywhere, so lateness cannot be scored
 * honestly. HR sets the status by hand instead.
 */
export function AttendanceEditModal({
  open,
  onOpenChange,
  record,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing row to edit, or null/undefined to log a new one. */
  record?: AttendanceEditRow | null;
  members: MemberOption[];
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [saving, setSaving] = useState(false);

  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState("");
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [status, setStatus] = useState("Present");
  const [workLocation, setWorkLocation] = useState("OFFICE");
  const [breakHours, setBreakHours] = useState("0");
  const [remarks, setRemarks] = useState("");

  const isEdit = Boolean(record?.id);

  // Re-seed whenever the dialog opens on a different record.
  useEffect(() => {
    if (!open) return;
    setMemberId(record?.workspace_member_id ?? "");
    setDate(record?.attendance_date ?? new Date().toISOString().slice(0, 10));
    setPunchIn(toLocalInput(record?.punch_in_time));
    setPunchOut(toLocalInput(record?.punch_out_time));
    setStatus(record?.status ?? "Present");
    setWorkLocation(record?.work_location ?? "OFFICE");
    setBreakHours(String(record?.break_hours ?? 0));
    setRemarks(record?.remarks ?? "");
  }, [open, record]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    if (!memberId) {
      toast.error("Pick an employee");
      return;
    }
    if (!date) {
      toast.error("Pick a date");
      return;
    }

    const punchInIso = fromLocalInput(punchIn);
    const punchOutIso = fromLocalInput(punchOut);

    if (punchInIso && punchOutIso && new Date(punchOutIso) < new Date(punchInIso)) {
      toast.error("Punch out cannot be before punch in");
      return;
    }

    const breaks = Number(breakHours);
    if (!Number.isFinite(breaks) || breaks < 0) {
      toast.error("Break hours must be zero or more");
      return;
    }

    // Same engine as punch-out, so HR-entered and employee-entered records
    // agree. No `shift` is passed — lateness stays unassessed.
    const metrics = punchInIso
      ? calculateAttendanceMetrics({
          punchInTime: punchInIso,
          punchOutTime: punchOutIso ?? undefined,
          totalBreakMinutes: breaks * 60,
        })
      : null;

    const payload = {
      workspace_id: activeWorkspace.id,
      workspace_member_id: memberId,
      attendance_date: date,
      punch_in_time: punchInIso,
      punch_out_time: punchOutIso,
      status,
      work_location: workLocation,
      break_hours: breaks,
      remarks: remarks.trim() || null,
      working_hours: metrics?.totalHours ?? 0,
      net_productive_hours: metrics?.netProductiveHours ?? 0,
      overtime_hours: metrics?.overtimeHours ?? 0,
    };

    setSaving(true);
    try {
      if (isEdit && record?.id) {
        const result = await supabase
          .from("attendance")
          .update(payload)
          .eq("id", record.id)
          .select();
        assertAffected(result, "that attendance record");
      } else {
        const { data, error } = await supabase
          .from("attendance")
          .insert(payload)
          .select()
          .single();
        if (error) {
          // One row per member per day is the intent; say so plainly rather
          // than surfacing a raw constraint name.
          throw new Error(
            /duplicate key|unique constraint/i.test(error.message)
              ? "There is already a record for that employee on that date. Edit it instead."
              : error.message,
          );
        }
        if (!data) throw new Error("Could not create the attendance record");
      }

      toast.success(isEdit ? "Attendance updated" : "Attendance logged");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Edit attendance" : "Log attendance"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-foreground">Employee</Label>
              {/* Searchable: a workspace's headcount is unbounded. */}
              <SearchableSelect
                className="mt-1.5"
                ariaLabel="Employee"
                options={members.map((m) => ({ value: m.id, label: m.name }))}
                value={memberId || null}
                onChange={(v) => setMemberId(v ?? "")}
                disabled={isEdit}
                placeholder="Select an employee…"
                searchPlaceholder="Search employees…"
                emptyMessage="No employees match"
              />
            </div>
            <div>
              <Label className="text-foreground">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isEdit}
                className="mt-1.5 bg-background"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-foreground">Punch in</Label>
              <Input
                type="datetime-local"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
            <div>
              <Label className="text-foreground">Punch out</Label>
              <Input
                type="datetime-local"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-foreground">Status</Label>
              <NativeSelect
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-foreground">Location</Label>
              <NativeSelect
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                {WORK_LOCATIONS.map((w) => (
                  <option key={w} value={w}>
                    {w.replace(/_/g, " ")}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-foreground">Break (hrs)</Label>
              <Input
                type="number"
                min="0"
                step="0.25"
                value={breakHours}
                onChange={(e) => setBreakHours(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
          </div>

          <div>
            <Label className="text-foreground">Remarks</Label>
            <RichTextArea
              plain
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why this record was added or changed"
              rows={2}
              className="mt-1.5 bg-background"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Worked, net and overtime hours are calculated from the punch times —
            you don&apos;t need to enter them.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Log attendance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
