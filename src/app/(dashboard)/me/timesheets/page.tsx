"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, Clock, Calendar, ChevronDown, Trash2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TimeLogForm } from "@/components/timesheets/time-log-form";
import { IconAction } from "@/components/ui/icon-action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TimeLogRow {
  id: string;
  log_date: string;
  duration: number;
  description: string | null;
  billable: boolean;
  task?: {
    title: string;
    project?: {
      name: string;
    } | null;
  } | null;
}

/** The employee's own logged time, grouped by date with expandable accordions and calendar filtering. */
export default function MyTimesheetsPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [logs, setLogs] = useState<TimeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Filters
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Collapsed states
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const fetchMine = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("time_logs")
        .select(`
          id, log_date, duration, description, billable,
          task:tasks!time_logs_task_id_fkey ( title, project:projects!tasks_project_id_fkey ( name ) )
        `)
        .eq("workspace_id", activeWorkspace.id)
        .eq("workspace_member_id", activeMember.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs((data as any[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load your timesheets");
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const map = new Map<string, { dateKey: string; displayDate: string; totalHours: number; logs: TimeLogRow[] }>();

    logs.forEach((log) => {
      const dateKey = log.log_date;
      if (!map.has(dateKey)) {
        const [year, month, day] = dateKey.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);
        const displayDate = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        map.set(dateKey, { dateKey, displayDate, totalHours: 0, logs: [] });
      }
      const group = map.get(dateKey)!;
      group.logs.push(log);
      group.totalHours += Number(log.duration || 0);
    });

    return Array.from(map.values());
  }, [logs]);

  // Filter grouped logs
  const filteredGroupedLogs = useMemo(() => {
    return groupedLogs.filter((group) => {
      if (selectedDateFilter && group.dateKey !== selectedDateFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = group.logs.some(
          (l) =>
            (l.task?.title || "").toLowerCase().includes(q) ||
            (l.description || "").toLowerCase().includes(q)
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [groupedLogs, selectedDateFilter, searchQuery]);

  const toggleDate = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      const { error } = await supabase.from("time_logs").delete().eq("id", logId);
      if (error) throw error;
      toast.success("Time log deleted");
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      toast.error("Failed to delete time log");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Timesheets"
        description="The time you have logged against projects and tasks."
        actions={
          <IconAction
            label="Log Time"
            icon={<Plus className="size-4" />}
            onClick={() => setFormOpen(true)}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          />
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Calendar className="size-4 text-primary shrink-0" />
            <span className="text-foreground">Filter by Date:</span>
            <Input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="h-7 w-auto bg-background text-xs border-border px-2 py-0 cursor-pointer"
            />
          </div>

          {selectedDateFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDateFilter("")}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="size-3.5" /> Show All Dates
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search task title or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 bg-background border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading your timesheets...</p>
        </div>
      ) : filteredGroupedLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Clock className="size-8 text-muted-foreground/60 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {selectedDateFilter ? `No time logs found for ${selectedDateFilter}` : "No time logged yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedDateFilter ? 'Click "Show All Dates" or select another date from the calendar.' : 'Click "Log Time" above to add your time entries.'}
          </p>
          {selectedDateFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDateFilter("")}
              className="mt-4 text-xs font-semibold"
            >
              Show All Dates
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroupedLogs.map((group) => {
            const isCollapsed = collapsedDates[group.dateKey] === true;

            return (
              <div key={group.dateKey} className="rounded-xl border border-border bg-card overflow-hidden transition-all shadow-xs">
                
                {/* Daily Header Summary Row */}
                <div
                  onClick={() => toggleDate(group.dateKey)}
                  className="flex items-center justify-between px-5 py-3.5 bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer select-none border-b border-border/60"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="size-6 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-transform"
                    >
                      <ChevronDown className={`size-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                    </button>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="size-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">{group.displayDate}</span>
                      <Badge variant="outline" className="text-[11px] bg-background text-muted-foreground border-border font-medium">
                        {group.logs.length} {group.logs.length === 1 ? "entry" : "entries"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-primary/20 font-mono font-bold px-2.5 py-0.5 text-xs">
                      {group.totalHours.toFixed(1)} hrs logged
                    </Badge>
                  </div>
                </div>

                {/* Expandable Entries List */}
                {!isCollapsed && (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground pl-6">Task / Project</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Description</TableHead>
                        <TableHead className="text-xs text-muted-foreground w-28">Hours</TableHead>
                        <TableHead className="text-xs text-muted-foreground w-24">Billable</TableHead>
                        <TableHead className="text-xs text-muted-foreground w-12 text-right pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.logs.map((log) => (
                        <TableRow key={log.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-6 py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-sm">{log.task?.title || "General / Unassigned"}</span>
                              {log.task?.project && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                  {log.task.project.name}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-sm truncate py-3" title={log.description || ""}>
                            {log.description || <span className="italic opacity-60">No details provided</span>}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-foreground py-3">
                            {Number(log.duration ?? 0)}h
                          </TableCell>
                          <TableCell className="py-3">
                            {log.billable ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold">Billable</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs font-medium">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLog(log.id);
                              }}
                              className="size-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                              title="Delete entry"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TimeLogForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchMine} />
    </div>
  );
}
