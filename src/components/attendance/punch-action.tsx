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
  Briefcase,
  MapPin
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { TimeLogForm } from '@/components/timesheets/time-log-form';
import { LocationMapModal } from '@/components/attendance/location-map-modal';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';

export function PunchAction({ onPunch }: { onPunch?: () => void }) {
  const supabase = createClient();
  const { activeWorkspace, activeMember, moduleAccess } = useWorkspace();
  
  if (!moduleAccess?.hr) {
    return null;
  }
  
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
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
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
      onPunch?.();
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
      onPunch?.();
    } catch (error: any) {
      toast.error(sanitizeErrorMessage(error, 'Failed to update break status'));
    } finally {
      setLoading(false);
    }
  };

  const [showLocationMap, setShowLocationMap] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {!todayRecord || !todayRecord.punch_in_time ? (
          <div className="flex items-center gap-2">
            {/* Work Location Selector */}
            <div className="flex items-center bg-muted/50 border border-border rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setWorkLocation('OFFICE')}
                className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  workLocation === 'OFFICE' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Office
              </button>
              <button
                type="button"
                onClick={() => setWorkLocation('WFH')}
                className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  workLocation === 'WFH' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                WFH
              </button>
              <button
                type="button"
                onClick={() => setWorkLocation('CLIENT_SITE')}
                className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  workLocation === 'CLIENT_SITE' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Client
              </button>
            </div>

            <Button 
              onClick={() => handlePunch('in')} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold shadow-xs rounded-lg h-9 px-3 text-xs"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Fingerprint className="size-3.5 mr-1.5" />}
              Punch In
            </Button>
          </div>
        ) : todayRecord.punch_in_time && !todayRecord.punch_out_time ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Punched In ({todayRecord.work_location || 'OFFICE'}) at {new Date(todayRecord.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {todayRecord.punch_in_location && (
                <button
                  type="button"
                  onClick={() => setShowLocationMap(true)}
                  className="p-0.5 hover:bg-emerald-500/20 rounded transition-colors text-emerald-600 dark:text-emerald-400 ml-0.5"
                  title="View GPS Location Map"
                >
                  <MapPin className="size-3.5" />
                </button>
              )}
            </div>

            {/* Break Control Bar */}
            {activeBreak ? (
              <Button
                onClick={() => handleBreak('resume')}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 px-3 rounded-lg shadow-xs gap-1.5"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Resume Work ({activeBreak.break_type})
              </Button>
            ) : (
              <div className="flex items-center gap-1 bg-card border border-border p-0.5 rounded-lg">
                <select
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value as any)}
                  className="bg-background text-foreground border-none text-xs rounded-md px-2 py-1 focus:ring-0"
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
                  className="h-7 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium gap-1 rounded-md px-2"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  Start Break
                </Button>
              </div>
            )}

            <Button 
              onClick={() => handlePunch('out')} 
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-semibold text-xs h-9 px-3 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Fingerprint className="size-3.5 mr-1.5" />}
              Punch Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <Clock className="size-3.5 text-primary" />
            Logged {Number(todayRecord.working_hours ?? 0)} hrs ({Number(todayRecord.net_productive_hours ?? todayRecord.working_hours ?? 0)} hrs net) today
          </div>
        )}
      </div>

      <TimeLogForm 
        open={showTimeLogModal} 
        onOpenChange={setShowTimeLogModal} 
        defaultHours={lastLoggedHours}
        onSaved={() => setShowTimeLogModal(false)}
      />

      <LocationMapModal
        open={showLocationMap}
        onOpenChange={setShowLocationMap}
        location={todayRecord?.punch_in_location || null}
        title="Punch In GPS Location"
        timestamp={todayRecord?.punch_in_time ? new Date(todayRecord.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined}
        workLocation={todayRecord?.work_location || 'OFFICE'}
      />
    </>
  );
}
