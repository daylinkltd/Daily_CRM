'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface TeamWorkloadProps {
  projectId: string;
}

export function TeamWorkload({ projectId }: TeamWorkloadProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [workloadData, setWorkloadData] = useState<any[]>([]);

  const fetchWorkloadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // Fetch open tasks for this project with their assignees
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          estimated_hours,
          assigned_workspace_member_id,
          status_id,
          assignee:workspace_members!tasks_assigned_workspace_member_id_fkey (
            id,
            profiles:user_id ( full_name, avatar_url )
          )
        `)
        .eq('project_id', projectId)
        .is('completed_at', null) // Only active/open tasks
        .not('assigned_workspace_member_id', 'is', null);

      if (error) throw error;

      // Group by assignee
      const workloadMap = new Map<string, any>();

      tasks?.forEach(task => {
        const assignee = task.assignee as any;
        if (!assignee || !assignee.id) return;

        const memberId = assignee.id;
        const profile = assignee.profiles;
        
        if (!workloadMap.has(memberId)) {
          workloadMap.set(memberId, {
            id: memberId,
            name: profile?.full_name || 'Unknown User',
            avatar: profile?.avatar_url,
            taskCount: 0,
            totalHours: 0
          });
        }

        const data = workloadMap.get(memberId);
        data.taskCount += 1;
        data.totalHours += Number(task.estimated_hours || 0);
      });

      const processedData = Array.from(workloadMap.values()).sort((a, b) => b.totalHours - a.totalHours);
      setWorkloadData(processedData);

    } catch (error) {
      console.error('Error fetching workload data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchWorkloadData();
  }, [fetchWorkloadData]);

  if (loading) {
    return (
      <Card className="h-80 flex items-center justify-center border-border shadow-sm">
        <Loader2 className="size-6 animate-spin text-primary" />
      </Card>
    );
  }

  if (workloadData.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Team Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-10">
            No active tasks assigned to team members.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Find max hours to calculate percentage bars safely
  const maxHours = Math.max(...workloadData.map(d => d.totalHours), 1);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Active Team Workload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {workloadData.map(member => (
          <div key={member.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="size-6 border">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {member.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.name}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground text-xs font-medium">
                <span>{member.taskCount} tasks</span>
                <span className="text-foreground">{member.totalHours} hrs</span>
              </div>
            </div>
            <Progress value={(member.totalHours / maxHours) * 100} className="h-2 bg-secondary" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
