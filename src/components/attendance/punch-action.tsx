'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Fingerprint, 
  Coffee, 
  Play, 
  Clock,
  Building2,
  Home,
  Briefcase
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { TimeLogForm } from '@/components/timesheets/time-log-form';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';

export function PunchAction({ onPunch }: { onPunch: () => void }) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any | null>(null);
  const [activeBreak, setActiveBreak] = useState<any | null>(null);
  const [workLocation, setWorkLocation] = useState<'OFFICE' | 'WFH' | 'CLIENT_SITE'>('OFFICE');
  const [breakType, setBreakType] = useState<'LUNCH' | 'TEA' | 'PERSONAL' | 'MEETING'>('LUNCH');
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [lastLoggedHours, setLastLoggedHours] = useState<number | undefined>(undefined);
  
  const todayDate = new Date().toISOString().split('T')[0];

  const fetchTodayStatus = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('workspace_member_id', activeMember.id)
      .eq('attendance_date', todayDate)
      .maybeSingle();
      
    if (!error && data) {
      setTodayRecord(data);

      // Check if there is an active ongoing break
      const { data: ongoingBreak } = await supabase
        .from('hr_attendance_breaks')
        .select('*')
        .eq('attendance_id', data.id)
        .is('end_time', null)
        .maybeSingle();

      setActiveBreak(ongoingBreak || null);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id, todayDate]);

  useEffect(() => {
    fetchTodayStatus();
  }, [fetchTodayStatus]);

  const handlePunch = async (type: 'in' | 'out') => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      // Get GPS Location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      }).catch(() => null);

      const locationData = position ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      } : null;

      const now = new Date().toISOString();

      if (type === 'in') {
        const { error } = await supabase
          .from('attendance')
          .insert({
            workspace_id: activeWorkspace.id,
            workspace_member_id: activeMember.id,
            attendance_date: todayDate,
            punch_in_time: now,
            punch_in_location: locationData,
            work_location: workLocation,
            status: workLocation === 'WFH' ? 'Remote' : 'Present'
          });
        if (error) throw error;
        toast.success(`Punched in successfully (${workLocation})!`);
      } else {
        if (!todayRecord?.punch_in_time) throw new Error("No punch in record found.");
        
        // If an active break is ongoing, end it first
        if (activeBreak) {
          await handleBreak('resume');
        }

        const punchIn = new Date(todayRecord.punch_in_time);
        const punchOut = new Date(now);
        const diffMs = punchOut.getTime() - punchIn.getTime();
        const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        const breakHours = Number(todayRecord.break_hours || 0);
        const netProductive = Math.max(0, parseFloat((workingHours - breakHours).toFixed(2)));

        const { error } = await supabase
          .from('attendance')
          .update({
            punch_out_time: now,
            punch_out_location: locationData,
            working_hours: workingHours,
            net_productive_hours: netProductive
          })
          .eq('id', todayRecord.id);
        if (error) throw error;
        
        toast.success(`Punched out! Logged ${workingHours} hrs (${netProductive} hrs net productive).`);
        
        setLastLoggedHours(netProductive);
        setShowTimeLogModal(true);
      }

      await fetchTodayStatus();
      onPunch();
    } catch (error: any) {
      toast.error(sanitizeErrorMessage(error, 'Failed to update attendance'));
    } finally {
      setLoading(false);
    }
  };

  const handleBreak = async (action: 'start' | 'resume') => {
    if (!todayRecord?.id || !activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();

      if (action === 'start') {
        const { error } = await supabase
          .from('hr_attendance_breaks')
          .insert({
            workspace_id: activeWorkspace.id,
            attendance_id: todayRecord.id,
            workspace_member_id: activeMember.id,
            break_type: breakType,
            start_time: now,
          });
        if (error) throw error;
        toast.success(`Break started (${breakType})`);
      } else {
        if (!activeBreak?.id) return;
        const startTime = new Date(activeBreak.start_time).getTime();
        const endTime = new Date(now).getTime();
        const durationMins = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));

        const { error: breakErr } = await supabase
          .from('hr_attendance_breaks')
          .update({
            end_time: now,
            duration_minutes: durationMins,
          })
          .eq('id', activeBreak.id);
        if (breakErr) throw breakErr;

        // Recalculate total break hours on attendance record
        const { data: allBreaks } = await supabase
          .from('hr_attendance_breaks')
          .select('duration_minutes')
          .eq('attendance_id', todayRecord.id);

        const totalMins = (allBreaks || []).reduce((sum, b) => sum + Number(b.duration_minutes || 0), 0);
        const totalBreakHrs = parseFloat((totalMins / 60).toFixed(2));

        await supabase
          .from('attendance')
          .update({ break_hours: totalBreakHrs })
          .eq('id', todayRecord.id);

        toast.success(`Resumed work! Break duration: ${durationMins} mins.`);
      }

      await fetchTodayStatus();
      onPunch();
    } catch (error: any) {
      toast.error(sanitizeErrorMessage(error, 'Failed to update break status'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {!todayRecord || !todayRecord.punch_in_time ? (
          <div className="flex items-center gap-2">
            {/* Work Location Selector */}
            <div className="flex items-center bg-card border border-border rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setWorkLocation('OFFICE')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  workLocation === 'OFFICE' ? 'bg-[#00aef0] text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Office
              </button>
              <button
                type="button"
                onClick={() => setWorkLocation('WFH')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  workLocation === 'WFH' ? 'bg-[#00aef0] text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                WFH
              </button>
              <button
                type="button"
                onClick={() => setWorkLocation('CLIENT_SITE')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  workLocation === 'CLIENT_SITE' ? 'bg-[#00aef0] text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Client
              </button>
            </div>

            <Button 
              onClick={() => handlePunch('in')} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-foreground font-extrabold shadow-lg shadow-emerald-600/20 rounded-xl h-10 px-4"
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Fingerprint className="size-4 mr-2" />}
              Punch In
            </Button>
          </div>
        ) : todayRecord.punch_in_time && !todayRecord.punch_out_time ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-800">
              <Clock className="size-4 text-emerald-400" />
              Punched In ({todayRecord.work_location || 'OFFICE'}) at {new Date(todayRecord.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Break Control Bar */}
            {activeBreak ? (
              <Button
                onClick={() => handleBreak('resume')}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-foreground font-bold rounded-xl h-10 gap-1.5 shadow-lg shadow-amber-600/20"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Resume Work (On {activeBreak.break_type} Break)
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl">
                <select
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value as any)}
                  className="bg-background text-foreground border-none text-xs rounded-lg px-2 py-1 focus:ring-0"
                >
                  <option value="LUNCH">Lunch Break</option>
                  <option value="TEA">Tea / Coffee</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="MEETING">Client Meeting</option>
                </select>
                <Button
                  onClick={() => handleBreak('start')}
                  disabled={loading}
                  variant="outline"
                  className="h-8 border-border bg-muted text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 text-xs font-bold gap-1 rounded-lg"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  Start Break
                </Button>
              </div>
            )}

            <Button 
              onClick={() => handlePunch('out')} 
              disabled={loading}
              variant="destructive"
              className="font-extrabold rounded-xl h-10 px-4 shadow-lg shadow-rose-600/20"
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Fingerprint className="size-4 mr-2" />}
              Punch Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card px-3.5 py-2 rounded-xl border border-border">
            <Clock className="size-4 text-[#00aef0]" />
            Logged {todayRecord.working_hours} hrs ({todayRecord.net_productive_hours || todayRecord.working_hours} hrs net) today
          </div>
        )}
      </div>

      <TimeLogForm 
        open={showTimeLogModal} 
        onOpenChange={setShowTimeLogModal} 
        defaultHours={lastLoggedHours}
        onSaved={() => setShowTimeLogModal(false)}
      />
    </>
  );
}
