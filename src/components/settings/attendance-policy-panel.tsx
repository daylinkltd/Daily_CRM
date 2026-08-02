"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  MapPin,
  Loader2,
  Save,
  Crosshair,
  ShieldCheck,
  ClipboardList,
  CalendarPlus,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { SettingsPanelHead } from "./settings-panel-head";
import { GeofenceMapPicker } from "@/components/attendance/geofence-map-picker";
import { WorkLocationsManager } from "./work-locations-manager";
import {
  WORK_LOCATIONS,
  WORK_LOCATION_LABELS,
  type WorkLocation,
} from "@/lib/attendance/policy";
import { IconAction } from "@/components/ui/icon-action";

type ScopeType = "WORKSPACE_DEFAULT" | "DEPARTMENT" | "MEMBER";

interface MemberOption {
  id: string;
  label: string;
}

/** Shape of a row in `hr_attendance_policies` (migration 086). */
interface PolicyRow {
  id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  allowed_work_locations: WorkLocation[] | null;
  default_work_location: WorkLocation | null;
  require_location: boolean | null;
  min_gps_accuracy_m: number | null;
  geofence_latitude: number | null;
  geofence_longitude: number | null;
  geofence_radius_m: number | null;
  geofence_label: string | null;
  block_outside_geofence: boolean | null;
  require_timesheet_on_punch_out: boolean | null;
  timesheet_template_id: string | null;
}

/** Shape of a row in `hr_attendance_day_overrides` (migration 086). */
interface OverrideRow {
  id: string;
  workspace_member_id: string;
  override_date: string;
  allowed_work_locations: WorkLocation[] | null;
  note: string | null;
}

/** Supabase errors and thrown values both reach the catch blocks here. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

const NONE = "none";

/** Blank policy used for a scope that has no row yet. */
const EMPTY_FORM = {
  allowed: ["OFFICE", "WFH"] as WorkLocation[],
  defaultLocation: "OFFICE" as WorkLocation,
  requireLocation: true,
  minAccuracy: "100",
  geofenceEnabled: false,
  lat: "",
  lng: "",
  radius: "100",
  label: "",
  blockOutside: false,
  requireTimesheet: false,
  timesheetTemplateId: NONE,
};

