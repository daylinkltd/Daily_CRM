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
import { 
  Search, 
  Loader2, 
  CalendarClock, 
  MapPin, 
  Building2, 
  Home, 
  Briefcase, 
  FileCheck2, 
  Clock,
  Plus,
  Pencil
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PunchAction } from '@/components/attendance/punch-action';
import { AttendanceRequestModal } from '@/components/attendance/request-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LocationMapModal } from '@/components/attendance/location-map-modal';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';
import { IconAction } from "@/components/ui/icon-action";
import {
  AttendanceEditModal,
  type AttendanceEditRow,
  type MemberOption,
} from '@/components/attendance/attendance-edit-modal';

export default function AttendancePage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManageAttendance = can('attendance_manage'); 

  const [activeTab, setActiveTab] = useState<'LOGS' | 'APPROVALS' | 'ANALYTICS'>('LOGS');
  const [records, setRecords] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  // HR logging/correcting a record by hand. `null` record = create.
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceEditRow | null>(null);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);

  // Leaflet Location Map Modal State
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedLocationMap, setSelectedLocationMap] = useState<{
    location: any;
    title: string;
    employeeName: string;
    timestamp: string;
    workLocation: string;
    deviceInfo: any;
    ipAddress: string | null;
  } | null>(null);

  // Takes an options object rather than positional arguments: the device
  // and IP fields brought it to seven, at which point call sites become
  // unreadable and easy to mis-order.
  const openMapModal = (opts: {
    location: any;
    title: string;
    employeeName: string;
    timestamp: string;
    workLocation: string;
    deviceInfo?: any;
    ipAddress?: string | null;
  }) => {
    setSelectedLocationMap({
      location: opts.location,
      title: opts.title,
      employeeName: opts.employeeName,
      timestamp: opts.timestamp,
      workLocation: opts.workLocation,
      deviceInfo: opts.deviceInfo ?? null,
      ipAddress: opts.ipAddress ?? null,
    });
    setMapModalOpen(true);
  };

  // Analytics Metrics
  const [totalWorkingHours, setTotalWorkingHours] = useState(0);
  const [totalNetProductive, setTotalNetProductive] = useState(0);
  const [totalOvertimeHours, setTotalOvertimeHours] = useState(0);
  const [lateCount, setLateCount] = useState(0);

  const fetchAttendanceData = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Attendance Logs.
      // NOTE: workspace_members.user_id references auth.users, so a
      // PostgREST `workspace_members(profiles(...))` embed is
      // impossible — names are enriched with an explicit two-step
      // fetch (members, then profiles by user_id), like the
      // Employees page does.
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('attendance_date', { ascending: false });

      if (!canManageAttendance) {
        query = query.eq('workspace_member_id', activeMember.id);
      }

       
      const { data: rawData, error } = await query;
      if (error) throw error;

      const { data: members } = await supabase
        .from('workspace_members')
        .select('id, user_id, role')
        .eq('workspace_id', activeWorkspace.id);
      const userIds = (members || []).map((m) => m.user_id);
      const { data: profileRows } = userIds.length
        ? await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds)
        : { data: [] as { user_id: string; full_name: string | null; avatar_url: string | null }[] };
      const profileByUser: Record<string, unknown> = {};
      (profileRows || []).forEach((p) => { profileByUser[p.user_id] = p; });
      const memberProfilesMap: Record<string, unknown> = {};
      (members || []).forEach((m) => {
        memberProfilesMap[m.id] = { ...m, profiles: profileByUser[m.user_id] || null };
      });

      // Same list the edit dialog offers, so HR can log for anyone here.
      setMemberOptions(
        (members || []).map((m) => ({
          id: m.id,
          name:
            (profileByUser[m.user_id] as { full_name?: string } | undefined)?.full_name ||
            'Team Member',
        })),
      );

      const data = (rawData || []).map((r) => ({
        ...r,
        workspace_members: memberProfilesMap[r.workspace_member_id] || null,
      }));

      const list = data || [];
      setRecords(list);

      // Compute Analytics
      let sumHours = 0;
      let sumNet = 0;
      let sumOt = 0;
      let lates = 0;

      list.forEach((r) => {
        sumHours += Number(r.working_hours || 0);
        sumNet += Number(r.net_productive_hours || r.working_hours || 0);
        sumOt += Number(r.overtime_hours || 0);
        if (r.status === 'Late') lates += 1;
      });

      setTotalWorkingHours(parseFloat(sumHours.toFixed(1)));
      setTotalNetProductive(parseFloat(sumNet.toFixed(1)));
      setTotalOvertimeHours(parseFloat(sumOt.toFixed(1)));
      setLateCount(lates);

      // 2. Fetch Regularization Requests
      let reqQuery = supabase
        .from('hr_attendance_requests')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (!canManageAttendance) {
        reqQuery = reqQuery.eq('workspace_member_id', activeMember.id);
      }

      const { data: reqData, error: reqError } = await reqQuery;
      if (reqError) throw reqError;
      setRequests(
        (reqData || []).map((r) => ({
          ...r,
          workspace_members: memberProfilesMap[r.workspace_member_id] || null,
        }))
      );
    } catch (err: any) {
      toast.error(sanitizeErrorMessage(err, 'Failed to load attendance logs'));
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id, canManageAttendance]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  const handleApprovalAction = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!activeMember?.id) return;
    try {
      const { data: request, error } = await supabase
        .from('hr_attendance_requests')
        .update({
          status,
          approved_by: activeMember.id,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // Approval APPLIES the regularization to the attendance record —
      // previously it only recoloured a badge and the record stayed
      // wrong forever.
      if (status === 'APPROVED' && request) {
        const patch: Record<string, unknown> = {};
        if (request.requested_punch_in) patch.punch_in_time = request.requested_punch_in;
        if (request.requested_punch_out) patch.punch_out_time = request.requested_punch_out;
        if (request.requested_punch_in && request.requested_punch_out) {
          patch.working_hours = (
            Math.max(
              0,
              new Date(request.requested_punch_out).getTime() -
                new Date(request.requested_punch_in).getTime()
            ) / 3600000
          ).toFixed(2);
        }
        if (Object.keys(patch).length > 0) {
          const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('workspace_member_id', request.workspace_member_id)
            .eq('attendance_date', request.attendance_date)
            .maybeSingle();
          const { error: applyError } = existing
            ? await supabase.from('attendance').update(patch).eq('id', existing.id)
            : await supabase.from('attendance').insert({
                workspace_id: request.workspace_id,
                workspace_member_id: request.workspace_member_id,
                attendance_date: request.attendance_date,
                status: 'Present',
                ...patch,
              });
          if (applyError) {
            toast.error(sanitizeErrorMessage(applyError, 'Approved, but failed to apply to the attendance record'));
          }
        }
      }

      toast.success(`Request ${status.toLowerCase()} successfully`);
      fetchAttendanceData();
    } catch (err: any) {
      toast.error(sanitizeErrorMessage(err, 'Failed to update request status'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present': return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Present</Badge>;
      case 'Late': return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Late Arrival</Badge>;
      case 'Half-Day': return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30">Half-Day</Badge>;
      case 'Remote': return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Work From Home</Badge>;
      default: return <Badge className="bg-muted text-foreground">{status || 'Present'}</Badge>;
    }
  };

  const getLocationIcon = (loc: string) => {
    if (loc === 'WFH') return <Home className="h-3.5 w-3.5 text-blue-400" />;
    if (loc === 'CLIENT_SITE') return <Briefcase className="h-3.5 w-3.5 text-purple-400" />;
    return <Building2 className="h-3.5 w-3.5 text-emerald-400" />;
  };

  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const profile = Array.isArray(r.workspace_members?.profiles) 
      ? r.workspace_members?.profiles[0] 
      : r.workspace_members?.profiles;
    return profile?.full_name?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Page Header with Punch Action & Request Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card/80 p-5 rounded-3xl border border-border backdrop-blur-xl shadow-2xl">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary" />
            Attendance &amp; Time Tracking
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Real-time punch logs, shift tracking &amp; break management.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PunchAction onPunch={fetchAttendanceData} />
          {canManageAttendance && (
            <Button
              onClick={() => { setEditRecord(null); setEditOpen(true); }}
              className="bg-primary text-primary-foreground font-bold rounded-xl h-10 gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" /> Log Attendance
            </Button>
          )}
          <Button
            onClick={() => setShowRequestModal(true)}
            variant="outline"
            className="border-border bg-background text-foreground hover:text-foreground font-bold rounded-xl h-10 gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4 text-[#00aef0]" /> Request Regularization
          </Button>
        </div>
      </div>

      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Total Logged Hours</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">{totalWorkingHours} hrs</div>
          <div className="text-[11px] text-muted-foreground mt-1">Gross working time</div>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Net Productive Hours</div>
          <div className="text-2xl font-extrabold text-[#00aef0] mt-1">{totalNetProductive} hrs</div>
          <div className="text-[11px] text-muted-foreground mt-1">Total Hours minus Break Time</div>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Approved Overtime</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{totalOvertimeHours} hrs</div>
          <div className="text-[11px] text-muted-foreground mt-1">Comp-off eligible</div>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl">
          <div className="text-xs text-muted-foreground font-medium">Late Arrivals</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">{lateCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Exceeding shift grace time</div>
        </div>
      </div>

      {/* Dynamic Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'LOGS'
                ? 'bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live Attendance Logs &amp; Breaks
          </button>
          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all relative ${
              activeTab === 'APPROVALS'
                ? 'bg-[#00aef0] text-foreground shadow-lg shadow-[#00aef0]/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manager Approvals
            {requests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-foreground font-extrabold">
                {requests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'LOGS' && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background border-border text-foreground text-xs rounded-xl"
            />
          </div>
        )}
      </div>

      {/* TAB 1: Attendance & Break Logs */}
      {activeTab === 'LOGS' && (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading Attendance Records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs">
              <CalendarClock className="h-8 w-8 text-muted-foreground mb-2" />
              <span>No attendance logs found for this period.</span>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-background/80 text-xs text-muted-foreground border-b border-border">
                <TableRow>
                  <TableHead className="py-3.5">Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Punch In</TableHead>
                  <TableHead>Punch Out</TableHead>
                  <TableHead>Break Hours</TableHead>
                  <TableHead className="text-right">Net Productive</TableHead>
                  {canManageAttendance && <TableHead className="text-right">Edit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60 text-xs">
                {filteredRecords.map((r) => {
                  const profile = Array.isArray(r.workspace_members?.profiles) 
                    ? r.workspace_members?.profiles[0] 
                    : r.workspace_members?.profiles;
                  const name = profile?.full_name || 'Team Member';
                  const avatar = profile?.avatar_url || '';

                  return (
                    <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-foreground font-bold">
                        {r.attendance_date}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={avatar} />
                            <AvatarFallback className="bg-muted text-[10px] text-foreground">
                              {name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openMapModal({
                            location: r.punch_in_location || r.punch_out_location,
                            title: `Attendance GPS Location (${r.work_location || 'OFFICE'})`,
                            employeeName: name,
                            timestamp: r.punch_in_time ? new Date(r.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.attendance_date,
                            workLocation: r.work_location || 'OFFICE',
                            deviceInfo: r.punch_in_device_json || r.punch_out_device_json,
                            ipAddress: r.punch_in_ip || r.punch_out_ip,
                          })}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-foreground hover:bg-muted/80 transition-colors font-medium text-xs border border-border/60"
                          title="Click to view Leaflet Location Map"
                        >
                          {getLocationIcon(r.work_location)}
                          <span>{r.work_location || 'OFFICE'}</span>
                          <MapPin className="h-3 w-3 text-primary ml-0.5" />
                        </button>
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell>
                        {r.punch_in_time ? (
                          <div className="flex items-center gap-1.5 font-mono text-foreground">
                            <span>{new Date(r.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button
                              type="button"
                              onClick={() => openMapModal({
                                location: r.punch_in_location,
                                title: "Punch In GPS Location",
                                employeeName: name,
                                timestamp: new Date(r.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                workLocation: r.work_location || 'OFFICE',
                                deviceInfo: r.punch_in_device_json,
                                ipAddress: r.punch_in_ip,
                              })}
                              className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                              title="View Leaflet GPS Map"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {r.punch_out_time ? (
                          <div className="flex items-center gap-1.5 font-mono text-foreground">
                            <span>{new Date(r.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button
                              type="button"
                              onClick={() => openMapModal({
                                location: r.punch_out_location,
                                title: "Punch Out GPS Location",
                                employeeName: name,
                                timestamp: new Date(r.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                workLocation: r.work_location || 'OFFICE',
                                deviceInfo: r.punch_out_device_json,
                                ipAddress: r.punch_out_ip,
                              })}
                              className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                              title="View Leaflet GPS Map"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-amber-400">
                        {r.break_hours ? `${r.break_hours} hrs` : '0 hrs'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-extrabold text-[#00aef0]">
                        {r.net_productive_hours || r.working_hours || 0} hrs
                      </TableCell>
                      {canManageAttendance && (
                        <TableCell className="text-right">
                          <IconAction
                            label="Edit attendance"
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setEditRecord({
                                id: r.id,
                                workspace_member_id: r.workspace_member_id,
                                attendance_date: r.attendance_date,
                                punch_in_time: r.punch_in_time,
                                punch_out_time: r.punch_out_time,
                                status: r.status,
                                work_location: r.work_location,
                                break_hours: r.break_hours,
                                remarks: r.remarks,
                              });
                              setEditOpen(true);
                            }}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* TAB 2: Manager Approvals Hub */}
      {activeTab === 'APPROVALS' && (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden shadow-2xl p-4">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#00aef0]" />
            Attendance Regularization &amp; Correction Requests
          </h2>

          {requests.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No regularization requests submitted yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-background/80 text-xs text-muted-foreground border-b border-border">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested Time</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageAttendance && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60 text-xs">
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-semibold text-foreground">
                      {req.workspace_members?.profiles?.full_name || 'Employee'}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-none bg-muted text-[#00aef0]">
                        {req.request_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{req.attendance_date}</TableCell>
                    <TableCell className="font-mono text-foreground">
                      {req.requested_punch_in ? new Date(req.requested_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      {' → '}
                      {req.requested_punch_out ? new Date(req.requested_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-foreground max-w-xs truncate">{req.reason}</TableCell>
                    <TableCell>
                      {req.status === 'APPROVED' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400">Approved</Badge>
                      ) : req.status === 'REJECTED' ? (
                        <Badge className="bg-rose-500/15 text-rose-400">Rejected</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-400">Pending Approval</Badge>
                      )}
                    </TableCell>
                    {canManageAttendance && (
                      <TableCell className="text-right space-x-1.5">
                        {req.status === 'PENDING' && (
                          <>
                            <Button
                              onClick={() => handleApprovalAction(req.id, 'APPROVED')}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-foreground font-bold px-2.5 rounded-lg"
                            >
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleApprovalAction(req.id, 'REJECTED')}
                              variant="destructive"
                              className="h-7 text-xs font-bold px-2.5 rounded-lg"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* HR logging or correcting a record by hand */}
      <AttendanceEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        record={editRecord}
        members={memberOptions}
        onSaved={fetchAttendanceData}
      />

      {/* Regularization Modal */}
      <AttendanceRequestModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
        onSubmitted={fetchAttendanceData}
      />

      {/* Leaflet GPS Location Map Modal */}
      <LocationMapModal
        open={mapModalOpen}
        onOpenChange={setMapModalOpen}
        location={selectedLocationMap?.location || null}
        title={selectedLocationMap?.title || "GPS Location Map"}
        employeeName={selectedLocationMap?.employeeName}
        timestamp={selectedLocationMap?.timestamp}
        workLocation={selectedLocationMap?.workLocation}
        deviceInfo={selectedLocationMap?.deviceInfo}
        ipAddress={selectedLocationMap?.ipAddress}
      />
    </div>
  );
}
