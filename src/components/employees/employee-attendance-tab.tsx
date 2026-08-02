"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Save, MapPin, Trash2, CalendarPlus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  WORK_LOCATIONS,
  WORK_LOCATION_LABELS,
  type WorkLocation,
} from "@/lib/attendance/policy";
import { formatDistance } from "@/lib/attendance/geolocation";

const NONE = "none";
const INHERIT = "inherit";

interface WorkLocationRow {
  id: string;
  name: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}

interface PolicyRow {
  id: string;
  allowed_work_locations: WorkLocation[] | null;
  default_work_location: WorkLocation | null;
  require_location: boolean | null;
  min_gps_accuracy_m: number | null;
  location_id: string | null;
  block_outside_geofence: boolean | null;
  require_timesheet_on_punch_out: boolean | null;
  timesheet_template_id: string | null;
}

interface OverrideRow {
  id: string;
  override_date: string;
  allowed_work_locations: WorkLocation[] | null;
  location_id: string | null;
  note: string | null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Per-employee attendance rules, edited where the employee is rather
 * than in workspace settings.
 *
 * This writes a MEMBER-scoped row in `hr_attendance_policies`. Having no
 * row is meaningful: the person inherits their department's policy, or
 * the workspace default. "Use the workspace default" therefore deletes
 * the row rather than writing a copy of the defaults, which would
 * silently stop tracking later changes to them.
 */
export function EmployeeAttendanceTab({
  workspaceMemberId,
  canEdit,
}: {
  workspaceMemberId: string;
  canEdit: boolean;
}) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [policy, setPolicy] = useState<PolicyRow | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);

  const [hasOwnPolicy, setHasOwnPolicy] = useState(false);
  const [allowed, setAllowed] = useState<WorkLocation[]>(["OFFICE"]);
  const [requireLocation, setRequireLocation] = useState(true);
  const [minAccuracy, setMinAccuracy] = useState("100");
  const [locationId, setLocationId] = useState<string>(NONE);
  const [blockOutside, setBlockOutside] = useState(false);
  const [requireTimesheet, setRequireTimesheet] = useState(false);
  const [templateId, setTemplateId] = useState<string>(NONE);

  const [ovDate, setOvDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [ovAllowWfh, setOvAllowWfh] = useState(true);
  const [ovLocationId, setOvLocationId] = useState<string>(INHERIT);
  const [ovNote, setOvNote] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id || !workspaceMemberId) return;
    setLoading(true);
    try {
      const [locRes, tplRes, polRes, ovRes] = await Promise.all([
        supabase
          .from("work_locations")
          .select("id, name, type, latitude, longitude, radius_m")
          .eq("workspace_id", activeWorkspace.id)
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("hr_timesheet_templates")
          .select("id, name")
          .or(`workspace_id.is.null,workspace_id.eq.${activeWorkspace.id}`)
          .order("name"),
        supabase
          .from("hr_attendance_policies")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .eq("scope_type", "MEMBER")
          .eq("scope_id", workspaceMemberId)
          .maybeSingle(),
        supabase
          .from("hr_attendance_day_overrides")
          .select("*")
          .eq("workspace_member_id", workspaceMemberId)
          .gte("override_date", new Date().toISOString().split("T")[0])
          .order("override_date"),
      ]);

      setLocations((locRes.data as WorkLocationRow[] | null) || []);
      setTemplates(tplRes.data || []);
      setOverrides((ovRes.data as OverrideRow[] | null) || []);

      const p = polRes.data as PolicyRow | null;
      setPolicy(p);
      setHasOwnPolicy(Boolean(p));
      if (p) {
        setAllowed((p.allowed_work_locations || ["OFFICE"]) as WorkLocation[]);
        setRequireLocation(p.require_location ?? true);
        setMinAccuracy(String(p.min_gps_accuracy_m ?? 100));
        setLocationId(p.location_id || NONE);
        setBlockOutside(p.block_outside_geofence ?? false);
        setRequireTimesheet(p.require_timesheet_on_punch_out ?? false);
        setTemplateId(p.timesheet_template_id || NONE);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load attendance rules"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, workspaceMemberId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAllowed = (loc: WorkLocation) => {
    setAllowed((current) => {
      const has = current.includes(loc);
      if (has && current.length === 1) return current; // never leave nothing selectable
      return has ? current.filter((l) => l !== loc) : [...current, loc];
    });
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    const accuracy = parseInt(minAccuracy || "0", 10);
    if (!Number.isFinite(accuracy) || accuracy <= 0) {
      toast.error("Required GPS accuracy must be a positive number of metres.");
      return;
    }

    setSaving(true);
    try {
      if (!hasOwnPolicy) {
        // Back to inheriting: remove the row entirely so later changes to
        // the department or workspace policy reach this person.
        if (policy) {
          const { error } = await supabase
            .from("hr_attendance_policies")
            .delete()
            .eq("id", policy.id);
          if (error) throw error;
        }
        toast.success("This employee now follows the workspace or department policy.");
        await fetchData();
        return;
      }

      const payload = {
        workspace_id: activeWorkspace.id,
        scope_type: "MEMBER",
        scope_id: workspaceMemberId,
        allowed_work_locations: allowed,
        default_work_location: allowed[0],
        require_location: requireLocation,
        min_gps_accuracy_m: accuracy,
        location_id: locationId === NONE ? null : locationId,
        block_outside_geofence: locationId === NONE ? false : blockOutside,
        require_timesheet_on_punch_out: requireTimesheet,
        timesheet_template_id: templateId === NONE ? null : templateId,
      };

      // Insert or update explicitly: scope uniqueness is enforced by a
      // partial index, which onConflict cannot target.
      const { error } = policy
        ? await supabase.from("hr_attendance_policies").update(payload).eq("id", policy.id)
        : await supabase.from("hr_attendance_policies").insert(payload);
      if (error) throw error;

      toast.success("Attendance rules saved for this employee.");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save attendance rules"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!activeWorkspace?.id) return;
    setSavingOverride(true);
    try {
      const { error } = await supabase.from("hr_attendance_day_overrides").upsert(
        {
          workspace_id: activeWorkspace.id,
          workspace_member_id: workspaceMemberId,
          override_date: ovDate,
          allowed_work_locations: ovAllowWfh ? ["WFH", "OFFICE"] : ["OFFICE"],
          // A work-from-home day has no office to stand near.
          require_location: ovAllowWfh ? false : null,
          location_id: ovLocationId === INHERIT ? null : ovLocationId,
          note: ovNote || null,
        },
        { onConflict: "workspace_member_id,override_date" }
      );
      if (error) throw error;
      toast.success("Day exception saved.");
      setOvNote("");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save day exception"));
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      const { error } = await supabase
        .from("hr_attendance_day_overrides")
        .delete()
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success("Day exception removed.");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove day exception"));
    }
  };

  const selectedLocation = locations.find((l) => l.id === locationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> Attendance rules
            </CardTitle>
            <CardDescription>
              Where this person may punch in from, and how precise their location must be.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="shrink-0 gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Custom rules for this employee</p>
              <p className="text-xs text-muted-foreground">
                {hasOwnPolicy
                  ? "Overrides the department and workspace policy."
                  : "Currently following the department or workspace policy."}
              </p>
            </div>
            <Switch
              checked={hasOwnPolicy}
              onCheckedChange={setHasOwnPolicy}
              disabled={!canEdit}
            />
          </div>

          {hasOwnPolicy && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Allowed work locations</Label>
                <div className="flex flex-wrap gap-2">
                  {WORK_LOCATIONS.map((loc) => {
                    const active = allowed.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleAllowed(loc)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {WORK_LOCATION_LABELS[loc]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Select only Office and this person never sees a work-from-home option.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Work location / geofence</Label>
                  <Select value={locationId} onValueChange={setLocationId} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No boundary</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} {l.latitude == null ? "(no coordinates)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {locations.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No places yet —{" "}
                      <Link href="/settings?tab=attendance" className="text-primary underline">
                        add offices and client sites
                      </Link>
                      .
                    </p>
                  )}
                  {selectedLocation && selectedLocation.latitude != null && (
                    <p className="text-[11px] text-muted-foreground">
                      Within {formatDistance(selectedLocation.radius_m)} of {selectedLocation.name}.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Required GPS accuracy (metres)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={minAccuracy}
                    onChange={(e) => setMinAccuracy(e.target.value)}
                    disabled={!canEdit || !requireLocation}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Require a location for on-site punches</p>
                  <p className="text-xs text-muted-foreground">
                    Work from home never needs one.
                  </p>
                </div>
                <Switch
                  checked={requireLocation}
                  onCheckedChange={setRequireLocation}
                  disabled={!canEdit}
                />
              </div>

              {locationId !== NONE && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Block punches outside the boundary</p>
                    <p className="text-xs text-muted-foreground">
                      Off: recorded and flagged for review. On: refused.
                    </p>
                  </div>
                  <Switch
                    checked={blockOutside}
                    onCheckedChange={setBlockOutside}
                    disabled={!canEdit}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Ask for a timesheet on punch out</p>
                  <p className="text-xs text-muted-foreground">
                    Choose which questions this person answers.
                  </p>
                </div>
                <Switch
                  checked={requireTimesheet}
                  onCheckedChange={setRequireTimesheet}
                  disabled={!canEdit}
                />
              </div>

              {requireTimesheet && (
                <div className="space-y-1.5 sm:max-w-md">
                  <Label className="text-xs font-semibold">Timesheet template</Label>
                  <Select value={templateId} onValueChange={setTemplateId} disabled={!canEdit}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="size-4 text-primary" /> Day exceptions
          </CardTitle>
          <CardDescription>
            A one-off change for a single date — work from home on Thursday, or a client site
            visit. Beats every other rule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date</Label>
                <Input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Where</Label>
                <Select value={ovLocationId} onValueChange={setOvLocationId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={INHERIT}>Usual place</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddOverride}
                  disabled={savingOverride}
                  className="w-full gap-1.5"
                >
                  {savingOverride ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )}
                  Add
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Allow working from home</p>
                  <p className="text-xs text-muted-foreground">No location needed that day.</p>
                </div>
                <Switch checked={ovAllowWfh} onCheckedChange={setOvAllowWfh} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs font-semibold">Note (shown to the employee)</Label>
                <Input
                  value={ovNote}
                  onChange={(e) => setOvNote(e.target.value)}
                  placeholder="Approved WFH — client visit cancelled"
                />
              </div>
            </div>
          )}

          {overrides.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No upcoming day exceptions.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {overrides.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.override_date}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.allowed_work_locations?.includes("WFH") ? "WFH allowed" : "On site"}
                      {o.location_id
                        ? ` · ${locations.find((l) => l.id === o.location_id)?.name || "Custom place"}`
                        : ""}
                      {o.note ? ` · ${o.note}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteOverride(o.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Offices and client sites are shared across the workspace and managed in{" "}
          <Link href="/settings?tab=attendance" className="text-primary underline">
            Settings &rarr; Attendance &amp; Punch
          </Link>
          . Everything on this page applies to this employee only.
        </span>
      </div>
    </div>
  );
}
