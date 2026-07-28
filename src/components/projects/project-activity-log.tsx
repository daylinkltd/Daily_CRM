'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Activity, CheckCircle2, Clock, PlusCircle, Layers, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { formatMemberName } from '@/components/tasks/task-form';

interface ProjectActivityLogProps {
  projectId: string;
}

export function ProjectActivityLog({ projectId }: ProjectActivityLogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  const fetchActivityLog = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // 1. Fetch recent tasks created/updated in this project
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id, title, task_type, priority, created_at,
          assigned_workspace_member_id,
          status:project_statuses ( name, category )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(30);

      // 2. Fetch epics in this project
      const { data: epics } = await supabase
        .from('epics')
        .select('id, title, created_at, status')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      // 3. Fetch members to resolve user details
      const membersRes = await fetch('/api/account/members')
        .then(r => r.json())
        .catch(() => ({ members: [] }));
      const members = membersRes?.members || [];
      const memberMap = Object.fromEntries(members.map((m: any) => [m.id, m]));

      // 4. Transform into unified activity items
      const items: any[] = [];

      (tasks || []).forEach(task => {
        const member = memberMap[task.assigned_workspace_member_id];
        const statusObj = Array.isArray(task.status) ? task.status[0] : task.status;
        items.push({
          id: `task-${task.id}`,
          type: 'TASK_CREATED',
          title: `Created task "${task.title}"`,
          itemTitle: task.title,
          badge: task.task_type || 'TASK',
          statusName: statusObj?.name || 'To Do',
          timestamp: new Date(task.created_at),
          user: member ? formatMemberName(member) : 'Team Member',
          avatar: member?.avatar_url,
          icon: PlusCircle,
          iconColor: 'text-blue-500 bg-blue-500/10'
        });
      });

      (epics || []).forEach(epic => {
        items.push({
          id: `epic-${epic.id}`,
          type: 'EPIC_CREATED',
          title: `Created epic "${epic.title}"`,
          itemTitle: epic.title,
          badge: 'EPIC',
          statusName: epic.status || 'IN_PROGRESS',
          timestamp: new Date(epic.created_at),
          user: 'Project Lead',
          avatar: null,
          icon: Layers,
          iconColor: 'text-purple-500 bg-purple-500/10'
        });
      });

      // Sort chronologically
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setActivities(items);
    } catch (err) {
      console.error('Failed to load project activity:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchActivityLog();
  }, [fetchActivityLog]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Activity className="size-8 mx-auto text-muted-foreground mb-3 opacity-50" />
        <h3 className="font-semibold text-foreground">No recent activity</h3>
        <p className="text-sm text-muted-foreground mt-1">Actions and updates performed on this project will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h3 className="font-semibold text-foreground text-base">Project Audit Log & Activity Stream</h3>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          {activities.length} Events Logged
        </Badge>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
        {activities.map((act) => {
          const IconComp = act.icon;
          return (
            <div key={act.id} className="relative flex items-start gap-4 group">
              <div className={`absolute -left-6 top-0.5 size-5 rounded-full flex items-center justify-center border bg-background ${act.iconColor}`}>
                <IconComp className="size-3" />
              </div>

              <div className="flex-1 bg-muted/20 hover:bg-muted/40 p-3.5 rounded-lg border border-border/60 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarImage src={act.avatar} />
                      <AvatarFallback className="text-[9px]">{act.user?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{act.user}</span>
                    <span className="text-xs text-muted-foreground">{act.title}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(act.timestamp, { addSuffix: true })}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-semibold">
                    {act.badge}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {act.statusName}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
