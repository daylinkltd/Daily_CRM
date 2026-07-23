'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, CalendarClock, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { PunchAction } from '@/components/attendance/punch-action';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function AttendancePage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManageAttendance = can('attendance_manage' as any); 

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAttendance = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    let query = supabase
      .from('attendance')
      .select(`
        *,
        workspace_members!inner (
          profiles:user_id ( full_name, avatar_url )
        )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .order('attendance_date', { ascending: false })
      .order('punch_in_time', { ascending: false });

    // If they aren't an admin, they only see their own attendance
    if (!canManageAttendance) {
      query = query.eq('workspace_member_id', activeMember.id);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load attendance');
    } else {
      let filtered = data || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(r => {
          const profile = Array.isArray(r.workspace_members?.profiles) 
            ? r.workspace_members?.profiles[0] 
            : r.workspace_members?.profiles;
          return profile?.full_name?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q);
        });
      }
      setRecords(filtered);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, activeMember?.id, canManageAttendance, search]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      case 'Late': return 'bg-orange-500/15 text-orange-700 border-orange-200';
      case 'Absent': return 'bg-red-500/15 text-red-700 border-red-200';
      case 'Remote': return 'bg-blue-500/15 text-blue-700 border-blue-200';
      default: return 'bg-slate-500/15 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance" 
        description={canManageAttendance ? "Monitor team attendance, locations, and working hours." : "View and manage your daily attendance logs."}
        action={<PunchAction onPunch={fetchAttendance} />}
      />

      {canManageAttendance && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name..."
              className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Date</TableHead>
              {canManageAttendance && <TableHead className="text-muted-foreground">Employee</TableHead>}
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Punch In</TableHead>
              <TableHead className="text-muted-foreground">Punch Out</TableHead>
              <TableHead className="text-muted-foreground">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={canManageAttendance ? 6 : 5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading attendance logs...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={canManageAttendance ? 6 : 5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarClock className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No attendance records found.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => {
                const profile = Array.isArray(record.workspace_members?.profiles) 
                  ? record.workspace_members?.profiles[0] 
                  : record.workspace_members?.profiles;
                const fullName = profile?.full_name || 'Unknown User';

                return (
                  <TableRow key={record.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      {new Date(record.attendance_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </TableCell>
                    {canManageAttendance && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6 border border-border">
                            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                              {fullName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{fullName}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(record.status || 'Present')}>
                        {record.status || 'Present'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.punch_in_time ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {record.punch_in_location && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1" title="GPS Location recorded">
                              <MapPin className="size-3" />
                              Logged
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.punch_out_time ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {record.punch_out_location && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1" title="GPS Location recorded">
                              <MapPin className="size-3" />
                              Logged
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {record.working_hours ? `${record.working_hours}h` : '-'}
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
