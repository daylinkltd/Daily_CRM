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
// The template-driven multi-row table replaces the old fixed
// task/hours/notes form, which ignored fields_json entirely.
import { TimesheetEntryTable } from '@/components/timesheets/timesheet-entry-table';
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
import { calculateAttendanceMetrics } from '@/lib/hr/attendance/attendance-engine';
import {
  DEFAULT_ATTENDANCE_POLICY,
  parseAttendancePolicy,
  type AttendancePolicy,
  type GeofenceStatus,
  type PunchLocation,
  type WorkLocation,
} from '@/lib/attendance/policy';
import { IconAction } from "@/components/ui/icon-action";
import { NativeSelect } from "@/components/ui/native-select";

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
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  // null = not yet known. Rendering the punch controls before this
  // resolves would flash them for people who never clock in.
  const [attendanceEnabled, setAttendanceEnabled] = useState<boolean | null>(null);
  const [breakType, setBreakType] = useState<'LUNCH' | 'TEA' | 'PERSONAL' | 'MEETING'>('LUNCH');
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  // Set while the mandatory timesheet is open; carries the punch-out that
  // is waiting on it so the location decision made before the modal is
  // not asked for a second time.
  const [pendingPunchOut, setPendingPunchOut] = useState<{ skipLocation: boolean } | null>(null);
  // The day's timesheet is in. Survives a failed punch-out so a retry
  // does not ask for it again — and log it twice.
  const [timesheetSaved, setTimesheetSaved] = useState(false);
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

  /**
   * Reports exactly what the browser says, rather than guessing which of
   * the three gates is closed. The raw error code is the thing that
   * actually distinguishes them: 1 = PERMISSION_DENIED (site or OS),
   * 2 = POSITION_UNAVAILABLE (no fix — OS services off, or no signal),
   * 3 = TIMEOUT.
   */
  const runLocationDiagnostic = async () => {
    setDiagnostic('Running…');
    const lines: string[] = [];
    lines.push(`Secure origin: ${typeof window !== 'undefined' && window.isSecureContext ? 'yes' : 'NO — location is blocked outright'}`);
    lines.push(`Origin: ${typeof window !== 'undefined' ? window.location.origin : '?'}`);
    lines.push(`Geolocation API present: ${typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'yes' : 'no'}`);
    lines.push(`Permissions API reports: ${await getGeolocationPermission()}`);

    const raw = await new Promise<string>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve('no geolocation object');
        return;
      }
      const started = Date.now();
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve(
            `SUCCESS in ${Date.now() - started}ms — accuracy ±${Math.round(pos.coords.accuracy)}m`
          ),
        (err) =>
          resolve(
            `FAILED code ${err.code} (${
              err.code === 1 ? 'PERMISSION_DENIED' : err.code === 2 ? 'POSITION_UNAVAILABLE' : 'TIMEOUT'
            }) after ${Date.now() - started}ms — "${err.message}"`
          ),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
      );
    });
    lines.push(`Direct request: ${raw}`);

    // code 2 with the site allowed is the OS withholding it; code 1 with
    // the site allowed is almost always the OS too, on macOS.
    if (raw.includes('code 2')) {
      lines.push('');
      lines.push('POSITION_UNAVAILABLE with the site allowed means the operating system has no fix to give — macOS Location Services is off for this browser, or Wi-Fi/GPS is disabled.');
    } else if (raw.includes('code 1')) {
      lines.push('');
      lines.push('PERMISSION_DENIED while the site shows Allow points at the OS layer or a browser shield (Brave), not the site permission.');
    }
    setDiagnostic(lines.join('\n'));
  };

  /**
   * `skipLocation` records the punch with the location marked unavailable
   * instead of refusing it. Offered only after a genuine geolocation
   * failure, and never silently: blocking someone from clocking out
   * because macOS is withholding GPS from their browser is worse than
   * storing an honest "no fix, flagged for review" — they still have to
   * be paid for the day.
   */
  /**
   * Punch out, but only once the timesheet exists.
   *
   * When HR marks the timesheet mandatory, the old order was: write the
   * punch-out, then pop the timesheet modal — which the employee could
   * simply close. "Required" was a suggestion, and the day's hours were
   * already banked. Now the modal opens FIRST and the punch-out is held
   * until it saves, so the requirement is real.
   */
  /**
   * Hours clocked so far. The mandatory timesheet opens BEFORE the
   * punch-out is written, so `working_hours` is still null — without
   * this the reconciliation badge would read "Clocked 0h" and the
   * mismatch warning would fire on every honest entry.
   */
  const liveHoursSoFar = todayRecord?.punch_in_time
    ? Math.max(
        0,
        Number(
          (
            (Date.now() - new Date(todayRecord.punch_in_time).getTime()) / 3_600_000
            - Number(todayRecord.break_hours || 0)
          ).toFixed(2),
        ),
      )
    : undefined;

  const requestPunchOut = async (skipLocation = false) => {
    // Ask for the timesheet only when there is a day to account for, and
    // only once: a punch-out that fails on geofence would otherwise
    // demand a second timesheet on retry and log the day twice.
    if (
      policy.require_timesheet_on_punch_out &&
      todayRecord?.punch_in_time &&
      !timesheetSaved
    ) {
      // Someone who already filled in today's timesheet on
      // /me/timesheets has met the requirement — asking again would
      // produce a duplicate day. Those existing entries are what the
      // punch-out attaches to.
      const { count } = await supabase
        .from('time_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', activeWorkspace!.id)
        .eq('workspace_member_id', activeMember!.id)
        .eq('log_date', todayDate);

      if ((count ?? 0) > 0) {
        setTimesheetSaved(true);
        toast.info(`Today's timesheet is already logged (${count} ${count === 1 ? 'entry' : 'entries'}).`);
        await handlePunch('out', skipLocation);
        return;
      }

      setPendingPunchOut({ skipLocation });
      setShowTimeLogModal(true);
      return;
    }
    await handlePunch('out', skipLocation);
  };

  const handlePunch = async (type: 'in' | 'out', skipLocation = false) => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      // Working from home has no office to stand near, so it never needs a
      // fix. Everything else does: this used to swallow every geolocation
      // failure and store null, which is why no punch has ever recorded a
      // location and the map fell back to a hardcoded city centre.
      const locationRequired =
        !skipLocation &&
        policy.require_location &&
        policy.require_location_for.includes(workLocation);

      let locationData: PunchLocation | null = null;
      let geofenceStatus: GeofenceStatus = locationRequired ? 'NOT_ENFORCED' : 'EXEMPT';
      let distanceM: number | null = null;
      // Recorded so HR can tell "WFH, no location needed" apart from
      // "location was required but the device could not supply one".
      const exemptReason: string | null = skipLocation
        ? 'Device could not provide a location; recorded by the employee without one.'
        : null;

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
          // Punching OUT is never hard-blocked: the shift already happened,
          // and refusing to record its end loses real worked hours. Punching
          // IN still requires a fix unless HR allowed the exemption.
          if (type === 'out') {
            toast.error(message, {
              duration: 12_000,
              action: {
                label: 'Punch out anyway',
                onClick: () => requestPunchOut(true),
              },
            });
          } else {
            toast.error(message, {
              duration: 12_000,
              action:
                failure?.reason === 'permission_denied'
                  ? { label: 'How to fix', onClick: () => setShowLocationHelp(true) }
                  : { label: 'Try again', onClick: () => handlePunch(type) },
            });
          }
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
            location_exempt_reason: exemptReason,
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

        // Single source of truth for attendance arithmetic — this used to
        // recompute it inline and never derived overtime, which is why the
        // "Approved Overtime" KPI on /attendance was permanently 0.
        //
        // No `shift` is passed: hr_shifts is empty and no workspace timezone
        // is stored, so lateness cannot be scored honestly yet. The engine
        // returns null for it rather than a made-up 0, and status/late_minutes
        // are left untouched here.
        const breakHours = Number(todayRecord.break_hours || 0);
        const metrics = calculateAttendanceMetrics({
          punchInTime: todayRecord.punch_in_time,
          punchOutTime: now,
          totalBreakMinutes: breakHours * 60,
        });
        const workingHours = metrics.totalHours;
        const netProductive = metrics.netProductiveHours;

        const { error } = await supabase
          .from('attendance')
          .update({
            punch_out_time: now,
            punch_out_location: locationData,
            punch_out_accuracy_m: locationData?.accuracy ?? null,
            punch_out_distance_m: distanceM,
            punch_out_geofence_status: skipLocation ? 'INCONCLUSIVE' : geofenceStatus,
            punch_out_device_json: deviceInfo,
            punch_out_ip: networkContext?.ip ?? null,
            location_exempt_reason: exemptReason,
            // Surfaced to HR rather than buried: a punch with no location is
            // valid but worth a look.
            review_flags: skipLocation ? ['PUNCH_OUT_WITHOUT_LOCATION'] : null,
            working_hours: workingHours,
            net_productive_hours: netProductive,
            overtime_hours: metrics.overtimeHours
          })
          .eq('id', todayRecord.id);
        if (error) throw error;

        toast.success(`Punched out! Logged ${workingHours} hrs (${netProductive} hrs net productive).`);

        setLastLoggedHours(netProductive);
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

          {diagnostic && (
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-foreground">
              {diagnostic}
            </pre>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={runLocationDiagnostic}>
              Run diagnostic
            </Button>
            <Button variant="outline" onClick={() => setShowLocationHelp(false)}>
              Close
            </Button>
            <IconAction label="Try again" icon={<Fingerprint className="size-4" />} onClick={() => {
                setShowLocationHelp(false);
                handlePunch(todayRecord?.punch_in_time && !todayRecord?.punch_out_time ? 'out' : 'in');
              }}
              className="gap-1.5" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Never wraps: this sits in a fixed-height header, so a second line
          overflows the bar instead of growing it. The controls degrade by
          width instead — the status pill collapses to its icon, the break
          picker drops out, and the punch button always survives. */}
      <div className="flex min-w-0 items-center gap-2">
        {!todayRecord || !todayRecord.punch_in_time ? (
          <div className="flex items-center gap-2">
            {/* Work Location Selector — renders only what HR allows this
                member. An on-site-only employee never sees a WFH option, so
                a single allowed mode shows as a static label instead. */}
            {policy.allowed_work_locations.length > 1 ? (
              <div className="hidden items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs sm:flex">
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
              type="button"
              onClick={() => handlePunch('in')}
              disabled={loading}
              size="sm"
              className="h-9 font-bold shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xs gap-1.5 px-3"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Fingerprint className="size-4 shrink-0" />
              )}
              <span className="text-xs font-semibold tracking-wide">
                {locatingMessage ? 'Locating…' : 'Punch In'}
              </span>
            </Button>

            {locatingMessage && (
              <span className="hidden text-[11px] text-muted-foreground lg:inline">{locatingMessage}</span>
            )}

            {policy.override_note && (
              <span className="hidden text-[11px] text-amber-600 lg:inline dark:text-amber-400">
                {policy.override_note}
              </span>
            )}
          </div>
        ) : todayRecord.punch_in_time && !todayRecord.punch_out_time ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {/* Below xl only the time survives; below sm, only the icon. */}
              <span className="hidden truncate sm:inline">
                <span className="hidden xl:inline">
                  Punched In ({todayRecord.work_location || 'OFFICE'}) at{' '}
                </span>
                {new Date(todayRecord.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
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
                type="button"
                onClick={() => handleBreak('resume')}
                disabled={loading}
                size="sm"
                className="h-9 shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 px-2.5 shadow-xs"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                <span>Resume</span>
              </Button>
            ) : (
              <div className="hidden items-center gap-1 rounded-lg border border-border bg-card p-0.5 md:flex">
                <NativeSelect
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value as any)}
                  className="bg-background text-foreground border-none text-xs rounded-md px-2 py-1 focus:ring-0"
                >
                  <option value="LUNCH">Lunch Break</option>
                  <option value="TEA">Tea / Coffee</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="MEETING">Client Meeting</option>
                </NativeSelect>
                <Button
                  type="button"
                  onClick={() => handleBreak('start')}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="h-7 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium gap-1 rounded-md px-2"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  <span>Break</span>
                </Button>
              </div>
            )}

            <Button
              type="button"
              onClick={() => requestPunchOut()}
              disabled={loading}
              size="sm"
              className="h-9 font-bold shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white shadow-xs gap-1.5 px-3"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Fingerprint className="size-4 shrink-0" />
              )}
              <span className="text-xs font-semibold tracking-wide">
                Punch Out
              </span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <Clock className="size-3.5 text-primary" />
            Logged {Number(todayRecord.working_hours ?? 0)} hrs ({Number(todayRecord.net_productive_hours ?? todayRecord.working_hours ?? 0)} hrs net) today
          </div>
        )}
      </div>

      <TimesheetEntryTable
        open={showTimeLogModal}
        onOpenChange={(next) => {
          // Dismissing a mandatory timesheet abandons the punch-out
          // rather than completing it silently — the employee is still
          // clocked in and can try again once the day is filled in.
          if (!next && pendingPunchOut) {
            setPendingPunchOut(null);
            toast.info('Punch out cancelled — your timesheet is needed first.');
          }
          setShowTimeLogModal(next);
        }}
        templateId={policy.timesheet_template_id}
        loggedHours={lastLoggedHours ?? liveHoursSoFar}
        mandatory={Boolean(pendingPunchOut)}
        onSaved={async () => {
          setShowTimeLogModal(false);
          setTimesheetSaved(true);
          const pending = pendingPunchOut;
          setPendingPunchOut(null);
          // The timesheet is in; now the punch-out may complete.
          if (pending) await handlePunch('out', pending.skipLocation);
          fetchTodayStatus();
        }}
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
