'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, Activity, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { addDays, endOfDay, isAfter, isBefore, parseISO, startOfDay, addMonths } from 'date-fns';

import { formatMemberName } from '@/components/tasks/task-form';

type TimeHorizon = '7' | '14' | '30' | '90';

export default function WorkloadsPage() {
  const { activeWorkspace } = useWorkspace();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<TimeHorizon>('7');
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const fetchGlobalWorkload = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      // 1. Fetch all members via API & workspace_members with capacity
      const [membersRes, { data: rawMembers, error: membersError }] = await Promise.all([
        fetch(`/api/account/members?workspace_id=${activeWorkspace.id}`).then(r => r.json()).catch(() => ({ members: [] })),
        supabase
          .from('workspace_members')
          .select('id, user_id, weekly_capacity')
          .eq('workspace_id', activeWorkspace.id)
      ]);

      if (membersError) throw membersError;

      const loadedMembers = membersRes?.members || [];
      const memberMapById = Object.fromEntries(loadedMembers.map((m: any) => [m.id, m]));

      const members: any[] = (rawMembers || []).map((m: any) => {
        const enriched = memberMapById[m.id] || m;
        return {
          ...m,
          displayName: formatMemberName(enriched),
          avatar: enriched.avatar_url || enriched.profiles?.avatar_url
        };
      });

      // 2. Fetch all active tasks across all projects
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          estimated_hours,
          start_date,
          due_date,
          assigned_workspace_member_id,
          project_id,
          projects ( name )
        `)
        .eq('workspace_id', activeWorkspace.id)
        .is('completed_at', null)
        .not('assigned_workspace_member_id', 'is', null);

      if (tasksError) throw tasksError;

      // Calculate dates
      const today = startOfDay(new Date());
      const endHorizon = endOfDay(addDays(today, parseInt(horizon) - 1));

      const memberMap = new Map<string, any>();

      // Initialize map
      members?.forEach(m => {
        // Default capacity to 40 if not set. Calculate capacity for the chosen horizon.
        // Formula: (Weekly Capacity / 5 working days) * horizon days
        const baseWeekly = m.weekly_capacity || 40;
        const dailyCapacity = baseWeekly / 5;
        // Approximation: assume 5/7 of the horizon days are working days
        const workingDays = Math.floor(parseInt(horizon) * (5/7));
        const totalCapacity = dailyCapacity * (workingDays > 0 ? workingDays : 1);

        memberMap.set(m.id, {
          id: m.id,
          name: m.displayName || 'Team Member',
          avatar: m.avatar,
          capacity: totalCapacity,
          assignedHours: 0,
          utilization: 0,
          tasks: []
        });
      });

      // Filter tasks by horizon and assign hours
      tasks?.forEach(task => {
        if (!task.assigned_workspace_member_id || !memberMap.has(task.assigned_workspace_member_id)) return;
        if (!task.estimated_hours || task.estimated_hours <= 0) return;

        // If task has no dates, assume it's ongoing and count it? Let's count it to be safe, 
        // or strictly filter. We will strictly filter if it has dates.
        if (task.start_date || task.due_date) {
          const start = task.start_date ? parseISO(task.start_date) : today;
          const end = task.due_date ? parseISO(task.due_date) : addMonths(today, 1);
          
          // Check intersection with our horizon window
          if (isAfter(start, endHorizon) || isBefore(end, today)) {
             return; // Task is completely outside the window
          }
        }

        const data = memberMap.get(task.assigned_workspace_member_id);
        data.assignedHours += Number(task.estimated_hours);
        data.tasks.push(task);
      });

      // Calculate utilization
      const processed = Array.from(memberMap.values()).map(m => {
        m.utilization = Math.round((m.assignedHours / m.capacity) * 100);
        return m;
      }).sort((a, b) => b.utilization - a.utilization); // Sort by most overloaded

      setWorkloadData(processed);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, horizon, supabase]);

  useEffect(() => {
    fetchGlobalWorkload();
  }, [fetchGlobalWorkload]);

  const toggleUser = (id: string) => {
    setExpandedUsers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 90) return 'bg-orange-500';
    if (utilization > 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Global Workload</h1>
          <p className="text-muted-foreground text-sm">Analyze team capacity and task distribution across all projects.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Time Horizon:</span>
          <Select value={horizon} onValueChange={(val) => setHorizon(val as TimeHorizon)}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Next 7 Days</SelectItem>
              <SelectItem value="14">Next 14 Days</SelectItem>
              <SelectItem value="30">Next 30 Days</SelectItem>
              <SelectItem value="90">Next 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {workloadData.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed rounded-lg">
            <Activity className="size-8 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No active members or tasks found.</p>
          </div>
        ) : (
          workloadData.map(member => (
            <Card key={member.id} className="overflow-hidden shadow-sm">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleUser(member.id)}
              >
                <div className="flex items-center gap-4 w-1/3">
                  {expandedUsers[member.id] ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                  <Avatar className="size-10 border">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{member.name}</span>
                </div>
                
                <div className="w-1/2 px-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span>{member.utilization}% Utilized</span>
                      <span className="text-muted-foreground">{member.assignedHours}h / {member.capacity}h</span>
                    </div>
                    {/* Custom progress bar to inject specific color */}
                    <div className="h-2.5 w-full bg-secondary overflow-hidden rounded-full">
                      <div 
                        className={`h-full transition-all duration-500 ease-in-out ${getUtilizationColor(member.utilization)}`}
                        style={{ width: `${Math.min(member.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="w-1/6 text-right">
                  <Badge variant="outline" className="font-medium">
                    {member.tasks.length} Active Tasks
                  </Badge>
                </div>
              </div>

              {expandedUsers[member.id] && (
                <div className="bg-muted/10 border-t p-4 px-12">
                  {member.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No tasks assigned in this horizon.</p>
                  ) : (
                    <div className="space-y-3">
                      {member.tasks.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-sm bg-background border p-2 rounded-none shadow-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">{t.title}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Briefcase className="size-3" />
                              {Array.isArray(t.projects) ? t.projects[0]?.name : t.projects?.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-primary">{t.estimated_hours}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
