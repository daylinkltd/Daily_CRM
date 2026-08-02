"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  Save,
  DollarSign,
  ShieldCheck,
  Loader2,
  Kanban
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/ui/icon-action";

export function ProjectsSettingsPanel() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [dailyCapacityHours, setDailyCapacityHours] = useState(8);
  const [enableTimesheetApproval, setEnableTimesheetApproval] = useState(true);
  const [autoLockDays, setAutoLockDays] = useState(7);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(50);
  const [enableOvertimeAlerts, setEnableOvertimeAlerts] = useState(true);
  const [requireTaskReview, setRequireTaskReview] = useState(false);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .maybeSingle();

      if (data?.plan_limits?.project_settings) {
        const ps = data.plan_limits.project_settings;
        setDailyCapacityHours(ps.dailyCapacityHours ?? 8);
        setEnableTimesheetApproval(ps.enableTimesheetApproval ?? true);
        setAutoLockDays(ps.autoLockDays ?? 7);
        setDefaultHourlyRate(ps.defaultHourlyRate ?? 50);
        setEnableOvertimeAlerts(ps.enableOvertimeAlerts ?? true);
        setRequireTaskReview(ps.requireTaskReview ?? false);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [activeWorkspace?.id, supabase]);

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);

    try {
      // Read current plan_limits JSON
      const { data: currentWs } = await supabase
        .from("workspaces")
        .select("plan_limits")
        .eq("id", activeWorkspace.id)
        .single();

      const existingLimits = currentWs?.plan_limits || {};
      const updatedLimits = {
        ...existingLimits,
        project_settings: {
          dailyCapacityHours,
          enableTimesheetApproval,
          autoLockDays,
          defaultHourlyRate,
          enableOvertimeAlerts,
          requireTaskReview,
          updated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("workspaces")
        .update({ plan_limits: updatedLimits })
        .eq("id", activeWorkspace.id);

      if (error) throw error;
      toast.success("Project Management settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save project settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading Project Settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl text-foreground">
      <SettingsPanelHead
        title="Project Management Settings"
        description="Configure workload capacity, timesheet approval workflows, task rules, and default billing rates."
        action={
          <IconAction label="Save Changes" icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-xs" />
        }
      />

      {/* 1. Workload & Capacity */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Clock className="size-4 text-primary" /> Workload & Daily Capacity
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Define team workload benchmarks and daily working thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Standard Daily Capacity (Hours/Day)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={dailyCapacityHours}
                onChange={(e) => setDailyCapacityHours(Number(e.target.value))}
                className="bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Used for calculating team workload utilization on Gantt & Planning views.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Hourly Billing Rate ($)</Label>
              <Input
                type="number"
                min={0}
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(Number(e.target.value))}
                className="bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Default billable rate applied when creating new project budgets.</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Overtime Capacity Alerts</Label>
              <p className="text-[11px] text-muted-foreground">Notify project managers when a team member is allocated over 100% capacity.</p>
            </div>
            <Switch
              checked={enableOvertimeAlerts}
              onCheckedChange={setEnableOvertimeAlerts}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Timesheet Approvals & Locking */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <ShieldCheck className="size-4 text-emerald-500" /> Timesheets & Governance
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enforce approval workflows and auto-locking for time logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Require Manager Approval for Timesheets</Label>
              <p className="text-[11px] text-muted-foreground">Logged hours must be approved by project manager before invoicing.</p>
            </div>
            <Switch
              checked={enableTimesheetApproval}
              onCheckedChange={setEnableTimesheetApproval}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Require Code Review / Quality Check for Tasks</Label>
              <p className="text-[11px] text-muted-foreground">Tasks moved to Done must first pass In-Review verification status.</p>
            </div>
            <Switch
              checked={requireTaskReview}
              onCheckedChange={setRequireTaskReview}
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label className="text-xs font-semibold">Auto-Lock Past Timesheets (Days)</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={autoLockDays}
              onChange={(e) => setAutoLockDays(Number(e.target.value))}
              className="bg-background text-xs max-w-xs"
            />
            <p className="text-[11px] text-muted-foreground">Prevent editing or deleting timesheet logs older than N days.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
