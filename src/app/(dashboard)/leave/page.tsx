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
import { Search, Loader2, Umbrella, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { assertAffected } from '@/lib/supabase/affected-rows';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { IconAction } from "@/components/ui/icon-action";

export default function LeavePage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canApproveLeave = can('leave_approve') || can('people_manage'); 

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const fetchLeaveRequests = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        workspace_members!leave_requests_workspace_member_id_fkey ( id, user_id ),
        approver:workspace_members!leave_requests_approved_by_fkey ( id, user_id )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false });

    if (!canApproveLeave) {
      query = query.eq('workspace_member_id', activeMember.id);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      // Two-step profile enrichment for both member and approver user_ids
      const allUserIds = [
        ...data.map((r: any) => r.workspace_members?.user_id),
        ...data.map((r: any) => r.approver?.user_id)
      ].filter(Boolean);
      const uniqueUserIds = [...new Set(allUserIds)];
      const profileMap: Record<string, any> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', uniqueUserIds);
        (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }
      data.forEach((r: any) => {
        if (r.workspace_members?.user_id) r.workspace_members.profiles = profileMap[r.workspace_members.user_id] || null;
        if (r.approver?.user_id) r.approver.profiles = profileMap[r.approver.user_id] || null;
      });
    }


    if (error) {
      toast.error('Failed to load leave requests');
    } else {
      let filtered = data || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(r => {
          const profile = Array.isArray(r.workspace_members?.profiles) 
            ? r.workspace_members?.profiles[0] 
            : r.workspace_members?.profiles;
          return profile?.full_name?.toLowerCase().includes(q) || r.leave_type?.toLowerCase().includes(q);
        });
      }
      setRequests(filtered);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, activeMember?.id, canApproveLeave, search]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  const [actionLoadingId, setActionLoadingId] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!activeMember?.id) return;
    setActionLoadingId({ id, action: status });
    try {
      const result = await supabase
        .from('leave_requests')
        .update({
          status,
          approved_by: activeMember.id
        })
        .eq('id', id)
        .select('id');

      assertAffected(result, 'the leave request');
      toast.success(`Leave request ${status === 'approved' ? 'approved' : 'rejected'}`);
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="size-3.5 text-emerald-500" /> Approved
        </Badge>
      );
    }
    if (s === 'rejected') {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-semibold px-2.5 py-0.5 rounded-full">
          <XCircle className="size-3.5 text-red-500" /> Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold px-2.5 py-0.5 rounded-full">
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Leave Management" 
        description={canApproveLeave ? "Review and manage team leave requests." : "Track your time off and submit new requests."}
        action={
          <IconAction label="Request Leave" icon={<Plus className="size-4 " />} onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" />
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={canApproveLeave ? "Search by employee name or leave type..." : "Search leave types..."}
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {canApproveLeave && <TableHead className="text-muted-foreground">Employee</TableHead>}
              <TableHead className="text-muted-foreground">Leave Type</TableHead>
              <TableHead className="text-muted-foreground">Dates</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Reason</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right pr-6">{canApproveLeave ? "Actions" : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={canApproveLeave ? 6 : 5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading leave requests...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={canApproveLeave ? 6 : 5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Umbrella className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No leave requests found.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((record) => {
                const profile = Array.isArray(record.workspace_members?.profiles) 
                  ? record.workspace_members?.profiles[0] 
                  : record.workspace_members?.profiles;
                const fullName = profile?.full_name || 'Unknown User';

                const from = new Date(record.from_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const to = new Date(record.to_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const dateStr = from === to ? from : `${from} - ${to}`;
                const isPending = (record.status || 'pending').toLowerCase() === 'pending';
                const isRowLoading = actionLoadingId?.id === record.id;

                return (
                  <TableRow key={record.id} className="border-border hover:bg-muted/50 transition-colors">
                    {canApproveLeave && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7 border border-border">
                            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {fullName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">{fullName}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-foreground">
                      {record.leave_type}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateStr}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell truncate max-w-[200px]" title={record.reason}>
                      {record.reason || '-'}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(record.status)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {canApproveLeave && isPending ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(record.id, 'approved')}
                            disabled={isRowLoading}
                            className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm gap-1.5 transition-all rounded-lg"
                          >
                            {isRowLoading && actionLoadingId?.action === 'approved' ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(record.id, 'rejected')}
                            disabled={isRowLoading}
                            className="h-8 px-3 text-xs font-semibold border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 active:scale-95 shadow-xs gap-1.5 transition-all rounded-lg"
                          >
                            {isRowLoading && actionLoadingId?.action === 'rejected' ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">
                          {record.approver?.profiles?.full_name ? `By ${record.approver.profiles.full_name}` : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LeaveRequestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={fetchLeaveRequests}
      />
    </div>
  );
}
