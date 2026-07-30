'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle, AlertCircle, Banknote } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface ProjectTimesheetProps {
  projectId: string;
}

export function ProjectTimesheet({ projectId }: ProjectTimesheetProps) {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Summary Stats
  const [totalActual, setTotalActual] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [totalBillable, setTotalBillable] = useState(0);
  const [totalNonBillable, setTotalNonBillable] = useState(0);

  const fetchTimesheetData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // 1. Fetch all tasks for the project to get total estimated hours
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, estimated_hours')
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;
      
      const estimated = tasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0);
      setTotalEstimated(estimated);

      // 2. Fetch all time logs for these tasks
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      const { data: rawTimeLogs, error: logsError } = await supabase
        .from('time_logs')
        .select(`id, duration, log_date, billable, description, tasks:task_id ( title ), workspace_members:workspace_member_id ( id, user_id )`)
        .in('task_id', taskIds)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      // Two-step: enrich workspace_members with profile data
      let timeLogs: any[] = rawTimeLogs || [];
      if (timeLogs.length > 0) {
        const userIds = timeLogs.map((l: any) => l.workspace_members?.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
          const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
          timeLogs = timeLogs.map((l: any) => ({
            ...l,
            workspace_members: l.workspace_members ? { ...l.workspace_members, profiles: profileMap[l.workspace_members.user_id] || null } : null,
          }));
        }
      }

      setLogs(timeLogs);

      // Calculate totals
      let actual = 0;
      let billable = 0;
      let nonBillable = 0;

      timeLogs?.forEach(log => {
        const dur = Number(log.duration || 0);
        actual += dur;
        if (log.billable) billable += dur;
        else nonBillable += dur;
      });

      setTotalActual(actual);
      setTotalBillable(billable);
      setTotalNonBillable(nonBillable);

    } catch (error) {
      console.error('Error fetching timesheet:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchTimesheetData();
  }, [fetchTimesheetData]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const isOverBudget = totalActual > totalEstimated && totalEstimated > 0;

  return (
    <div className="space-y-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <Clock className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Estimated</p>
            <p className="text-2xl font-bold">{totalEstimated.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </CardContent>
        </Card>
        
        <Card className={`border-border shadow-sm ${isOverBudget ? 'border-destructive/50 bg-destructive/5' : ''}`}>
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            {isOverBudget ? <AlertCircle className="size-5 text-destructive" /> : <CheckCircle className="size-5 text-emerald-500" />}
            <p className="text-sm font-medium text-muted-foreground">Actual</p>
            <p className={`text-2xl font-bold ${isOverBudget ? 'text-destructive' : ''}`}>{totalActual.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <Banknote className="size-5 text-blue-500" />
            <p className="text-sm font-medium text-muted-foreground">Billable</p>
            <p className="text-2xl font-bold text-blue-600">{totalBillable.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <Clock className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Non-Billable</p>
            <p className="text-2xl font-bold text-muted-foreground">{totalNonBillable.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No time has been logged on this project yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Team Member</th>
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Hours</th>
                    <th className="px-4 py-3 font-medium text-center">Billable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const profile = log.workspace_members?.profiles;
                    const memberName = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
                    const taskTitle = Array.isArray(log.tasks) ? log.tasks[0]?.title : log.tasks?.title;
                    
                    return (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{format(parseISO(log.log_date), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 font-medium">{memberName || 'Unknown'}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={taskTitle}>{taskTitle || 'Deleted Task'}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate" title={log.description || ''}>{log.description || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">{log.duration}</td>
                        <td className="px-4 py-3 text-center">
                          {log.billable ? (
                            <Badge variant="outline" className="text-[10px] uppercase bg-primary/10 text-primary border-primary/20">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">No</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
