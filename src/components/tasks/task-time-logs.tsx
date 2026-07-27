'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TaskTimeLogsProps {
  taskId: string;
}

export function TaskTimeLogs({ taskId }: TaskTimeLogsProps) {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    
    const { data: rawData, error } = await supabase
      .from('time_logs')
      .select(`id, duration, log_date, billable, description, workspace_member_id, workspace_members:workspace_member_id ( id, user_id )`)
      .eq('task_id', taskId)
      .order('log_date', { ascending: false });

    if (!error && rawData && rawData.length > 0) {
      const userIds = rawData.map((l: any) => l.workspace_members?.user_id).filter(Boolean);
      const profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }
      setLogs(rawData.map((l: any) => ({
        ...l,
        workspace_members: l.workspace_members ? { ...l.workspace_members, profiles: profileMap[l.workspace_members.user_id] || null } : null,
      })));
    } else if (!error) {
      setLogs([]);
    }
    setLoading(false);
  }, [taskId, supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  if (logs.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">No time logged for this task yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md divide-y bg-card overflow-hidden">
        {logs.map(log => {
          const profile = log.workspace_members?.profiles;
          const memberName = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

          return (
            <div key={log.id} className="p-3 text-sm grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
              <div>
                <span className="font-medium">{memberName || 'Unknown'}</span>
                <p className="text-xs text-muted-foreground">{format(parseISO(log.log_date), 'MMM d, yyyy')}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">{log.description || 'No description'}</span>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-medium">{log.duration} hrs</span>
                {log.billable && <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">Billable</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
