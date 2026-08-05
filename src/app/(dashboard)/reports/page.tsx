'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckSquare, 
  Loader2, 
  TrendingUp, 
  FileDown 
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, endOfMonth, format } from 'date-fns';

type EmployeeStats = {
  id: string;
  name: string;
  avatar: string | null;
  designation: string;
  totalTasks: number;
  completedTasks: number;
  loggedHours: number;
  daysPresent: number;
  expectedDays: number;
};

export default function ReportsDashboard() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage');

  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  
  // Aggregate KPIs
  const [totalHours, setTotalHours] = useState(0);
  const [overallAttendance, setOverallAttendance] = useState(0);
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0);

  const fetchReports = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      // 1. Fetch workspace members
      const { data: rawMembers } = await supabase
        .from('workspace_members')
        .select('id, user_id')
        .eq('workspace_id', activeWorkspace.id);

      const members = rawMembers || [];

      // 2. Fetch employee_profiles
      const { data: empProfiles } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id, designation_id, status')
        .eq('workspace_id', activeWorkspace.id);

      const empProfileMap = new Map((empProfiles || []).map((e: any) => [e.workspace_member_id, e]));

      // 3. Fetch designations
      const { data: desigRows } = await supabase
        .from('designations')
        .select('id, title')
        .eq('workspace_id', activeWorkspace.id);
      const designationById: Record<string, string> = {};
      (desigRows || []).forEach((d) => { designationById[d.id] = d.title; });

      // 4. Two-step profile enrichment
      const userIds = members.map((m: any) => m.user_id).filter(Boolean);
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);
        profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      }

      const startDate = startOfMonth(new Date()).toISOString();
      const endDate = endOfMonth(new Date()).toISOString();

      // 5. Fetch Tasks (safe query)
      // `tasks` has no `status` column — completion lives in
      // project_statuses.category via status_id. Selecting `status` errored,
      // so `tasks` was null and every "tasks completed" figure read zero.
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, assigned_workspace_member_id, status:project_statuses(category)')
        .eq('workspace_id', activeWorkspace.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // 6. Fetch Timesheets / Time Logs (safe query)
      // `time_logs` has no `status` column — approval is the boolean
      // `approved`. Filtering on `status` errored, so `timesheets` came back
      // null and every timesheet figure below silently read as zero.
      const { data: timesheets } = await supabase
        .from('time_logs')
        .select('workspace_member_id, duration')
        .eq('workspace_id', activeWorkspace.id)
        .gte('log_date', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
        .lte('log_date', format(endOfMonth(new Date()), 'yyyy-MM-dd'))
        .eq('approved', true);

      // 7. Fetch Attendance (safe query)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('workspace_member_id, status')
        .eq('workspace_id', activeWorkspace.id)
        .gte('attendance_date', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
        .lte('attendance_date', format(endOfMonth(new Date()), 'yyyy-MM-dd'));

      // Calculate working days in current month so far
      let expectedDays = 0;
      const d = startOfMonth(new Date());
      const today = new Date();
      while (d <= today && d <= endOfMonth(new Date())) {
        if (d.getDay() !== 0 && d.getDay() !== 6) expectedDays++;
        d.setDate(d.getDate() + 1);
      }
      if (expectedDays === 0) expectedDays = 1;

      // Aggregate data per employee
      let totalH = 0;
      let totalCT = 0;
      let totalAtt = 0;
      let totalEmp = 0;

      const aggregated: EmployeeStats[] = members.map((mem: any) => {
        const profile = profileMap.get(mem.user_id);
        const empProfile = empProfileMap.get(mem.id);
        
        // Tasks
        const memTasks = (tasks || []).filter(t => t.assigned_workspace_member_id === mem.id);
        const compTasks = memTasks.filter(
          (t) => (t.status as { category?: string } | null)?.category === 'DONE'
        ).length;
        totalCT += compTasks;

        // Hours
        const memTimesheets = (timesheets || []).filter(t => t.workspace_member_id === mem.id);
        const logHours = memTimesheets.reduce((acc, curr) => acc + Number(curr.duration || 0), 0);
        totalH += logHours;

        // Attendance
        const memAtt = (attendance || []).filter(t => t.workspace_member_id === mem.id);
        const presentDays = memAtt.filter(a => a.status === 'Present' || a.status === 'Remote' || a.status === 'Half-Day' || a.status === 'Late').length;
        
        totalAtt += presentDays;
        totalEmp++;

        const name = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Employee';

        return {
          id: mem.id,
          name,
          avatar: profile?.avatar_url || null,
          designation: designationById[empProfile?.designation_id || ''] || 'Employee',
          totalTasks: memTasks.length,
          completedTasks: compTasks,
          loggedHours: logHours,
          daysPresent: presentDays,
          expectedDays
        };
      });

      setStats(aggregated);
      setTotalHours(totalH);
      setTotalCompletedTasks(totalCT);
      setOverallAttendance(totalEmp > 0 ? (totalAtt / (expectedDays * totalEmp)) * 100 : 0);

    } catch (err: any) {
      console.error('Error loading reports:', err);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (!canManagePeople) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <BarChart3 className="size-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need people management permissions to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Performance Reports" 
        description="Company-wide operational pulse and employee performance metrics for this month."
        action={
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() => {
              const header = 'Name,Attendance %,Days Present,Expected Days,Logged Hours,Tasks Completed,Total Tasks';
              const rows = stats.map((e) =>
                [
                  `"${e.name.replace(/"/g, '""')}"`,
                  e.expectedDays > 0 ? ((e.daysPresent / e.expectedDays) * 100).toFixed(1) : '0',
                  e.daysPresent, e.expectedDays, e.loggedHours.toFixed(1),
                  e.completedTasks, e.totalTasks,
                ].join(',')
              );
              const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `hr-monthly-summary-${new Date().toISOString().slice(0, 7)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <FileDown className="size-4 mr-2" />
            Export Monthly Summary
          </Button>
        }
      />

      {/* Top Level KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Attendance Rate</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="size-4 animate-spin" /> : `${overallAttendance.toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="size-3 mr-1 text-emerald-500" />
              For current month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logged Hours</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="size-4 animate-spin" /> : totalHours.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Via approved timesheets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="size-4 animate-spin" /> : totalCompletedTasks}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Across all active projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/20">
              <TableHead className="text-muted-foreground">Employee</TableHead>
              <TableHead className="text-muted-foreground text-center">Attendance %</TableHead>
              <TableHead className="text-muted-foreground text-center">Hours Logged</TableHead>
              <TableHead className="text-muted-foreground text-center">Task Completion</TableHead>
              <TableHead className="text-muted-foreground w-[150px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Calculating metrics...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : stats.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No active employees found for this period.</p>
                </TableCell>
              </TableRow>
            ) : (
              stats.map((employee) => {
                const attPercent = employee.expectedDays > 0 
                  ? ((employee.daysPresent / employee.expectedDays) * 100) 
                  : 0;
                  
                const taskPercent = employee.totalTasks > 0
                  ? Math.round((employee.completedTasks / employee.totalTasks) * 100)
                  : 0;

                return (
                  <TableRow key={employee.id} className="border-border hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 border border-border">
                          {employee.avatar && <AvatarImage src={employee.avatar} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {employee.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{employee.name}</span>
                          <span className="text-xs text-muted-foreground">{employee.designation}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-foreground">{attPercent.toFixed(1)}%</span>
                        <span className="text-[10px] text-muted-foreground">{employee.daysPresent} / {employee.expectedDays} days</span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono bg-blue-500/10 text-blue-600 border-none">
                        {employee.loggedHours.toFixed(1)}h
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="w-full max-w-[120px] mx-auto flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full" 
                            style={{ width: `${taskPercent}%` }} 
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-8 text-right">
                          {employee.completedTasks}/{employee.totalTasks}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => router.push(`/employees/${employee.id}`)}>
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
