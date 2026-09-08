"use client";

/**
 * Per-employee attendance + timesheet calendar — the Daylink view,
 * rebuilt on the imported data.
 *
 * One month, one person, one grid: each day shows the attendance
 * verdict (Present / Late / Half-Day / Remote / Absent — or "no
 * record" for a past working day with no row, which is what absence
 * actually looks like in this data), the punch window, and the hours
 * logged against tasks that day. Clicking a day opens the detail:
 * every time-log entry with its task and project, plus the punch
 * remarks the Daylink import preserved.
 *
 * Managers (attendance_manage) can open anyone and switch employee
 * from the header; everyone else sees only themselves — the same rule
 * the team attendance page applies, enforced again here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AttendanceRow {
  id: string;
  attendance_date: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  working_hours: number | null;
  status: string | null;
  remarks: string | null;
}

interface TimeLog {
  id: string;
  log_date: string;
  duration: number;
  description: string | null;
  task: { title: string; project: { name: string } | null } | null;
}

interface MemberOption {
  member_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  Present: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Late: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "Half-Day": "bg-sky-500/15 text-sky-500 border-sky-500/30",
  Remote: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  Absent: "bg-red-500/15 text-red-500 border-red-500/30",
  "No record": "bg-red-500/5 text-red-400/70 border-red-500/15",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(d: Date): string {
  // Local date, not toISOString() — UTC would shift IST evenings a day.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MemberAttendancePage() {
  const { memberId } = useParams<{ memberId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const canManage = can("attendance_manage");

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Self-only for non-managers: the same fence the team page has, so a
  // pasted URL cannot widen what the role allows.
  const effectiveMemberId = canManage ? memberId : activeMember?.id ?? memberId;

  const monthStart = ymd(month);
  const monthEnd = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("id, user_id")
      .eq("workspace_id", workspaceId);
    const userIds = (memberRows || []).map((m) => m.user_id);
    const { data: profileRows } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
      : { data: [] as { user_id: string; full_name: string | null; avatar_url: string | null }[] };
    const profileByUser = new Map((profileRows || []).map((p) => [p.user_id, p]));
    setMembers(
      (memberRows || [])
        .map((m) => ({
          member_id: m.id,
          user_id: m.user_id,
          full_name: profileByUser.get(m.user_id)?.full_name || "Team member",
          avatar_url: profileByUser.get(m.user_id)?.avatar_url ?? null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    );
  }, [supabase, workspaceId]);

  const loadMonth = useCallback(async () => {
    if (!workspaceId || !effectiveMemberId) return;
    setLoading(true);
    try {
      const [attRes, logRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, attendance_date, punch_in_time, punch_out_time, working_hours, status, remarks")
          .eq("workspace_id", workspaceId)
          .eq("workspace_member_id", effectiveMemberId)
          .gte("attendance_date", monthStart)
          .lte("attendance_date", monthEnd)
          .order("attendance_date"),
        supabase
          .from("time_logs")
          .select("id, log_date, duration, description, task:tasks!time_logs_task_id_fkey(title, project:projects!tasks_project_id_fkey(name))")
          .eq("workspace_id", workspaceId)
          .eq("workspace_member_id", effectiveMemberId)
          .gte("log_date", monthStart)
          .lte("log_date", monthEnd),
      ]);
      if (attRes.error) throw attRes.error;
      if (logRes.error) throw logRes.error;
      setAttendance((attRes.data as AttendanceRow[]) || []);
      setLogs((logRes.data as unknown as TimeLog[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the month");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId, effectiveMemberId, monthStart, monthEnd]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);
  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const person = members.find((m) => m.member_id === effectiveMemberId);
  const attByDate = useMemo(
    () => new Map(attendance.map((a) => [a.attendance_date, a])),
    [attendance],
  );
  const logsByDate = useMemo(() => {
    const map = new Map<string, TimeLog[]>();
    for (const l of logs) {
      const list = map.get(l.log_date) ?? [];
      list.push(l);
      map.set(l.log_date, list);
    }
    return map;
  }, [logs]);

  // The calendar grid: leading blanks so day 1 lands on its weekday
  // (Monday-first, the way Indian shop calendars read).
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Sunday=0 → Monday-first offset
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);

  const todayKey = ymd(new Date());

  /** The verdict a cell shows. Past working day without a row = the
   *  absence this data actually records (rows exist only for punches). */
  function dayStatus(date: Date): string | null {
    const key = ymd(date);
    const row = attByDate.get(key);
    if (row?.status) return row.status;
    if (row) return "Present";
    const isWeekend = date.getDay() === 0; // Sunday off (Daylink worked Saturdays)
    if (!isWeekend && key < todayKey) return "No record";
    return null;
  }

  const summary = useMemo(() => {
    let present = 0, late = 0, half = 0, remote = 0, absent = 0, noRecord = 0, workedHours = 0;
    for (const cell of days) {
      if (!cell) continue;
      const s = dayStatus(cell);
      if (s === "Present") present += 1;
      else if (s === "Late") { late += 1; }
      else if (s === "Half-Day") half += 1;
      else if (s === "Remote") remote += 1;
      else if (s === "Absent") absent += 1;
      else if (s === "No record") noRecord += 1;
    }
    for (const a of attendance) workedHours += Number(a.working_hours) || 0;
    const loggedHours = logs.reduce((s, l) => s + (Number(l.duration) || 0), 0);
    return { present, late, half, remote, absent, noRecord, workedHours, loggedHours };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, attendance, logs, attByDate]);

  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });
  const selectedAtt = selectedDay ? attByDate.get(selectedDay) : null;
  const selectedLogs = selectedDay ? logsByDate.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-6 p-(--page-padding-desktop)">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/attendance"
          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Back to team attendance"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {person?.avatar_url ? <AvatarImage src={person.avatar_url} alt={person.full_name} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {(person?.full_name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <PageHeader
            title={person?.full_name || "Team member"}
            description={`Attendance & timesheet — ${monthLabel}`}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canManage && members.length > 1 && (
            <Select
              value={effectiveMemberId}
              onValueChange={(v) => v && router.push(`/attendance/${v}`)}
            >
              <SelectTrigger className="w-52" aria-label="Switch employee">
                <SelectValue>
                  {(v: string) => members.find((m) => m.member_id === v)?.full_name ?? "Employee"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent searchPlaceholder="Search team...">
                {members.map((m) => (
                  <SelectItem key={m.member_id} value={m.member_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" aria-label="Previous month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}>
              Today
            </Button>
            <Button variant="outline" size="sm" aria-label="Next month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Month summary — the numbers a manager wants before the grid. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span><span className="font-semibold text-emerald-500">{summary.present}</span> present</span>
        <span><span className="font-semibold text-amber-500">{summary.late}</span> late</span>
        <span><span className="font-semibold text-sky-500">{summary.half}</span> half-day</span>
        <span><span className="font-semibold text-violet-500">{summary.remote}</span> remote</span>
        <span><span className="font-semibold text-red-500">{summary.absent + summary.noRecord}</span> absent / no record</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          <span className="font-semibold text-foreground">{summary.workedHours.toFixed(1)}h</span> attendance ·{" "}
          <span className="font-semibold text-foreground">{summary.loggedHours.toFixed(1)}h</span> logged on tasks
        </span>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1.5">
                {days.map((cell, i) => {
                  if (!cell) return <div key={`blank-${i}`} />;
                  const key = ymd(cell);
                  const status = dayStatus(cell);
                  const att = attByDate.get(key);
                  const dayLogs = logsByDate.get(key) ?? [];
                  const logged = dayLogs.reduce((s, l) => s + (Number(l.duration) || 0), 0);
                  const isToday = key === todayKey;
                  const isSunday = cell.getDay() === 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      className={`min-h-20 rounded-lg border p-1.5 text-left transition-colors hover:border-primary/60 ${
                        isToday ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
                      } ${isSunday ? "bg-muted/30" : "bg-background/40"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                          {cell.getDate()}
                        </span>
                        {status && (
                          <span className={`rounded border px-1 py-px text-[9px] font-medium leading-tight ${STATUS_STYLE[status] ?? "border-border text-muted-foreground"}`}>
                            {status === "No record" ? "—" : status === "Half-Day" ? "½" : status.charAt(0)}
                          </span>
                        )}
                      </div>
                      {att?.punch_in_time && (
                        <div className="mt-1 truncate text-[10px] text-muted-foreground">
                          {fmtTime(att.punch_in_time)}–{fmtTime(att.punch_out_time)}
                        </div>
                      )}
                      {logged > 0 && (
                        <div className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                          <Clock className="size-2.5" /> {logged.toFixed(1)}h
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Legend — single letters need decoding once. */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span><span className="font-semibold text-emerald-500">P</span> Present</span>
                <span><span className="font-semibold text-amber-500">L</span> Late</span>
                <span><span className="font-semibold text-sky-500">½</span> Half-day</span>
                <span><span className="font-semibold text-violet-500">R</span> Remote</span>
                <span><span className="font-semibold text-red-500">A</span> Absent</span>
                <span><span className="font-semibold text-red-400/70">—</span> No record (past working day)</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Day detail — the timesheet behind the number. */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              {selectedDay &&
                new Date(`${selectedDay}T00:00:00`).toLocaleDateString([], {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 text-sm">
              {selectedAtt ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge className={STATUS_STYLE[selectedAtt.status ?? "Present"] ?? ""}>
                      {selectedAtt.status ?? "Present"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Number(selectedAtt.working_hours || 0).toFixed(1)}h worked
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    In {fmtTime(selectedAtt.punch_in_time)} · Out {fmtTime(selectedAtt.punch_out_time)}
                  </p>
                  {selectedAtt.remarks && (
                    <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">
                      {selectedAtt.remarks}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No attendance record for this day.</p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Time logged ({selectedLogs.reduce((s, l) => s + (Number(l.duration) || 0), 0).toFixed(1)}h)
              </h4>
              {selectedLogs.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No timesheet entries.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedLogs.map((l) => (
                    <li key={l.id} className="rounded-lg border border-border/60 p-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 font-medium text-foreground">
                          {l.task?.title ?? "General work"}
                          {l.task?.project?.name && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              · {l.task.project.name}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {Number(l.duration).toFixed(1)}h
                        </span>
                      </div>
                      {l.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
