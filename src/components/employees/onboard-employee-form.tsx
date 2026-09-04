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
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { computeSalaryBreakdown, type SalaryComponent } from '@/lib/hr/salary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Briefcase, User, Users, Landmark, GraduationCap, Plus, Trash2 } from 'lucide-react';
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
  const [managerOptions, setManagerOptions] = useState<{ id: string; full_name: string }[]>([]);
  const [structures, setStructures] = useState<{ id: string; name: string }[]>([]);
  const [structureId, setStructureId] = useState('');
  const [structureComponents, setStructureComponents] = useState<SalaryComponent[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Form State - 1. Core & Employment
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [managerId, setManagerId] = useState('');
  const [salaryGrade, setSalaryGrade] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [workLocation, setWorkLocation] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [notes, setNotes] = useState('');

  // Form State - 2. Personal & Contact
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('MALE');
  const [bloodGroup, setBloodGroup] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('SINGLE');
  const [nationality, setNationality] = useState('Indian');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Form State - 3. Family & Nominees
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [familyMembers, setFamilyMembers] = useState<{ name: string; relation: string; dob?: string; phone?: string; isDependant?: boolean }[]>([
    { name: '', relation: 'Spouse', dob: '', phone: '', isDependant: true }
  ]);
  const [pfNomineeName, setPfNomineeName] = useState('');
  const [pfNomineeRelation, setPfNomineeRelation] = useState('');
  const [pfNomineeShare, setPfNomineeShare] = useState('100');
  const [esiNomineeName, setEsiNomineeName] = useState('');
  const [esiNomineeRelation, setEsiNomineeRelation] = useState('');
  const [esiNomineeShare, setEsiNomineeShare] = useState('100');

  // Form State - 4. Education & Experience
  const [highestQualification, setHighestQualification] = useState('');
  const [degreeName, setDegreeName] = useState('');
  const [instituteUniversity, setInstituteUniversity] = useState('');
  const [yearOfPassing, setYearOfPassing] = useState('');
  const [cgpaPercentage, setCgpaPercentage] = useState('');
  const [totalExperienceYears, setTotalExperienceYears] = useState('0');
  const [prevCompany, setPrevCompany] = useState('');
  const [prevDesignation, setPrevDesignation] = useState('');
  const [prevDuration, setPrevDuration] = useState('');

  // Form State - 5. Bank, Statutory & Salary Breakdown
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [uanNumber, setUanNumber] = useState('');
  const [pfAccountNumber, setPfAccountNumber] = useState('');
  const [esiIpNumber, setEsiIpNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');

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
      const { data: deps } = await supabase.from('departments').select('*').eq('workspace_id', activeWorkspace!.id);
      const { data: desigs } = await supabase.from('designations').select('*').eq('workspace_id', activeWorkspace!.id);
      
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

      const { data: profiles } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id')
        .eq('workspace_id', activeWorkspace!.id);

      const existingIds = new Set((profiles || []).map(p => p.workspace_member_id));
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
          manager_workspace_member_id: managerId || null,
          salary_grade: salaryGrade.trim() || null,
          address: address.trim() || null,
          permanent_address: permanentAddress.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          notes: notes.trim() || null,
          status,
          work_location: workLocation.trim() || null,
          notice_period_days: Number(noticePeriodDays) || 30,

          // Personal Details
          date_of_birth: dob || null,
          gender,
          blood_group: bloodGroup || null,
          marital_status: maritalStatus,
          nationality,
          personal_email: personalEmail.trim() || null,
          personal_phone: personalPhone.trim() || null,
          alternate_phone: alternatePhone.trim() || null,

          // Family & Nominee
          father_name: fatherName.trim() || null,
          mother_name: motherName.trim() || null,
          spouse_name: spouseName.trim() || null,
          family_details: familyMembers.filter(m => m.name.trim()).length > 0 ? familyMembers.filter(m => m.name.trim()) : null,
          pf_nominee_name: pfNomineeName.trim() || null,
          pf_nominee_relation: pfNomineeRelation.trim() || null,
          pf_nominee_share_pct: Number(pfNomineeShare) || 100,
          esi_nominee_name: esiNomineeName.trim() || null,
          esi_nominee_relation: esiNomineeRelation.trim() || null,
          esi_nominee_share_pct: Number(esiNomineeShare) || 100,

          // Education & Experience
          highest_qualification: highestQualification.trim() || null,
          total_experience_years: Number(totalExperienceYears) || 0,
          education_details: degreeName ? [{
            degree: degreeName.trim(),
            institute: instituteUniversity.trim(),
            year: yearOfPassing.trim(),
            score: cgpaPercentage.trim(),
          }] : null,
          previous_work_history: prevCompany ? [{
            company: prevCompany.trim(),
            designation: prevDesignation.trim(),
            duration: prevDuration.trim(),
          }] : null,

          // Bank & Statutory
          bank_name: bankName.trim() || null,
          bank_account_number: bankAccountNumber.trim() || null,
          bank_ifsc_code: bankIfscCode.trim() || null,
          bank_branch_name: bankBranch.trim() || null,
          pan_number: panNumber.trim() || null,
          aadhaar_number: aadhaarNumber.trim() || null,
          uan_number: uanNumber.trim() || null,
          pf_account_number: pfAccountNumber.trim() || null,
          esi_ip_number: esiIpNumber.trim() || null,
          passport_number: passportNumber.trim() || null,

          // Salary Breakdown
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
          ...(structureId ? {} : { professional_tax: Number(professionalTax) || 0 }),
          attendance_enabled: attendanceEnabled,
        });

      if (error) throw error;
      
      toast.success('Comprehensive Employee Master profile onboarded!');
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
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            HR Comprehensive Employee Master Onboarding
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Onboard new team member into Employee Master across Personal, Family, Statutory, Bank, and Salary sections.
          </DialogDescription>
        </DialogHeader>
        
        {loadingDeps ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <Tabs defaultValue="employment" className="w-full">
              <TabsList className="grid grid-cols-5 w-full bg-muted/60 text-xs">
                <TabsTrigger value="employment" className="text-xs gap-1"><Briefcase className="size-3.5" /> 1. Employment</TabsTrigger>
                <TabsTrigger value="personal" className="text-xs gap-1"><User className="size-3.5" /> 2. Personal</TabsTrigger>
                <TabsTrigger value="family" className="text-xs gap-1"><Users className="size-3.5" /> 3. Family & Nominee</TabsTrigger>
                <TabsTrigger value="education" className="text-xs gap-1"><GraduationCap className="size-3.5" /> 4. Edu & Exp</TabsTrigger>
                <TabsTrigger value="bank" className="text-xs gap-1"><Landmark className="size-3.5" /> 5. Bank & Statutory</TabsTrigger>
              </TabsList>

              {/* Tab 1: Core & Employment */}
              <TabsContent value="employment" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Select Workspace Member <span className="text-red-500">*</span></Label>
                  {availableMembers.length === 0 ? (
                    <div className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-md border border-amber-500/20">
                      No pending members available. Invite someone via Workspace Settings first.
                    </div>
                  ) : (
                    <Select value={memberId} onValueChange={(v) => setMemberId(v || '')} required>
                      <SelectTrigger className="bg-card border-border h-9 text-xs">
                        <SelectValue placeholder="Select a member to onboard..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">
                            {m.full_name} ({m.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee Code (ID)</Label>
                    <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="e.g. EMP-042" className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Department <span className="text-red-500">*</span></Label>
                    <Select value={departmentId} onValueChange={(v) => setDepartmentId(v || '')} required>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Department..." /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs cursor-pointer">{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Designation <span className="text-red-500">*</span></Label>
                    <Select value={designationId} onValueChange={(v) => setDesignationId(v || '')} required>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Designation..." /></SelectTrigger>
                      <SelectContent>
                        {designations.map(d => (
                          <SelectItem key={d.id} value={d.id} className="text-xs cursor-pointer">{d.title || d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Reporting Manager</Label>
                    <Select value={managerId} onValueChange={(v) => setManagerId(v || '')}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Manager..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Manager</SelectItem>
                        {managerOptions.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Joining Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Employment Type <span className="text-red-500">*</span></Label>
                    <Select value={employmentType} onValueChange={setEmploymentType} required>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_TIME">Full Time</SelectItem>
                        <SelectItem value="PART_TIME">Part Time</SelectItem>
                        <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                        <SelectItem value="INTERN">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Salary Grade / Band</Label>
                    <Input value={salaryGrade} onChange={(e) => setSalaryGrade(e.target.value)} placeholder="e.g. L3" className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Work Location</Label>
                    <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} placeholder="Head Office / Remote" className="h-9 text-xs" />
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Personal & Contact */}
              <TabsContent value="personal" className="space-y-3 pt-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Blood Group</Label>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Marital Status</Label>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SINGLE">Single</SelectItem>
                        <SelectItem value="MARRIED">Married</SelectItem>
                        <SelectItem value="DIVORCED">Divorced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Personal Email</Label>
                    <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="personal@gmail.com" className="h-9 text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Personal Phone</Label>
                    <Input value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} placeholder="+91 9876543210" className="h-9 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Residential Address</Label>
                    <RichTextArea plain rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Current residential address..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Permanent Hometown Address</Label>
                    <RichTextArea plain rows={2} value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} placeholder="Permanent hometown address..." />
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Family & Nominees */}
              <TabsContent value="family" className="space-y-3 pt-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Father's Name</Label>
                    <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mother's Name</Label>
                    <Input value={motherName} onChange={(e) => setMotherName(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spouse's Name</Label>
                    <Input value={spouseName} onChange={(e) => setSpouseName(e.target.value)} className="h-9 text-xs" />
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <Users className="size-3.5" /> Additional Family Members / Dependants
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => setFamilyMembers([...familyMembers, { name: '', relation: 'Child', dob: '', phone: '', isDependant: true }])}
                    >
                      <Plus className="size-3" /> Add Family Member
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {familyMembers.map((member, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 bg-muted/30 p-2 rounded-md items-center text-xs">
                        <div className="col-span-3">
                          <Input
                            placeholder="Member Name"
                            value={member.name}
                            onChange={(e) => {
                              const updated = [...familyMembers];
                              updated[idx].name = e.target.value;
                              setFamilyMembers(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={member.relation}
                            onValueChange={(val) => {
                              const updated = [...familyMembers];
                              updated[idx].relation = val;
                              setFamilyMembers(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Relation" /></SelectTrigger>
                            <SelectContent>
                              {['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'].map(r => (
                                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="date"
                            value={member.dob || ''}
                            onChange={(e) => {
                              const updated = [...familyMembers];
                              updated[idx].dob = e.target.value;
                              setFamilyMembers(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="Phone Number"
                            value={member.phone || ''}
                            onChange={(e) => {
                              const updated = [...familyMembers];
                              updated[idx].phone = e.target.value;
                              setFamilyMembers(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            disabled={familyMembers.length <= 1 && idx === 0}
                            onClick={() => {
                              setFamilyMembers(familyMembers.filter((_, i) => i !== idx));
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-2 text-xs">
                  <Label className="font-bold text-emerald-600">PF Nominee Details</Label>
                  <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-md">
                    <Input value={pfNomineeName} onChange={(e) => setPfNomineeName(e.target.value)} placeholder="Nominee Full Name" className="h-8 text-xs" />
                    <Input value={pfNomineeRelation} onChange={(e) => setPfNomineeRelation(e.target.value)} placeholder="Relationship (Spouse, Father...)" className="h-8 text-xs" />
                    <Input type="number" value={pfNomineeShare} onChange={(e) => setPfNomineeShare(e.target.value)} placeholder="Share % (100)" className="h-8 text-xs font-bold" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <Label className="font-bold text-blue-600">ESI Nominee Details</Label>
                  <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-md">
                    <Input value={esiNomineeName} onChange={(e) => setEsiNomineeName(e.target.value)} placeholder="Nominee Full Name" className="h-8 text-xs" />
                    <Input value={esiNomineeRelation} onChange={(e) => setEsiNomineeRelation(e.target.value)} placeholder="Relationship" className="h-8 text-xs" />
                    <Input type="number" value={esiNomineeShare} onChange={(e) => setEsiNomineeShare(e.target.value)} placeholder="Share % (100)" className="h-8 text-xs font-bold" />
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Education & Prior Experience */}
              <TabsContent value="education" className="space-y-3 pt-3">
                <div className="space-y-2">
                  <Label className="font-bold text-xs text-primary">Educational Qualification</Label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Highest Qualification</Label>
                      <Input value={highestQualification} onChange={(e) => setHighestQualification(e.target.value)} placeholder="e.g. B.Tech Computer Science / MBA" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Degree / Specialization</Label>
                      <Input value={degreeName} onChange={(e) => setDegreeName(e.target.value)} placeholder="e.g. Bachelor of Technology" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Institute / University</Label>
                      <Input value={instituteUniversity} onChange={(e) => setInstituteUniversity(e.target.value)} placeholder="e.g. Delhi University / IIT" className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Year of Passing</Label>
                        <Input value={yearOfPassing} onChange={(e) => setYearOfPassing(e.target.value)} placeholder="2022" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">CGPA / Percentage</Label>
                        <Input value={cgpaPercentage} onChange={(e) => setCgpaPercentage(e.target.value)} placeholder="8.5 / 85%" className="h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <Label className="font-bold text-xs text-primary">Prior Work Experience</Label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Total Experience (Years)</Label>
                      <Input type="number" value={totalExperienceYears} onChange={(e) => setTotalExperienceYears(e.target.value)} placeholder="3" className="h-8 text-xs font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Last Employer / Company</Label>
                      <Input value={prevCompany} onChange={(e) => setPrevCompany(e.target.value)} placeholder="e.g. Acme Tech Solutions" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Previous Designation</Label>
                      <Input value={prevDesignation} onChange={(e) => setPrevDesignation(e.target.value)} placeholder="e.g. Senior Software Engineer" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Duration & Details</Label>
                      <Input value={prevDuration} onChange={(e) => setPrevDuration(e.target.value)} placeholder="e.g. Jan 2021 - Aug 2023" className="h-8 text-xs" />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 5: Bank, Statutory & Salary Breakdown */}
              <TabsContent value="bank" className="space-y-3 pt-3">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Account Number</Label>
                    <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="501000..." className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">IFSC Code</Label>
                    <Input value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value)} placeholder="HDFC0000123" className="h-8 text-xs font-mono uppercase" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Branch Name</Label>
                    <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px]">PAN Number</Label>
                    <Input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} placeholder="ABCDE1234F" className="h-8 text-xs font-mono uppercase" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Aadhaar Number</Label>
                    <Input value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} placeholder="1234 5678 9012" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">UAN (PF Number)</Label>
                    <Input value={uanNumber} onChange={(e) => setUanNumber(e.target.value)} placeholder="100900..." className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Passport Number</Label>
                    <Input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className="h-8 text-xs font-mono uppercase" />
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <Label className="text-muted-foreground font-semibold mb-2 block text-xs">Salary Breakdown (Monthly)</Label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Basic Salary <span className="text-red-500">*</span></Label>
                      <Input type="number" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="25000" className="h-8 text-xs font-bold" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">HRA</Label>
                      <Input type="number" value={hra} onChange={(e) => setHra(e.target.value)} placeholder="10000" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Allowances</Label>
                      <Input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} placeholder="15000" className="h-8 text-xs" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-3 border-t border-border mt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !memberId || availableMembers.length === 0} className="text-xs font-bold bg-primary">
                {saving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Complete Onboarding
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
