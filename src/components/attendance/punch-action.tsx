'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint, MapPin, Clock } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

import { TimeLogForm } from '@/components/timesheets/time-log-form';

export function PunchAction({ onPunch }: { onPunch: () => void }) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any | null>(null);
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  
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
            status: 'Present'
          });
        if (error) throw error;
        toast.success('Punched in successfully!');
      } else {
        // Punch out: calculate working hours
        if (!todayRecord?.punch_in_time) throw new Error("No punch in time found.");
        
        const punchIn = new Date(todayRecord.punch_in_time);
        const punchOut = new Date(now);
        const diffMs = punchOut.getTime() - punchIn.getTime();
        const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        const { error } = await supabase
          .from('attendance')
          .update({
            punch_out_time: now,
            punch_out_location: locationData,
            working_hours: workingHours
          })
          .eq('id', todayRecord.id);
        if (error) throw error;
        
        toast.success(`Punched out! Logged ${workingHours} hours.`);
        
        // Open the timesheet modal so they can allocate those hours to tasks
        setShowTimeLogModal(true);
      }

      await fetchTodayStatus();
      onPunch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record punch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!todayRecord || !todayRecord.punch_in_time ? (
        <Button 
          onClick={() => handlePunch('in')} 
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Fingerprint className="size-4 mr-2" />}
          Punch In
        </Button>
      ) : todayRecord.punch_in_time && !todayRecord.punch_out_time ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-900">
            <Clock className="size-4" />
            Punched In at {new Date(todayRecord.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Button 
            onClick={() => handlePunch('out')} 
            disabled={loading}
            variant="destructive"
            className="shadow-sm"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Fingerprint className="size-4 mr-2" />}
            Punch Out
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md border border-border">
          <Clock className="size-4" />
          Logged {todayRecord.working_hours} hours today
        </div>
      )}

      <TimeLogForm 
        open={showTimeLogModal} 
        onOpenChange={setShowTimeLogModal} 
        onSaved={() => setShowTimeLogModal(false)}
      />
    </>
  );
}
