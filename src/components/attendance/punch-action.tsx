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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimeLogForm } from '@/components/timesheets/time-log-form';
import { LocationMapModal } from '@/components/attendance/location-map-modal';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';
import {
  acquirePreciseLocation,
  checkGeofence,
  formatDistance,
  GeolocationFailure,
  GEOLOCATION_FAILURE_MESSAGES,
  getGeolocationPermission,
  type PreciseLocation,
} from '@/lib/attendance/geolocation';
import { collectDeviceInfo } from '@/lib/attendance/device-info';
import {
  DEFAULT_ATTENDANCE_POLICY,
  parseAttendancePolicy,
  type AttendancePolicy,
  type GeofenceStatus,
  type PunchLocation,
  type WorkLocation,
} from '@/lib/attendance/policy';

const WORK_LOCATION_ICONS: Record<WorkLocation, typeof Building2> = {
  OFFICE: Building2,
  WFH: Home,
  CLIENT_SITE: Briefcase,
  FIELD: MapPin,
};

const WORK_LOCATION_SHORT_LABELS: Record<WorkLocation, string> = {
  OFFICE: 'Office',
  WFH: 'WFH',
  CLIENT_SITE: 'Client',
  FIELD: 'Field',
};

export function PunchAction({ onPunch }: { onPunch?: () => void }) {
  const supabase = createClient();
  const { activeWorkspace, activeMember, moduleAccess } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any | null>(null);
  const [activeBreak, setActiveBreak] = useState<any | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocation>('OFFICE');
  const [policy, setPolicy] = useState<AttendancePolicy>(DEFAULT_ATTENDANCE_POLICY);
  const [locatingMessage, setLocatingMessage] = useState<string | null>(null);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  // null = not yet known. Rendering the punch controls before this
  // resolves would flash them for people who never clock in.
  const [attendanceEnabled, setAttendanceEnabled] = useState<boolean | null>(null);
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

  // Does this person clock in at all? Set per employee in HR; the punch
  // controls are hidden entirely when it is off.
  useEffect(() => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('attendance_enabled')
        .eq('workspace_id', activeWorkspace.id)
        .eq('workspace_member_id', activeMember.id)
        .maybeSingle();
      if (cancelled) return;
      // No employee row, or the column not deployed yet: fall back to
      // showing the controls rather than hiding attendance from everyone.
      if (error) setAttendanceEnabled(true);
      else setAttendanceEnabled(data ? data.attendance_enabled !== false : false);
    })();
    return () => { cancelled = true; };
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  // Resolve this member's effective policy for today: which work locations
  // they may pick, whether GPS is required, the geofence, and whether
  // punching out asks for a timesheet.
  useEffect(() => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc('resolve_attendance_policy', {
        p_workspace_id: activeWorkspace.id,
        p_workspace_member_id: activeMember.id,
        p_date: todayDate,
      });
      if (cancelled) return;

      // Fall back to the permissive default rather than blocking punches if
      // the policy tables are not deployed yet.
      const resolved = error ? DEFAULT_ATTENDANCE_POLICY : parseAttendancePolicy(data);
      setPolicy(resolved);
      setWorkLocation((current) =>
        resolved.allowed_work_locations.includes(current)
          ? current
          : resolved.default_work_location
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, activeWorkspace?.id, activeMember?.id, todayDate]);

  const handlePunch = async (type: 'in' | 'out') => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      // Working from home has no office to stand near, so it never needs a
      // fix. Everything else does: this used to swallow every geolocation
      // failure and store null, which is why no punch has ever recorded a
      // location and the map fell back to a hardcoded city centre.
      const locationRequired =
        policy.require_location && policy.require_location_for.includes(workLocation);

      let locationData: PunchLocation | null = null;
      let geofenceStatus: GeofenceStatus = locationRequired ? 'NOT_ENFORCED' : 'EXEMPT';
      let distanceM: number | null = null;

      // Device and network context are captured for every punch, including
      // WFH — knowing which machine clocked in is useful even when there is
      // no location to check.
      const deviceInfo = collectDeviceInfo();
      const networkContext = await fetch('/api/attendance/device-context')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (locationRequired) {
        // Always ATTEMPT the fix, even when the Permissions API reports
        // 'denied'. Short-circuiting here was wrong: it meant the browser
        // was never asked, so the native "Allow location?" prompt could
        // not appear at all. The reported state can also be stale — a
        // user who has just re-allowed the site still reads as denied
        // until something queries again. Requesting costs nothing when it
        // really is blocked; the call simply fails and we explain.
        const permission = await getGeolocationPermission();
        setLocatingMessage(
          permission === 'denied'
            ? 'Requesting location — allow it if your browser asks…'
            : permission === 'prompt'
              ? 'Allow location access when your browser asks…'
              : 'Getting a precise GPS fix…'
        );
        let fix: PreciseLocation;
        try {
          fix = await acquirePreciseLocation({
            desiredAccuracyM: policy.min_gps_accuracy_m,
            timeoutMs: 25_000,
          });
        } catch (geoError) {
          // Surface the reason and stop. Recording a punch with no location
          // when policy demands one is what produced the bad data.
          const failure =
            geoError instanceof GeolocationFailure ? geoError : null;
          const message = failure
            ? failure.message
            : GEOLOCATION_FAILURE_MESSAGES.position_unavailable;

          // Only a blocked permission needs the browser-settings walkthrough;
          // a timeout or a bad fix just needs another go.
          toast.error(message, {
            duration: 10_000,
            action:
              failure?.reason === 'permission_denied'
                ? { label: 'How to fix', onClick: () => setShowLocationHelp(true) }
                : { label: 'Try again', onClick: () => handlePunch(type) },
          });
          return;
        } finally {
          setLocatingMessage(null);
        }

        if (fix.coarse && fix.accuracy > policy.min_gps_accuracy_m) {
          toast.error(
            `Location is only accurate to ±${Math.round(fix.accuracy)}m, but this workspace requires ±${policy.min_gps_accuracy_m}m. ` +
              `Move outdoors or enable precise location, then try again.`
          );
          return;
        }

        locationData = {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          captured_at: fix.capturedAt,
        };

        if (policy.geofence) {
          const check = checkGeofence(fix, {
            latitude: policy.geofence.latitude,
            longitude: policy.geofence.longitude,
            radiusM: policy.geofence.radius_m,
          });
          distanceM = check.distanceM;
          geofenceStatus = check.inconclusive
            ? 'INCONCLUSIVE'
            : check.inside
              ? 'INSIDE'
              : 'OUTSIDE';

          if (!check.inside && !check.inconclusive && policy.block_outside_geofence) {
            toast.error(
              `You are ${formatDistance(check.distanceM)} from ${policy.geofence.label || 'the allowed location'} ` +
                `(limit ${formatDistance(check.radiusM)}). Punching in is only allowed on site.`
            );
            return;
          }
          if (geofenceStatus === 'OUTSIDE') {
            toast.warning(
              `Recorded ${formatDistance(check.distanceM)} outside ${policy.geofence.label || 'the allowed area'}. HR will see this flagged.`
            );
          }
        }
      }

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
            punch_in_accuracy_m: locationData?.accuracy ?? null,
            punch_in_distance_m: distanceM,
            punch_in_geofence_status: geofenceStatus,
            punch_in_device_json: deviceInfo,
            punch_in_ip: networkContext?.ip ?? null,
            work_location: workLocation,
            status: workLocation === 'WFH' ? 'Remote' : 'Present'
          });
        if (error) throw error;
        toast.success(
          locationData
            ? `Punched in (${workLocation}) — location accurate to ±${Math.round(locationData.accuracy)}m.`
            : `Punched in (${workLocation}).`
        );
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
            punch_out_accuracy_m: locationData?.accuracy ?? null,
            punch_out_distance_m: distanceM,
            punch_out_geofence_status: geofenceStatus,
            punch_out_device_json: deviceInfo,
            punch_out_ip: networkContext?.ip ?? null,
            working_hours: workingHours,
            net_productive_hours: netProductive
          })
          .eq('id', todayRecord.id);
        if (error) throw error;

        toast.success(`Punched out! Logged ${workingHours} hrs (${netProductive} hrs net productive).`);

        setLastLoggedHours(netProductive);
        // HR decides per employee whether punching out requires a timesheet.
        if (policy.require_timesheet_on_punch_out) {
          setShowTimeLogModal(true);
        }
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

  // Must sit below every hook: this component renders in the global header,
  // so a mid-session permission change that flips `moduleAccess` while the
  // component stays mounted would otherwise change the hook count and
  // white-screen the whole dashboard.
  if (!moduleAccess?.hr) {
    return null;
  }

  // Hidden while unknown, and for anyone attendance is switched off for.
  if (attendanceEnabled !== true) {
    return null;
  }

  return (
    <>
      {/* Once a browser has been told "block", it will not ask again — the
          only route back is the site settings, so spell it out per
          platform rather than repeating "permission denied". */}
      <Dialog open={showLocationHelp} onOpenChange={setShowLocationHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Turn location back on</DialogTitle>
            <DialogDescription>
              Your browser is blocking location for this site, so it will not ask again until you
              change it here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Location has <strong>two</strong> switches. The site permission is the one people
              check; the operating system one is the one that is usually actually off.
            </p>
            <div>
              <p className="font-semibold">1. Your operating system</p>
              <p className="text-muted-foreground">
                macOS: System Settings &rarr; Privacy &amp; Security &rarr; Location Services &rarr;
                switch it on <em>and</em> tick your browser in the list. Windows: Settings &rarr;
                Privacy &amp; security &rarr; Location. iPhone or Android: enable location for the
                browser app, and check GPS is on.
              </p>
            </div>
            <div>
              <p className="font-semibold">2. This site</p>
              <p className="text-muted-foreground">
                Click the icon at the left of the address bar &rarr; Location &rarr; Allow, then
                reload. In Brave, also check the Shields icon.
              </p>
            </div>
            <div>
              <p className="font-semibold">3. A secure connection</p>
              <p className="text-muted-foreground">
                Browsers block location on plain <code>http://</code> unless the address is exactly{" "}
                <code>localhost</code>. Opening a dev server by its IP — say{" "}
                <code>http://192.168.x.x:3000</code> — fails no matter what the permissions say.
              </p>
              {typeof window !== "undefined" && !window.isSecureContext && (
                <p className="mt-1 font-medium text-destructive">
                  This page is NOT on a secure origin, so location cannot work here until you use
                  HTTPS or localhost.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setShowLocationHelp(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowLocationHelp(false);
                handlePunch(todayRecord?.punch_in_time && !todayRecord?.punch_out_time ? 'out' : 'in');
              }}
              className="gap-1.5"
            >
              <Fingerprint className="size-4" /> Try again
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-3">
        {!todayRecord || !todayRecord.punch_in_time ? (
          <div className="flex items-center gap-2">
            {/* Work Location Selector — renders only what HR allows this
                member. An on-site-only employee never sees a WFH option, so
                a single allowed mode shows as a static label instead. */}
            {policy.allowed_work_locations.length > 1 ? (
              <div className="flex items-center bg-muted/50 border border-border rounded-lg p-0.5 text-xs">
                {policy.allowed_work_locations.map((option) => {
                  const Icon = WORK_LOCATION_ICONS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWorkLocation(option)}
                      className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                        workLocation === option
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {WORK_LOCATION_SHORT_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs text-muted-foreground">
                {(() => {
                  const Icon = WORK_LOCATION_ICONS[workLocation];
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                <span className="font-medium text-foreground">
                  {WORK_LOCATION_SHORT_LABELS[workLocation]}
                </span>
              </div>
            )}

            <Button
              onClick={() => handlePunch('in')}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold shadow-xs rounded-lg h-9 px-3 text-xs"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Fingerprint className="size-3.5 mr-1.5" />}
              {locatingMessage ? 'Locating…' : 'Punch In'}
            </Button>

            {locatingMessage && (
              <span className="text-[11px] text-muted-foreground">{locatingMessage}</span>
            )}

            {policy.override_note && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                {policy.override_note}
              </span>
            )}
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
