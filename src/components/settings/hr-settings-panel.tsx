"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  Clock,
  Calendar,
  Banknote,
  Loader2,
  Save,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SalaryStructuresManager } from "./salary-structures-manager";

type ScopeType = 'WORKSPACE_DEFAULT' | 'DEPARTMENT' | 'DESIGNATION';

export function HRSettingsPanel() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('settings_workspace') || can('people_manage');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [existingSettings, setExistingSettings] = useState<any[]>([]);

  // Selected Scope State
  const [scopeType, setScopeType] = useState<ScopeType>('WORKSPACE_DEFAULT');
  const [scopeId, setScopeId] = useState<string>('none');

  // Operational Settings Form State
  // 1. Attendance
  const [shiftStart, setShiftStart] = useState('09:30');
  const [shiftEnd, setShiftEnd] = useState('18:30');
  const [gracePeriod, setGracePeriod] = useState('15');
  const [halfDayHours, setHalfDayHours] = useState('4');

  // 2. Leave
  const [casualLeaveQuota, setCasualLeaveQuota] = useState('12');
  const [sickLeaveQuota, setSickLeaveQuota] = useState('12');
  const [annualLeaveQuota, setAnnualLeaveQuota] = useState('18');
  const [monthlyAccrual, setMonthlyAccrual] = useState('1.5');
  const [maxCarryForward, setMaxCarryForward] = useState('5');

  // 3. Payroll
  const [payCycleDay, setPayCycleDay] = useState('28');
  const [basicPct, setBasicPct] = useState('50');
  const [hraPct, setHraPct] = useState('20');
  const [pfRatePct, setPfRatePct] = useState('12');

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const [deptRes, desigRes, settingsRes] = await Promise.all([
        supabase.from('departments').select('id, name').eq('workspace_id', activeWorkspace.id),
        supabase.from('designations').select('id, title').eq('workspace_id', activeWorkspace.id),
        supabase.from('hr_operational_settings').select('*').eq('workspace_id', activeWorkspace.id)
      ]);

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setExistingSettings(settingsRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load HR settings');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update form fields based on selected scope
  useEffect(() => {
    const targetScopeId = scopeType === 'WORKSPACE_DEFAULT' ? null : (scopeId === 'none' ? null : scopeId);

    // Filter settings for current scope
    const att = existingSettings.find(s => s.setting_type === 'ATTENDANCE_SHIFT' && s.scope_type === scopeType && s.scope_id === targetScopeId);
    const lve = existingSettings.find(s => s.setting_type === 'LEAVE_RULES' && s.scope_type === scopeType && s.scope_id === targetScopeId);
    const pay = existingSettings.find(s => s.setting_type === 'PAYROLL_CONFIG' && s.scope_type === scopeType && s.scope_id === targetScopeId);

    if (att?.settings_json) {
      setShiftStart(att.settings_json.shift_start || '09:30');
      setShiftEnd(att.settings_json.shift_end || '18:30');
      setGracePeriod(att.settings_json.grace_period_minutes?.toString() || '15');
      setHalfDayHours(att.settings_json.half_day_threshold_hours?.toString() || '4');
    } else {
      setShiftStart('09:30');
      setShiftEnd('18:30');
      setGracePeriod('15');
      setHalfDayHours('4');
    }

    if (lve?.settings_json) {
      setCasualLeaveQuota(lve.settings_json.casual_leave_quota?.toString() || '12');
      setSickLeaveQuota(lve.settings_json.sick_leave_quota?.toString() || '12');
      setAnnualLeaveQuota(lve.settings_json.annual_leave_quota?.toString() || '18');
      setMonthlyAccrual(lve.settings_json.monthly_accrual_rate?.toString() || '1.5');
      setMaxCarryForward(lve.settings_json.max_carry_forward?.toString() || '5');
    } else {
      setCasualLeaveQuota('12');
      setSickLeaveQuota('12');
      setAnnualLeaveQuota('18');
      setMonthlyAccrual('1.5');
      setMaxCarryForward('5');
    }

    if (pay?.settings_json) {
      setPayCycleDay(pay.settings_json.pay_cycle_day?.toString() || '28');
      setBasicPct(pay.settings_json.basic_percentage?.toString() || '50');
      setHraPct(pay.settings_json.hra_percentage?.toString() || '20');
      setPfRatePct(pay.settings_json.pf_rate_percentage?.toString() || '12');
    } else {
      setPayCycleDay('28');
      setBasicPct('50');
      setHraPct('20');
      setPfRatePct('12');
    }
  }, [scopeType, scopeId, existingSettings]);

  const handleSaveSettings = async () => {
    if (!activeWorkspace?.id) return;
    if (scopeType !== 'WORKSPACE_DEFAULT' && scopeId === 'none') {
      toast.error('Please select a specific Department or Designation');
      return;
    }

    setSaving(true);
    const targetScopeId = scopeType === 'WORKSPACE_DEFAULT' ? null : scopeId;

    try {
      const attendanceJson = {
        shift_start: shiftStart,
        shift_end: shiftEnd,
        grace_period_minutes: parseInt(gracePeriod || '0'),
        half_day_threshold_hours: parseFloat(halfDayHours || '0')
      };

      const leaveJson = {
        casual_leave_quota: parseInt(casualLeaveQuota || '0'),
        sick_leave_quota: parseInt(sickLeaveQuota || '0'),
        annual_leave_quota: parseInt(annualLeaveQuota || '0'),
        monthly_accrual_rate: parseFloat(monthlyAccrual || '0'),
        max_carry_forward: parseInt(maxCarryForward || '0')
      };

      const payrollJson = {
        pay_cycle_day: parseInt(payCycleDay || '28'),
        basic_percentage: parseFloat(basicPct || '0'),
        hra_percentage: parseFloat(hraPct || '0'),
        pf_rate_percentage: parseFloat(pfRatePct || '0')
      };

      // Save all 3 setting types for this scope
      await Promise.all([
        fetch('/api/hr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            settingType: 'ATTENDANCE_SHIFT',
            scopeType,
            scopeId: targetScopeId,
            settingsJson: attendanceJson
          })
        }),
        fetch('/api/hr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            settingType: 'LEAVE_RULES',
            scopeType,
            scopeId: targetScopeId,
            settingsJson: leaveJson
          })
        }),
        fetch('/api/hr/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            settingType: 'PAYROLL_CONFIG',
            scopeType,
            scopeId: targetScopeId,
            settingsJson: payrollJson
          })
        })
      ]);

      toast.success('HR Operational Settings saved successfully');
      fetchData(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="HR Operations & Shift Settings"
        description="Configure attendance shift timings, grace periods, leave accrual rules, and payroll processing cycles with Department/Designation overrides."
      />

      {/* Scope Selector Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Configuration Scope & Overrides
          </CardTitle>
          <CardDescription>
            Choose whether to edit Company Global Defaults or set specific overrides for a Department or Designation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Setting Scope Level</Label>
            <Select value={scopeType} onValueChange={(val) => { setScopeType(val as ScopeType); setScopeId('none'); }}>
              <SelectTrigger className="bg-popover border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKSPACE_DEFAULT">Company Global Default (All Members)</SelectItem>
                <SelectItem value="DEPARTMENT">Department Specific Override</SelectItem>
                <SelectItem value="DESIGNATION">Designation Specific Override</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scopeType === 'DEPARTMENT' && (
            <div className="space-y-2">
              <Label>Select Target Department</Label>
              <Select value={scopeId} onValueChange={(val) => setScopeId(val || 'none')}>
                <SelectTrigger className="bg-popover border-border"><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select Department --</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scopeType === 'DESIGNATION' && (
            <div className="space-y-2">
              <Label>Select Target Designation</Label>
              <Select value={scopeId} onValueChange={(val) => setScopeId(val || 'none')}>
                <SelectTrigger className="bg-popover border-border"><SelectValue placeholder="Select Designation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select Designation --</SelectItem>
                  {designations.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational Settings Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Attendance & Shift Settings */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4 text-emerald-500" /> Attendance & Shifts
            </CardTitle>
            <CardDescription>Shift hours & grace periods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shift Start Time</Label>
              <Input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Shift End Time</Label>
              <Input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Grace Period (Minutes)</Label>
              <Input type="number" min="0" value={gracePeriod} onChange={e => setGracePeriod(e.target.value)} placeholder="15" className="bg-popover" />
              <p className="text-[11px] text-muted-foreground">Late punch status triggered after grace period.</p>
            </div>

            <div className="space-y-2">
              <Label>Half-Day Threshold (Hours)</Label>
              <Input type="number" min="1" step="0.5" value={halfDayHours} onChange={e => setHalfDayHours(e.target.value)} placeholder="4" className="bg-popover" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Leave Rules & Accrual */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4 text-blue-500" /> Leave Rules & Quotas
            </CardTitle>
            <CardDescription>Annual leave quotas & accruals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Casual Leave Annual Quota</Label>
              <Input type="number" min="0" value={casualLeaveQuota} onChange={e => setCasualLeaveQuota(e.target.value)} className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Sick Leave Annual Quota</Label>
              <Input type="number" min="0" value={sickLeaveQuota} onChange={e => setSickLeaveQuota(e.target.value)} className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Annual Paid Leave Quota</Label>
              <Input type="number" min="0" value={annualLeaveQuota} onChange={e => setAnnualLeaveQuota(e.target.value)} className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Monthly Accrual Rate (Days/Month)</Label>
              <Input type="number" min="0" step="0.5" value={monthlyAccrual} onChange={e => setMonthlyAccrual(e.target.value)} placeholder="1.5" className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Max Carry-Forward Limit</Label>
              <Input type="number" min="0" value={maxCarryForward} onChange={e => setMaxCarryForward(e.target.value)} placeholder="5" className="bg-popover" />
            </div>
          </CardContent>
        </Card>

        {/* 3. Payroll Cycle & Ratios */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="size-4 text-purple-500" /> Payroll & Components
            </CardTitle>
            <CardDescription>Pay dates & earnings ratios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Pay Cycle Date</Label>
              <Input type="number" min="1" max="31" value={payCycleDay} onChange={e => setPayCycleDay(e.target.value)} placeholder="28" className="bg-popover" />
              <p className="text-[11px] text-muted-foreground">Day of the month salaries are calculated.</p>
            </div>

            <div className="space-y-2">
              <Label>Basic Salary Ratio (%)</Label>
              <Input type="number" min="0" max="100" value={basicPct} onChange={e => setBasicPct(e.target.value)} placeholder="50" className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>House Rent Allowance (HRA) (%)</Label>
              <Input type="number" min="0" max="100" value={hraPct} onChange={e => setHraPct(e.target.value)} placeholder="20" className="bg-popover" />
            </div>

            <div className="space-y-2">
              <Label>Provident Fund (PF) Rate (%)</Label>
              <Input type="number" min="0" max="100" value={pfRatePct} onChange={e => setPfRatePct(e.target.value)} placeholder="12" className="bg-popover" />
            </div>
          </CardContent>
        </Card>

      </div>

      {canManage && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSaveSettings} disabled={saving} className="bg-primary text-primary-foreground shadow-sm">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Save Operational Settings
          </Button>
        </div>
      )}

      <div className="pt-8 mt-2 border-t border-border">
        <SettingsPanelHead
          title="Salary structures"
          description="Define reusable pay slabs and the components they are built from. Assign a structure to an employee on their Compensation tab and the full breakdown is derived from their basic salary."
        />
        <SalaryStructuresManager canEdit={canManage} />
      </div>
    </div>
  );
}
