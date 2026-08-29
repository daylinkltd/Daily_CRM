'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { computeSalaryBreakdown, type SalaryComponent } from '@/lib/hr/salary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { RichTextArea } from "@/components/ui/rich-textarea";

interface OnboardEmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function OnboardEmployeeForm({ open, onOpenChange, onSaved }: OnboardEmployeeFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loadingDeps, setLoadingDeps] = useState(true);
  
  // Data lists
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  // Managers must be people who ALREADY have an employee record — the
  // opposite of availableMembers, which holds only members not yet
  // onboarded.
  const [managerOptions, setManagerOptions] = useState<{ id: string; full_name: string }[]>([]);
  // Assigning a salary structure at hire derives HRA, allowances and the
  // statutory deductions from basic, instead of leaving someone to type
  // six figures by hand and get them inconsistent with the slab.
  const [structures, setStructures] = useState<{ id: string; name: string }[]>([]);
  const [structureId, setStructureId] = useState('');
  const [structureComponents, setStructureComponents] = useState<SalaryComponent[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Form State
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  // Present on the employee record and editable on the detail page, but
  // never collected at onboarding — so every new hire started with a
  // blank manager, grade, address and notes that someone had to go back
  // and fill in.
  const [managerId, setManagerId] = useState('');
  const [salaryGrade, setSalaryGrade] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  
  // Salary Breakdown
  const [basicSalary, setBasicSalary] = useState('');
  const [professionalTax, setProfessionalTax] = useState('');
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [hra, setHra] = useState('');
  const [allowances, setAllowances] = useState('');
  const [pfDeduction, setPfDeduction] = useState('');
  const [tds, setTds] = useState('');

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      loadDependencies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWorkspace?.id]);

  async function loadDependencies() {
    setLoadingDeps(true);
    try {
      // 1. Fetch departments
      const { data: deps } = await supabase.from('departments').select('*').eq('workspace_id', activeWorkspace!.id);
      
      // 2. Fetch designations
      const { data: desigs } = await supabase.from('designations').select('*').eq('workspace_id', activeWorkspace!.id);
      
      // 3. Fetch workspace members via API to guarantee full name & email resolution
      let members: any[] = [];
      try {
        const res = await fetch(`/api/account/members?workspace_id=${activeWorkspace!.id}`);
        if (res.ok) {
          const json = await res.json();
          members = json.members || [];
        }
      } catch (err) {
        console.warn('Members API fetch failed, using fallback:', err);
      }

      if (members.length === 0) {
        const { data: rawMembers } = await supabase
          .from('workspace_members')
          .select('id, user_id')
          .eq('workspace_id', activeWorkspace!.id);

        if (rawMembers && rawMembers.length > 0) {
          const userIds = rawMembers.map((m: any) => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
          const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
          members = rawMembers.map((m: any) => {
            const p = profileMap[m.user_id];
            return {
              id: m.id,
              user_id: m.user_id,
              full_name: p?.full_name?.trim() || p?.email?.split('@')[0] || 'Workspace Member',
              email: p?.email || null,
            };
          });
        }
      }

      // 4. Fetch existing employee profiles
      const { data: profiles } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id')
        .eq('workspace_id', activeWorkspace!.id);

      const existingIds = new Set((profiles || []).map(p => p.workspace_member_id));
      
      // Filter members who DO NOT have an employee profile yet
      const unassigned = members.filter(m => !existingIds.has(m.id));

      const { data: structs } = await supabase
        .from('hr_salary_structures')
        .select('id, name')
        .eq('workspace_id', activeWorkspace!.id)
        .is('deleted_at', null)
        .order('name');
      setStructures(structs || []);

      setDepartments(deps || []);
      setDesignations(desigs || []);
      setAvailableMembers(unassigned);
      setManagerOptions(members.filter(m => existingIds.has(m.id)));
    } catch {
      toast.error('Failed to load form requirements');
    } finally {
      setLoadingDeps(false);
    }
  }

  // Load the chosen structure's components so the breakdown can be derived.
  useEffect(() => {
    if (!structureId) { setStructureComponents([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('hr_salary_structure_components')
        .select('value_override, calculation_type, hr_salary_components(id, name, code, type, calculation_type, value_number, is_statutory, payroll_field, sort_order)')
        .eq('structure_id', structureId);
      if (cancelled) return;
      type JoinRow = {
        value_override: number | null;
        calculation_type: string | null;
        hr_salary_components: SalaryComponent | SalaryComponent[] | null;
      };
      setStructureComponents(
        ((data as JoinRow[] | null) || [])
          .map((row) => {
            // PostgREST returns an object for a to-one embed but an array
            // when it cannot prove cardinality.
            const comp = Array.isArray(row.hr_salary_components)
              ? row.hr_salary_components[0]
              : row.hr_salary_components;
            if (!comp) return null;
            return {
              ...comp,
              value_number: row.value_override ?? comp.value_number,
              calculation_type: (row.calculation_type ||
                comp.calculation_type) as SalaryComponent['calculation_type'],
            } as SalaryComponent;
          })
          .filter((c): c is SalaryComponent => c !== null)
      );
    })();
    return () => { cancelled = true; };
  }, [structureId, supabase]);

  const derived = useMemo(
    () => computeSalaryBreakdown(structureComponents, Number(basicSalary) || 0),
    [structureComponents, basicSalary]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !memberId || !departmentId || !designationId || !joiningDate) return;

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('employee_profiles')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: memberId,
          employee_code: employeeCode.trim() || null,
          department_id: departmentId,
          designation_id: designationId,
          joining_date: joiningDate,
          employment_type: employmentType,
          // Salary goes into the real columns (077) — payroll reads
          // exclusively from these. It used to be serialized as JSON
          // into the free-text salary_grade band field, which meant
          // every onboarded employee was silently excluded from
          // payroll runs.
          // A structure is authoritative: its derived figures replace the
          // manual boxes so the two can never disagree.
          ...(structureId
            ? { ...derived.payrollFields, salary_structure_id: structureId, ctc_annual: derived.ctcAnnual }
            : {
                basic_salary: Number(basicSalary) || 0,
                hra: Number(hra) || 0,
                special_allowance: Number(allowances) || 0,
                pf_deduction: Number(pfDeduction) || 0,
                tds_deduction: Number(tds) || 0,
              }),
          salary_effective_from: joiningDate || null,
          // professional_tax exists in 077 and the payroll processor reads
          // it, but this form never collected it — it silently stayed 0
          // for every onboarded employee.
          ...(structureId ? {} : { professional_tax: Number(professionalTax) || 0 }),
          attendance_enabled: attendanceEnabled,
          manager_workspace_member_id: managerId || null,
          salary_grade: salaryGrade.trim() || null,
          address: address.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          notes: notes.trim() || null,
          status
        });

      if (error) throw error;
      
      toast.success('Employee onboarded successfully!');
      
      // Reset form
      setMemberId('');
      setEmployeeCode('');
      setDepartmentId('');
      setDesignationId('');
      setJoiningDate('');
      setBasicSalary('');
      setHra('');
      setAllowances('');
      setPfDeduction('');
      setTds('');
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard employee');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            HR Onboarding
          </DialogTitle>
        </DialogHeader>
        
        {loadingDeps ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            
            <div className="space-y-2">
              <Label>Select Workspace Member <span className="text-red-500">*</span></Label>
              {availableMembers.length === 0 ? (
                <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-md border border-amber-500/20">
                  No pending members available. Invite someone via Workspace Settings first.
                </div>
              ) : (
                <Select value={memberId} onValueChange={(v) => setMemberId(v || '')} required>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select a member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map(m => {
                      const rawName = m.full_name?.trim() || (Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name);
                      const email = m.email || (Array.isArray(m.profiles) ? m.profiles[0]?.email : m.profiles?.email);

                      let name = rawName;
                      if (!name || ['workspace member', 'member', 'user', 'unknown user'].includes(name.toLowerCase())) {
                        if (email) {
                          const local = email.split('@')[0];
                          name = local.charAt(0).toUpperCase() + local.slice(1);
                        } else {
                          name = `Member (${m.id.slice(0, 6)})`;
                        }
                      }

                      return (
                        <SelectItem key={m.id} value={m.id}>
                          {name} {email && !name.toLowerCase().includes(email.toLowerCase()) ? `(${email})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Employee Code (ID)</Label>
              <Input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP-042"
                className="bg-card border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department <span className="text-red-500">*</span></Label>
                <Select value={departmentId} onValueChange={(v) => setDepartmentId(v || '')} required>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Designation <span className="text-red-500">*</span></Label>
                <Select value={designationId} onValueChange={(v) => setDesignationId(v || '')} required>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.title || d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reporting Manager</Label>
                <Select value={managerId} onValueChange={(v) => setManagerId(v || '')}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="No manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.length === 0 ? (
                      <SelectItem value="" disabled>
                        No onboarded employees yet
                      </SelectItem>
                    ) : (
                      managerOptions.map((m: { id: string; full_name: string }) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v || 'ACTIVE')}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PROBATION">Probation</SelectItem>
                    <SelectItem value="NOTICE_PERIOD">Notice period</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Salary Grade / Band</Label>
                <Input
                  value={salaryGrade}
                  onChange={(e) => setSalaryGrade(e.target.value)}
                  placeholder="e.g. L3"
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Emergency Contact</Label>
                <Input
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name and phone"
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Residential address"
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Notes</Label>
                {/* `plain`: stored as text and rendered as text on the
                    employee record, so the rich-text editor would wrap it
                    in HTML that then shows as markup. */}
                <RichTextArea
                  plain
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything HR should know"
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Joining Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="bg-card border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Type <span className="text-red-500">*</span></Label>
                <Select value={employmentType} onValueChange={(v) => setEmploymentType(v || '')} required>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full Time</SelectItem>
                    <SelectItem value="PART_TIME">Part Time</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <Label className="text-muted-foreground font-semibold mb-3 block">Salary Breakdown (Monthly)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Basic Salary <span className="text-red-500">*</span></Label>
                  <Input type="number" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="e.g. 25000" className="bg-card border-border" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Attendance tracking</p>
                      <p className="text-xs text-muted-foreground">
                        Leave off for people who do not clock in — they never see the punch controls.
                      </p>
                    </div>
                    <Switch checked={attendanceEnabled} onCheckedChange={setAttendanceEnabled} />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Salary Structure</Label>
                  <Select value={structureId} onValueChange={(v) => setStructureId(v || '')}>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="None — enter the amounts by hand" />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.length === 0 ? (
                        <SelectItem value="" disabled>No structures defined yet</SelectItem>
                      ) : (
                        structures.map((st) => (
                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {structureId && (
                    <p className="text-[11px] text-muted-foreground">
                      Derived from basic: gross {derived.grossMonthly.toLocaleString()} ·
                      deductions {derived.totalDeductions.toLocaleString()} ·
                      net {derived.netMonthly.toLocaleString()} · CTC{' '}
                      {derived.ctcAnnual.toLocaleString()}/yr. The boxes below are ignored while a
                      structure is selected.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Professional Tax</Label>
                  <Input type="number" value={professionalTax} onChange={(e) => setProfessionalTax(e.target.value)} placeholder="e.g. 200" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>HRA (House Rent)</Label>
                  <Input type="number" value={hra} onChange={(e) => setHra(e.target.value)} placeholder="e.g. 10000" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Special Allowances / LTA</Label>
                  <Input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} placeholder="e.g. 15000" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>PF Deduction</Label>
                  <Input type="number" value={pfDeduction} onChange={(e) => setPfDeduction(e.target.value)} placeholder="e.g. 1800" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>TDS (Income Tax)</Label>
                  <Input type="number" value={tds} onChange={(e) => setTds(e.target.value)} placeholder="e.g. 2000" className="bg-card border-border" />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-muted-foreground hover:bg-muted"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={saving || !memberId || availableMembers.length === 0}
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Complete Onboarding
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
