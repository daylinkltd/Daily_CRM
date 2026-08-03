'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Loader2, Clock, Plus, AlertCircle, BarChart3, ChevronDown, Calendar, Trash2, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TimeLogForm } from '@/components/timesheets/time-log-form';
import { formatMemberName } from '@/components/tasks/task-form';
import { IconAction } from "@/components/ui/icon-action";

export default function TimesheetsPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManageTimesheets = can('attendance_manage') || can('people_manage'); 

  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [teamTimesheets, setTeamTimesheets] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Calendar / Date Filters
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date filters for team aggregation (Default to today)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // Track collapsed date groups
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const fetchMyLogs = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;

    const { data, error } = await supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks!time_logs_task_id_fkey ( title, project_id, project:projects!tasks_project_id_fkey ( name ) )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .eq('workspace_member_id', activeMember.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) toast.error('Failed to load your time logs');
    else setMyLogs(data || []);
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  const fetchTeamTimesheets = useCallback(async () => {
    if (!activeWorkspace?.id || !canManageTimesheets) return;

    try {
      const [membersRes, attRes, logsRes] = await Promise.all([
        fetch(`/api/account/members?workspace_id=${activeWorkspace.id}`).then((r) => r.json()).catch(() => ({ members: [] })),
        supabase.from('attendance').select('*').eq('workspace_id', activeWorkspace.id).eq('attendance_date', reportDate),
        supabase.from('time_logs').select('workspace_member_id, duration').eq('workspace_id', activeWorkspace.id).eq('log_date', reportDate)
      ]);

      const loadedMembers = membersRes?.members || [];
      const attList = attRes.data || [];
      const logList = logsRes.data || [];

      // Map logs by workspace_member_id
      const logMap: Record<string, number> = {};
      logList.forEach((log: any) => {
        if (!logMap[log.workspace_member_id]) logMap[log.workspace_member_id] = 0;
        logMap[log.workspace_member_id] += Number(log.duration) || 0;
      });

      // Map attendance by workspace_member_id
      const attMap: Record<string, any> = {};
      attList.forEach((att: any) => {
        attMap[att.workspace_member_id] = att;
      });

      // Aggregate for all team members
      const aggregated = loadedMembers.map((m: any) => {
        const att = attMap[m.id];
        const loggedTime = logMap[m.id] || 0;
        const attendanceHours = att?.working_hours || 0;

        return {
          member_id: m.id,
          name: formatMemberName(m),
          avatar: m.avatar_url,
          status: att?.status || 'OFF',
          attendanceHours,
          loggedTime,
          discrepancy: loggedTime - attendanceHours
        };
      });

      setTeamTimesheets(aggregated);
    } catch (err) {
      console.error('Team timesheets fetch error:', err);
    }
  }, [supabase, activeWorkspace?.id, canManageTimesheets, reportDate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await fetchMyLogs();
    if (canManageTimesheets) {
      await fetchTeamTimesheets();
    }
    setLoading(false);
  }, [fetchMyLogs, fetchTeamTimesheets, canManageTimesheets]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Group myLogs by log_date
  const groupedLogs = useMemo(() => {
    const map = new Map<string, { dateKey: string; displayDate: string; totalHours: number; logs: any[] }>();

    myLogs.forEach((log) => {
      const dateKey = log.log_date; // YYYY-MM-DD
      if (!map.has(dateKey)) {
        // Parse date for clean display e.g. "Mon, Aug 3, 2026"
        const [year, month, day] = dateKey.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const displayDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        map.set(dateKey, { dateKey, displayDate, totalHours: 0, logs: [] });
      }
      const group = map.get(dateKey)!;
      group.logs.push(log);
      group.totalHours += Number(log.duration || 0);
    });

    return Array.from(map.values());
  }, [myLogs]);

  // Filter grouped logs by calendar date or search query
  const filteredGroupedLogs = useMemo(() => {
    return groupedLogs.filter((group) => {
      if (selectedDateFilter && group.dateKey !== selectedDateFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = group.logs.some(
          (l) =>
            (l.task?.title || '').toLowerCase().includes(q) ||
            (l.description || '').toLowerCase().includes(q)
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
      const { error } = await supabase.from('time_logs').delete().eq('id', logId);
      if (error) throw error;
      toast.success('Time log deleted');
      setMyLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err: any) {
      toast.error('Failed to delete time log');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Timesheets" 
        description="Log time against tasks and review team productivity."
        action={
          <IconAction label="Log Time" icon={<Plus className="size-4 " />} onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" />
        }
      />

      <Tabs defaultValue="my-logs" className="w-full">
        <TabsList className="bg-muted w-full justify-start overflow-x-auto h-auto p-1 rounded-lg">
          <TabsTrigger value="my-logs" className="py-2 flex items-center gap-2">
            <Clock className="size-4" /> My Time Logs
          </TabsTrigger>
          {canManageTimesheets && (
            <TabsTrigger value="team" className="py-2 flex items-center gap-2">
              <BarChart3 className="size-4" /> Team Reports
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="my-logs" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            
            {/* Calendar & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 p-3 bg-card border border-border rounded-xl shadow-xs">
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
                    onClick={() => setSelectedDateFilter('')}
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
                      onClick={() => setSearchQuery('')}
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
                <p className="text-xs text-muted-foreground mt-2">Loading your time logs...</p>
              </div>
            ) : filteredGroupedLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
                <Clock className="size-8 text-muted-foreground/60 mx-auto" />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {selectedDateFilter ? `No time logs found for ${selectedDateFilter}` : 'No time logged yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDateFilter ? 'Click "Show All Dates" or select another date from the calendar.' : 'Click "Log Time" above to add your first entries for the day.'}
                </p>
                {selectedDateFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDateFilter('')}
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
                            <ChevronDown className={`size-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                          </button>
                          <div className="flex items-center gap-2.5">
                            <Calendar className="size-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">{group.displayDate}</span>
                            <Badge variant="outline" className="text-[11px] bg-background text-muted-foreground border-border font-medium">
                              {group.logs.length} {group.logs.length === 1 ? 'entry' : 'entries'}
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
                                    <span className="font-semibold text-foreground text-sm">{log.task?.title || 'General / Unassigned'}</span>
                                    {log.task?.project && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                        {log.task.project.name}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-sm truncate py-3" title={log.description || ''}>
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
          </TabsContent>

          {canManageTimesheets && (
            <TabsContent value="team" className="m-0 focus-visible:outline-none">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Input 
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-auto bg-card border-border"
                  />
                  <Button variant="outline" size="sm" onClick={fetchTeamTimesheets}>Run Report</Button>
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Employee</TableHead>
                      <TableHead className="text-muted-foreground">Attendance Status</TableHead>
                      <TableHead className="text-muted-foreground">Clocked Hours (GPS)</TableHead>
                      <TableHead className="text-muted-foreground">Task Hours Logged</TableHead>
                      <TableHead className="text-muted-foreground">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-12">
                          <Loader2 className="size-6 animate-spin text-primary mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : teamTimesheets.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No attendance data found for {new Date(reportDate).toLocaleDateString()}. Employees must punch in first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamTimesheets.map((row) => (
                        <TableRow key={row.member_id} className="border-border hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7 border border-border">
                                {row.avatar && <AvatarImage src={row.avatar} />}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{row.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground text-sm">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={row.status === 'Absent' ? 'bg-red-500/15 text-red-700' : 'bg-blue-500/15 text-blue-700'}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.attendanceHours}h</TableCell>
                          <TableCell className="font-mono text-sm font-medium">{row.loggedTime}h</TableCell>
                          <TableCell>
                            {row.discrepancy > 0 ? (
                              <span className="flex items-center gap-1 text-orange-600 text-sm font-medium" title="Unlogged time">
                                <AlertCircle className="size-3.5" /> -{row.discrepancy}h
                              </span>
                            ) : row.discrepancy < 0 ? (
                              <span className="text-emerald-600 text-sm font-medium">
                                +{Math.abs(row.discrepancy)}h
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Match</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </div>
      </Tabs>

      <TimeLogForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={loadAll}
      />
    </div>
  );
}