export function AttendancePolicyPanel() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can("people_manage") || can("settings_workspace");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);

  const [scopeType, setScopeType] = useState<ScopeType>("WORKSPACE_DEFAULT");
  const [scopeId, setScopeId] = useState<string>(NONE);
  const [form, setForm] = useState(EMPTY_FORM);

  // Day exceptions
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [ovMemberId, setOvMemberId] = useState<string>(NONE);
  const [ovDate, setOvDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [ovAllowWfh, setOvAllowWfh] = useState(true);
  const [ovNote, setOvNote] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [deptRes, memberRes, tplRes, policyRes, ovRes] = await Promise.all([
        supabase.from("departments").select("id, name").eq("workspace_id", activeWorkspace.id),
        supabase
          .from("workspace_members")
          .select("id, user_id")
          .eq("workspace_id", activeWorkspace.id),
        supabase
          .from("hr_timesheet_templates")
          .select("id, name, workspace_id")
          .or(`workspace_id.is.null,workspace_id.eq.${activeWorkspace.id}`)
          .order("name"),
        supabase
          .from("hr_attendance_policies")
          .select("*")
          .eq("workspace_id", activeWorkspace.id),
        supabase
          .from("hr_attendance_day_overrides")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .gte("override_date", new Date().toISOString().split("T")[0])
          .order("override_date"),
      ]);

      setDepartments(deptRes.data || []);
      setTemplates(tplRes.data || []);
      setPolicies((policyRes.data as PolicyRow[] | null) || []);
      setOverrides((ovRes.data as OverrideRow[] | null) || []);

      // workspace_members.user_id references auth.users, so a
      // workspace_members(profiles(...)) embed is impossible — the name has
      // to come from a second query keyed on user_id.
      const memberRows = memberRes.data || [];
      const userIds = memberRows.map((m) => m.user_id).filter(Boolean);
      let nameByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        nameByUser = new Map(
          (profiles || []).map((p) => [p.user_id as string, (p.full_name as string) || ""])
        );
      }
      setMembers(
        memberRows.map((m) => ({
          id: m.id as string,
          label: nameByUser.get(m.user_id as string) || "Unnamed member",
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load attendance policies");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activePolicy = useMemo(() => {
    const target = scopeType === "WORKSPACE_DEFAULT" ? null : scopeId === NONE ? null : scopeId;
    return policies.find(
      (p) => p.scope_type === scopeType && (p.scope_id ?? null) === target
    );
  }, [policies, scopeType, scopeId]);

  // Load the selected scope's saved values into the form, or reset to blank
  // when that scope has no policy yet.
  useEffect(() => {
    if (!activePolicy) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      allowed: (activePolicy.allowed_work_locations || ["OFFICE"]) as WorkLocation[],
      defaultLocation: (activePolicy.default_work_location || "OFFICE") as WorkLocation,
      requireLocation: activePolicy.require_location ?? true,
      minAccuracy: String(activePolicy.min_gps_accuracy_m ?? 100),
      geofenceEnabled: activePolicy.geofence_latitude != null,
      lat: activePolicy.geofence_latitude != null ? String(activePolicy.geofence_latitude) : "",
      lng: activePolicy.geofence_longitude != null ? String(activePolicy.geofence_longitude) : "",
      radius: String(activePolicy.geofence_radius_m ?? 100),
      label: activePolicy.geofence_label || "",
      blockOutside: activePolicy.block_outside_geofence ?? false,
      requireTimesheet: activePolicy.require_timesheet_on_punch_out ?? false,
      timesheetTemplateId: activePolicy.timesheet_template_id || NONE,
    });
  }, [activePolicy]);

  const toggleAllowed = (loc: WorkLocation) => {
    setForm((f) => {
      const has = f.allowed.includes(loc);
      // Never allow an empty set — the member would have nothing to punch in as.
      if (has && f.allowed.length === 1) return f;
      const allowed = has ? f.allowed.filter((l) => l !== loc) : [...f.allowed, loc];
      return {
        ...f,
        allowed,
        // The default must stay selectable.
        defaultLocation: allowed.includes(f.defaultLocation) ? f.defaultLocation : allowed[0],
      };
    });
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    if (scopeType !== "WORKSPACE_DEFAULT" && scopeId === NONE) {
      toast.error(
        `Select a specific ${scopeType === "DEPARTMENT" ? "department" : "team member"} first.`
      );
      return;
    }

    const minAccuracy = parseInt(form.minAccuracy || "0", 10);
    if (!Number.isFinite(minAccuracy) || minAccuracy <= 0) {
      toast.error("Required GPS accuracy must be a positive number of metres.");
      return;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let radius = parseInt(form.radius || "0", 10);
    if (form.geofenceEnabled) {
      lat = parseFloat(form.lat);
      lng = parseFloat(form.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        toast.error("Geofence latitude must be between -90 and 90.");
        return;
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        toast.error("Geofence longitude must be between -180 and 180.");
        return;
      }
      if (!Number.isFinite(radius) || radius <= 0) {
        toast.error("Geofence radius must be a positive number of metres.");
        return;
      }
    } else {
      radius = radius > 0 ? radius : 100;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: activeWorkspace.id,
        scope_type: scopeType,
        scope_id: scopeType === "WORKSPACE_DEFAULT" ? null : scopeId,
        allowed_work_locations: form.allowed,
        default_work_location: form.defaultLocation,
        require_location: form.requireLocation,
        min_gps_accuracy_m: minAccuracy,
        geofence_latitude: lat,
        geofence_longitude: lng,
        geofence_radius_m: radius,
        geofence_label: form.geofenceEnabled ? form.label || null : null,
        block_outside_geofence: form.geofenceEnabled ? form.blockOutside : false,
        require_timesheet_on_punch_out: form.requireTimesheet,
        timesheet_template_id:
          form.timesheetTemplateId === NONE ? null : form.timesheetTemplateId,
      };

      // Update in place when the scope already has a policy; the unique
      // indexes are partial, so onConflict cannot be used here.
      const { error } = activePolicy
        ? await supabase
            .from("hr_attendance_policies")
            .update(payload)
            .eq("id", activePolicy.id)
        : await supabase.from("hr_attendance_policies").insert(payload);

      if (error) throw error;
      toast.success("Attendance policy saved.");
      await fetchData();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save attendance policy"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!activeWorkspace?.id || ovMemberId === NONE) {
      toast.error("Select a team member for the exception.");
      return;
    }
    setSavingOverride(true);
    try {
      const { error } = await supabase.from("hr_attendance_day_overrides").upsert(
        {
          workspace_id: activeWorkspace.id,
          workspace_member_id: ovMemberId,
          override_date: ovDate,
          // A WFH day needs no location; an on-site day inherits the policy.
          allowed_work_locations: ovAllowWfh ? ["WFH", "OFFICE"] : ["OFFICE"],
          require_location: ovAllowWfh ? false : null,
          note: ovNote || null,
        },
        { onConflict: "workspace_member_id,override_date" }
      );
      if (error) throw error;
      toast.success("Day exception saved.");
      setOvNote("");
      await fetchData();
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to remove day exception"));
    }
  };

  const memberName = (id: string) => members.find((m) => m.id === id)?.label || "Unknown member";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <SettingsPanelHead
        title="Attendance & Punch Policy"
        description="Control which work locations each person can punch in as, how precise their GPS must be, and where they must physically be. Settings apply most-specific-first: a day exception beats a person's policy, which beats their department, which beats the workspace default."
        action={
          canManage ? (
            <IconAction label="Save policy" icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} onClick={handleSave} disabled={saving} className="gap-1.5" />
          ) : null
        }
      />

      {!canManage && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>You can view these policies but not change them. Ask an admin for the People permission.</span>
        </div>
      )}

      <div className="space-y-5">
        <WorkLocationsManager canEdit={canManage} />

        {/* Scope */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" /> Who this applies to
            </CardTitle>
            <CardDescription>
              Start with the workspace default, then add exceptions per department or per person.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scope</Label>
              <Select
                value={scopeType}
                onValueChange={(v) => {
                  setScopeType(v as ScopeType);
                  setScopeId(NONE);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORKSPACE_DEFAULT">Everyone (workspace default)</SelectItem>
                  <SelectItem value="DEPARTMENT">A department</SelectItem>
                  <SelectItem value="MEMBER">One person</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scopeType !== "WORKSPACE_DEFAULT" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {scopeType === "DEPARTMENT" ? "Department" : "Team member"}
                </Label>
                <Select value={scopeId} onValueChange={setScopeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Select…</SelectItem>
                    {(scopeType === "DEPARTMENT"
                      ? departments.map((d) => ({ id: d.id, label: d.name }))
                      : members
                    ).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="sm:col-span-2">
              <Badge variant="outline" className="text-[11px] font-medium">
                {activePolicy ? "Editing an existing policy" : "No policy yet for this scope — saving creates one"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Work locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> Allowed work locations
            </CardTitle>
            <CardDescription>
              The punch screen shows exactly these and nothing else. Tick only Office and an
              on-site employee never sees a Work From Home option.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {WORK_LOCATIONS.map((loc) => {
                const active = form.allowed.includes(loc);
                return (
                  <button
                    key={loc}
                    type="button"
                    disabled={!canManage}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Default selection</Label>
                <Select
                  value={form.defaultLocation}
                  onValueChange={(v) => setForm((f) => ({ ...f, defaultLocation: v as WorkLocation }))}
                  disabled={!canManage}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.allowed.map((loc) => (
                      <SelectItem key={loc} value={loc}>{WORK_LOCATION_LABELS[loc]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="size-4 text-primary" /> GPS requirement
            </CardTitle>
            <CardDescription>
              Work From Home never needs a location. For on-site punches, a fix coarser than your
              threshold is refused rather than recorded — that is what stops a wifi-derived
              position hundreds of kilometres away being stored as if it were real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Require a location for on-site punches</p>
                <p className="text-xs text-muted-foreground">
                  Applies to Office, Client Site and Field.
                </p>
              </div>
              <Switch
                checked={form.requireLocation}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requireLocation: v }))}
                disabled={!canManage}
              />
            </div>

            <div className="space-y-1.5 sm:max-w-xs">
              <Label className="text-xs font-semibold">Required accuracy (metres)</Label>
              <Input
                type="number"
                min={1}
                value={form.minAccuracy}
                onChange={(e) => setForm((f) => ({ ...f, minAccuracy: e.target.value }))}
                disabled={!canManage || !form.requireLocation}
              />
              <p className="text-[11px] text-muted-foreground">
                100m suits most offices. Below ~20m is unreliable indoors.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Geofence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> Geofence
            </CardTitle>
            <CardDescription>
              Restrict punching to a physical area. Leave off to record locations without
              enforcing a boundary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Enforce a location boundary</p>
                <p className="text-xs text-muted-foreground">Set a centre point and radius.</p>
              </div>
              <Switch
                checked={form.geofenceEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, geofenceEnabled: v }))}
                disabled={!canManage}
              />
            </div>

            {form.geofenceEnabled && (
              <>
                <GeofenceMapPicker
                  disabled={!canManage}
                  label={form.label || undefined}
                  value={{
                    latitude: form.lat === "" ? null : Number(form.lat),
                    longitude: form.lng === "" ? null : Number(form.lng),
                    radiusM: Number(form.radius) || 100,
                  }}
                  onChange={(next) =>
                    setForm((f) => ({
                      ...f,
                      lat: next.latitude == null ? "" : String(next.latitude),
                      lng: next.longitude == null ? "" : String(next.longitude),
                      radius: String(next.radiusM),
                    }))
                  }
                />

                <div className="space-y-1.5 sm:max-w-sm">
                  <Label className="text-xs font-semibold">Location name</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Head Office"
                    disabled={!canManage}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Block punches outside the boundary</p>
                    <p className="text-xs text-muted-foreground">
                      Off: the punch is recorded and flagged for you to review. On: it is refused.
                    </p>
                  </div>
                  <Switch
                    checked={form.blockOutside}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, blockOutside: v }))}
                    disabled={!canManage}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Punch out */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" /> Punch-out process
            </CardTitle>
            <CardDescription>
              Choose whether punching out asks for a timesheet, and which questions it asks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Ask for a timesheet on punch out</p>
                <p className="text-xs text-muted-foreground">
                  The form opens automatically once hours are logged.
                </p>
              </div>
              <Switch
                checked={form.requireTimesheet}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requireTimesheet: v }))}
                disabled={!canManage}
              />
            </div>

            <div className="space-y-1.5 sm:max-w-md">
              <Label className="text-xs font-semibold">Timesheet template</Label>
              <Select
                value={form.timesheetTemplateId}
                onValueChange={(v) => setForm((f) => ({ ...f, timesheetTemplateId: v }))}
                disabled={!canManage || !form.requireTimesheet}
              >
                <SelectTrigger><SelectValue placeholder="Select a template…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                A developer gets project and task fields; a salesperson gets CRM contacts and deals.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Day exceptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="size-4 text-primary" /> Day exceptions
            </CardTitle>
            <CardDescription>
              One-off changes for a single person on a single date — for example letting someone
              work from home just for Thursday. These beat every other policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage && (
              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">Team member</Label>
                  <Select value={ovMemberId} onValueChange={setOvMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select…</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date</Label>
                  <Input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <IconAction label="Add" icon={savingOverride ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CalendarPlus className="size-4" />
                    )} onClick={handleAddOverride}
                    disabled={savingOverride}
                    className="w-full gap-1.5" />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Allow working from home</p>
                    <p className="text-xs text-muted-foreground">No location needed that day.</p>
                  </div>
                  <Switch checked={ovAllowWfh} onCheckedChange={setOvAllowWfh} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
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
                      <p className="truncate text-sm font-medium">
                        {memberName(o.workspace_member_id)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.override_date}
                        {o.allowed_work_locations?.includes("WFH") ? " · WFH allowed" : ""}
                        {o.note ? ` · ${o.note}` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <IconAction
                        label="Delete"
                        icon={<Trash2 className="size-3.5" />}
                        variant="ghost"
                        onClick={() => handleDeleteOverride(o.id)}
                        className="text-muted-foreground hover:text-destructive"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
