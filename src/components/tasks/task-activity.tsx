'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TaskActivityProps {
  taskId: string;
}

export function TaskActivity({ taskId }: TaskActivityProps) {
  const supabase = createClient();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);

    const { data: rawData, error } = await supabase
      .from('task_activity')
      .select(`id, action, details, created_at, member:workspace_members!task_activity_workspace_member_id_fkey ( id, user_id )`)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (!error && rawData && rawData.length > 0) {
      const userIds = rawData.map((a: any) => a.member?.user_id).filter(Boolean);
      const profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds);
        (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }
      setActivities(rawData.map((a: any) => ({
        ...a,
        member: a.member ? { ...a.member, profiles: profileMap[a.member.user_id] || null } : null,
      })));
    } else if (!error) {
      setActivities([]);
    }
    setLoading(false);
  }, [supabase, taskId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const renderActionText = (action: string, details: any, memberName: string) => {
    switch (action) {
      case 'STATUS_CHANGED':
        return (
          <span>
            <span className="font-medium text-foreground">{memberName}</span> changed status from{' '}
            <span className="font-medium">{details?.old?.replace('_', ' ')}</span> to{' '}
            <span className="font-medium">{details?.new?.replace('_', ' ')}</span>
          </span>
        );
      case 'PRIORITY_CHANGED':
        return (
          <span>
            <span className="font-medium text-foreground">{memberName}</span> changed priority from{' '}
            <span className="font-medium">{details?.old}</span> to{' '}
            <span className="font-medium">{details?.new}</span>
          </span>
        );
      case 'ASSIGNEE_CHANGED':
        return (
          <span>
            <span className="font-medium text-foreground">{memberName}</span> updated the assignee.
          </span>
        );
      case 'COLUMN_CHANGED':
        return (
          <span>
            <span className="font-medium text-foreground">{memberName}</span> moved the task to a new column.
          </span>
        );
      default:
        return (
          <span>
            <span className="font-medium text-foreground">{memberName}</span> performed action: {action}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="size-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative space-y-4 pl-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {activities.map((activity) => {
          const profile = Array.isArray(activity.member?.profiles)
            ? activity.member.profiles[0]
            : activity.member?.profiles;
            
          const memberName = profile?.full_name || 'System / User';

          return (
            <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center size-6 rounded-full border border-border bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 -ml-3 md:ml-0 z-10">
                <Avatar className="size-5">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-[8px]">{memberName.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-card border border-border p-3 rounded-md shadow-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {renderActionText(activity.action, activity.details, memberName)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
