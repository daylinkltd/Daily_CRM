'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Clock, Plus, AlertCircle, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TimeLogForm } from '@/components/timesheets/time-log-form';

import { formatMemberName } from '@/components/tasks/task-form';

export default function TimesheetsPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManageTimesheets = can('attendance_manage') || can('people_manage'); 

  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [teamTimesheets, setTeamTimesheets] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Date filters for team aggregation (Default to today)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

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
      .limit(50);

    if (error) toast.error('Failed to load your time logs');
    else setMyLogs(data || []);
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  const fetchTeamTimesheets = useCallback(async () => {
    if (!activeWorkspace?.id || !canManageTimesheets) return;

    try {
      const [membersRes, attRes, logsRes] = await Promise.all([
        fetch('/api/account/members').then((r) => r.json()).catch(() => ({ members: [] })),
        supabase.from('attendance').select('*').eq('workspace_id', activeWorkspace.id).eq('attendance_date', reportDate),
        supabase.from('time_logs').select('workspace_member_id, hours_logged').eq('workspace_id', activeWorkspace.id).eq('log_date', reportDate)
      ]);

      const loadedMembers = membersRes?.members || [];
      const attList = attRes.data || [];
      const logList = logsRes.data || [];

      // Map logs by workspace_member_id
      const logMap: Record<string, number> = {};
      logList.forEach((log: any) => {
        if (!logMap[log.workspace_member_id]) logMap[log.workspace_member_id] = 0;
        logMap[log.workspace_member_id] += Number(log.hours_logged) || 0;
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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Timesheets" 
        description="Log time against tasks and review team productivity."
        action={
          <Button onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="size-4 mr-2" /> Log Time
          </Button>
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
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Task / Project</TableHead>
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground w-32">Hours</TableHead>
                    <TableHead className="text-muted-foreground w-24">Billable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-6 animate-spin text-primary" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : myLogs.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="size-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">You haven&apos;t logged any time yet.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    myLogs.map((log) => (
                      <TableRow key={log.id} className="border-border hover:bg-muted/50">
                        <TableCell className="text-sm text-foreground whitespace-nowrap">
                          {new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm">{log.task?.title || 'General / Unassigned'}</span>
                            {log.task?.project && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                {log.task.project.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={log.description}>
                          {log.description || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium text-foreground">
                          {log.hours_logged}h
                        </TableCell>
                        <TableCell>
                          {log.is_billable ? (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                            {row.variance > 0 ? (
                              <span className="flex items-center gap-1 text-orange-600 text-sm font-medium" title="Unlogged time">
                                <AlertCircle className="size-3.5" /> -{row.variance}h
                              </span>
                            ) : row.variance < 0 ? (
                              <span className="text-emerald-600 text-sm font-medium">
                                +{Math.abs(row.variance)}h
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
