import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { assertAffected } from '@/lib/supabase/affected-rows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Save, User, Users, Landmark, GraduationCap, Briefcase, Calendar, ShieldCheck, MapPin, Phone, Mail } from 'lucide-react';
import { useMemberDirectory } from '@/hooks/use-member-directory';
import { RichTextArea } from "@/components/ui/rich-textarea";

interface EmployeeProfileOverviewProps {
  employee: any;
  departments: any[];
  designations: any[];
  managers: any[];
  canEdit: boolean;
  onSaved: () => void;
}

export function EmployeeProfileOverview({ 
  employee, 
  departments, 
  designations, 
  managers,
  canEdit, 
  onSaved 
}: EmployeeProfileOverviewProps) {
  const supabase = createClient();
  const directory = useMemberDirectory();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    // 1. Core Employment Details
    employee_code: employee.employee_code || '',
    department_id: employee.department_id || 'none',
    designation_id: employee.designation_id || 'none',
    manager_workspace_member_id: employee.manager_workspace_member_id || 'none',
    joining_date: employee.joining_date || '',
    employment_type: employee.employment_type || 'FULL_TIME',
    salary_grade: employee.salary_grade || '',
    status: employee.status || 'ACTIVE',
    work_location: employee.work_location || '',
    probation_end_date: employee.probation_end_date || '',
    confirmation_date: employee.confirmation_date || '',
    notice_period_days: employee.notice_period_days ?? 30,

    // 2. Personal & Contact Details
    date_of_birth: employee.date_of_birth || '',
    gender: employee.gender || 'MALE',
    blood_group: employee.blood_group || '',
    marital_status: employee.marital_status || 'SINGLE',
    nationality: employee.nationality || 'Indian',
    personal_email: employee.personal_email || '',
    personal_phone: employee.personal_phone || '',
    alternate_phone: employee.alternate_phone || '',
    address: employee.address || '',
    permanent_address: employee.permanent_address || '',

    // 3. Family & Nominee Details
    father_name: employee.father_name || '',
    mother_name: employee.mother_name || '',
    spouse_name: employee.spouse_name || '',
    pf_nominee_name: employee.pf_nominee_name || '',
    pf_nominee_relation: employee.pf_nominee_relation || '',
    pf_nominee_dob: employee.pf_nominee_dob || '',
    pf_nominee_share_pct: employee.pf_nominee_share_pct ?? 100,
    esi_nominee_name: employee.esi_nominee_name || '',
    esi_nominee_relation: employee.esi_nominee_relation || '',
    esi_nominee_share_pct: employee.esi_nominee_share_pct ?? 100,
    gratuity_nominee_name: employee.gratuity_nominee_name || '',
    gratuity_nominee_relation: employee.gratuity_nominee_relation || '',
    gratuity_nominee_share_pct: employee.gratuity_nominee_share_pct ?? 100,

    // 4. Bank & Statutory Identifiers
    bank_name: employee.bank_name || '',
    bank_account_number: employee.bank_account_number || '',
    bank_ifsc_code: employee.bank_ifsc_code || '',
    bank_branch_name: employee.bank_branch_name || '',
    bank_account_type: employee.bank_account_type || 'SAVINGS',
    pan_number: employee.pan_number || '',
    aadhaar_number: employee.aadhaar_number || '',
    uan_number: employee.uan_number || '',
    pf_account_number: employee.pf_account_number || '',
    esi_ip_number: employee.esi_ip_number || '',
    passport_number: employee.passport_number || '',
    passport_expiry_date: employee.passport_expiry_date || '',

    // 5. Educational Qualifications & Experience
    highest_qualification: employee.highest_qualification || '',
    total_experience_years: employee.total_experience_years || 0,

    // 6. Notes
    notes: employee.notes || ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);

    try {
      const payload = {
        ...formData,
        department_id: formData.department_id === 'none' ? null : formData.department_id,
        designation_id: formData.designation_id === 'none' ? null : formData.designation_id,
        manager_workspace_member_id: formData.manager_workspace_member_id === 'none' ? null : formData.manager_workspace_member_id,
        joining_date: formData.joining_date || null,
        date_of_birth: formData.date_of_birth || null,
        probation_end_date: formData.probation_end_date || null,
        confirmation_date: formData.confirmation_date || null,
        passport_expiry_date: formData.passport_expiry_date || null,
        pf_nominee_dob: formData.pf_nominee_dob || null,
        total_experience_years: Number(formData.total_experience_years) || 0,
        notice_period_days: Number(formData.notice_period_days) || 30
      };

      const result = await supabase
        .from('employee_profiles')
        .update(payload)
        .eq('workspace_member_id', employee.workspace_member_id)
        .select('workspace_member_id');

      assertAffected(result, 'this employee profile', 'save');
      toast.success('Comprehensive Employee Master profile updated');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="core" className="w-full">
        <TabsList className="bg-muted/60 border border-border p-1 w-full justify-start overflow-x-auto text-xs">
          <TabsTrigger value="core" className="text-xs gap-1.5"><Briefcase className="size-3.5" /> 1. Employment</TabsTrigger>
          <TabsTrigger value="personal" className="text-xs gap-1.5"><User className="size-3.5" /> 2. Personal & Address</TabsTrigger>
          <TabsTrigger value="family" className="text-xs gap-1.5"><Users className="size-3.5" /> 3. Family & Nominees</TabsTrigger>
          <TabsTrigger value="statutory" className="text-xs gap-1.5"><Landmark className="size-3.5" /> 4. Bank & Statutory</TabsTrigger>
          <TabsTrigger value="education" className="text-xs gap-1.5"><GraduationCap className="size-3.5" /> 5. Edu & Experience</TabsTrigger>
        </TabsList>

        {/* Tab 1: Core Employment Details */}
        <TabsContent value="core" className="pt-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2 text-primary">
              <Briefcase className="size-4" /> Core Employment & Work Location Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Employee ID (Code)</Label>
                <Input value={formData.employee_code} onChange={(e) => handleChange('employee_code', e.target.value)} disabled={!canEdit} placeholder="EMP-0001" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Employment Status</Label>
                <Select disabled={!canEdit} value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PROBATION">Probation</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                    <SelectItem value="NOTICE_PERIOD">Notice Period</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Employment Type</Label>
                <Select disabled={!canEdit} value={formData.employment_type} onValueChange={(val) => handleChange('employment_type', val)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full Time</SelectItem>
                    <SelectItem value="PART_TIME">Part Time</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select disabled={!canEdit} value={formData.department_id} onValueChange={(val) => handleChange('department_id', val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Designation</Label>
                <Select disabled={!canEdit} value={formData.designation_id} onValueChange={(val) => handleChange('designation_id', val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Designation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {designations.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reporting Manager</Label>
                <Select disabled={!canEdit} value={formData.manager_workspace_member_id} onValueChange={(val) => handleChange('manager_workspace_member_id', val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {managers.filter(m => m.workspace_member_id !== employee.workspace_member_id).map(m => (
                      <SelectItem key={m.workspace_member_id} value={m.workspace_member_id}>
                        {directory.nameFor(m.workspace_members?.user_id ?? m.workspace_member_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Joining Date</Label>
                <Input type="date" value={formData.joining_date} onChange={(e) => handleChange('joining_date', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Probation End Date</Label>
                <Input type="date" value={formData.probation_end_date} onChange={(e) => handleChange('probation_end_date', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Confirmation Date</Label>
                <Input type="date" value={formData.confirmation_date} onChange={(e) => handleChange('confirmation_date', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Work Location / Branch</Label>
                <Input value={formData.work_location} onChange={(e) => handleChange('work_location', e.target.value)} disabled={!canEdit} placeholder="Head Office, Branch #2" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Salary Grade / Band</Label>
                <Input value={formData.salary_grade} onChange={(e) => handleChange('salary_grade', e.target.value)} disabled={!canEdit} placeholder="e.g. L3 / Senior" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notice Period (Days)</Label>
                <Input type="number" value={formData.notice_period_days} onChange={(e) => handleChange('notice_period_days', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">HR Notes & Performance Comments</Label>
              <RichTextArea value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} disabled={!canEdit} rows={3} placeholder="Internal HR operational notes..." />
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Personal & Contact Details */}
        <TabsContent value="personal" className="pt-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2 text-primary">
              <User className="size-4" /> Personal Profile, Identification & Addresses
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Birth</Label>
                <Input type="date" value={formData.date_of_birth} onChange={(e) => handleChange('date_of_birth', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select disabled={!canEdit} value={formData.gender} onValueChange={(val) => handleChange('gender', val)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Blood Group</Label>
                <Select disabled={!canEdit} value={formData.blood_group} onValueChange={(val) => handleChange('blood_group', val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Blood Group..." /></SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Marital Status</Label>
                <Select disabled={!canEdit} value={formData.marital_status} onValueChange={(val) => handleChange('marital_status', val)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single</SelectItem>
                    <SelectItem value="MARRIED">Married</SelectItem>
                    <SelectItem value="DIVORCED">Divorced</SelectItem>
                    <SelectItem value="WIDOWED">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Nationality</Label>
                <Input value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Personal Email</Label>
                <Input type="email" value={formData.personal_email} onChange={(e) => handleChange('personal_email', e.target.value)} disabled={!canEdit} placeholder="personal@gmail.com" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Personal Phone</Label>
                <Input value={formData.personal_phone} onChange={(e) => handleChange('personal_phone', e.target.value)} disabled={!canEdit} placeholder="+91 9876543210" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Alternate Contact Phone</Label>
                <Input value={formData.alternate_phone} onChange={(e) => handleChange('alternate_phone', e.target.value)} disabled={!canEdit} placeholder="+91 9123456789" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="size-3.5 text-primary" /> Present Residential Address</Label>
                <RichTextArea value={formData.address} onChange={(e) => handleChange('address', e.target.value)} disabled={!canEdit} rows={2} placeholder="Current rented / residential address..." />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="size-3.5 text-emerald-500" /> Permanent Hometown Address</Label>
                <RichTextArea value={formData.permanent_address} onChange={(e) => handleChange('permanent_address', e.target.value)} disabled={!canEdit} rows={2} placeholder="Permanent hometown address..." />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Family & Nominees */}
        <TabsContent value="family" className="pt-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2 text-primary">
              <Users className="size-4" /> Family Information & Statutory Nominees
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Father's Name</Label>
                <Input value={formData.father_name} onChange={(e) => handleChange('father_name', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Mother's Name</Label>
                <Input value={formData.mother_name} onChange={(e) => handleChange('mother_name', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Spouse's Name</Label>
                <Input value={formData.spouse_name} onChange={(e) => handleChange('spouse_name', e.target.value)} disabled={!canEdit} className="h-9" />
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3 text-xs">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-emerald-600">Statutory Nominees (PF, ESI & Gratuity)</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">PF Nominee Name</Label>
                  <Input value={formData.pf_nominee_name} onChange={(e) => handleChange('pf_nominee_name', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Relationship</Label>
                  <Input value={formData.pf_nominee_relation} onChange={(e) => handleChange('pf_nominee_relation', e.target.value)} disabled={!canEdit} placeholder="Spouse, Father..." className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Nominee DOB</Label>
                  <Input type="date" value={formData.pf_nominee_dob} onChange={(e) => handleChange('pf_nominee_dob', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">PF Share %</Label>
                  <Input type="number" value={formData.pf_nominee_share_pct} onChange={(e) => handleChange('pf_nominee_share_pct', e.target.value)} disabled={!canEdit} className="h-8 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">ESI Nominee Name</Label>
                  <Input value={formData.esi_nominee_name} onChange={(e) => handleChange('esi_nominee_name', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">ESI Nominee Relation</Label>
                  <Input value={formData.esi_nominee_relation} onChange={(e) => handleChange('esi_nominee_relation', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">ESI Share %</Label>
                  <Input type="number" value={formData.esi_nominee_share_pct} onChange={(e) => handleChange('esi_nominee_share_pct', e.target.value)} disabled={!canEdit} className="h-8 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Gratuity Nominee Name</Label>
                  <Input value={formData.gratuity_nominee_name} onChange={(e) => handleChange('gratuity_nominee_name', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Gratuity Relation</Label>
                  <Input value={formData.gratuity_nominee_relation} onChange={(e) => handleChange('gratuity_nominee_relation', e.target.value)} disabled={!canEdit} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Gratuity Share %</Label>
                  <Input type="number" value={formData.gratuity_nominee_share_pct} onChange={(e) => handleChange('gratuity_nominee_share_pct', e.target.value)} disabled={!canEdit} className="h-8 font-bold" />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Bank & Statutory Details */}
        <TabsContent value="statutory" className="pt-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2 text-primary">
              <Landmark className="size-4" /> Banking Payout Details & Government Statutory IDs
            </h3>

            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-blue-600">Bank Payout Account Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Name</Label>
                  <Input value={formData.bank_name} onChange={(e) => handleChange('bank_name', e.target.value)} disabled={!canEdit} placeholder="e.g. HDFC Bank" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={formData.bank_account_number} onChange={(e) => handleChange('bank_account_number', e.target.value)} disabled={!canEdit} placeholder="501000..." className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IFSC Code</Label>
                  <Input value={formData.bank_ifsc_code} onChange={(e) => handleChange('bank_ifsc_code', e.target.value)} disabled={!canEdit} placeholder="HDFC0000123" className="h-9 font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Branch Name</Label>
                  <Input value={formData.bank_branch_name} onChange={(e) => handleChange('bank_branch_name', e.target.value)} disabled={!canEdit} className="h-9" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3 text-xs">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-purple-600">Statutory Tax & Government Identifiers</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">PAN Card Number</Label>
                  <Input value={formData.pan_number} onChange={(e) => handleChange('pan_number', e.target.value)} disabled={!canEdit} placeholder="ABCDE1234F" className="h-9 font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aadhaar Card Number</Label>
                  <Input value={formData.aadhaar_number} onChange={(e) => handleChange('aadhaar_number', e.target.value)} disabled={!canEdit} placeholder="1234 5678 9012" className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UAN Number (PF)</Label>
                  <Input value={formData.uan_number} onChange={(e) => handleChange('uan_number', e.target.value)} disabled={!canEdit} placeholder="100900..." className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PF Account Number</Label>
                  <Input value={formData.pf_account_number} onChange={(e) => handleChange('pf_account_number', e.target.value)} disabled={!canEdit} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ESI IP Number</Label>
                  <Input value={formData.esi_ip_number} onChange={(e) => handleChange('esi_ip_number', e.target.value)} disabled={!canEdit} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Passport Number</Label>
                  <Input value={formData.passport_number} onChange={(e) => handleChange('passport_number', e.target.value)} disabled={!canEdit} className="h-9 font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Passport Expiry Date</Label>
                  <Input type="date" value={formData.passport_expiry_date} onChange={(e) => handleChange('passport_expiry_date', e.target.value)} disabled={!canEdit} className="h-9" />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Education & Experience */}
        <TabsContent value="education" className="pt-4 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2 text-primary">
              <GraduationCap className="size-4" /> Educational Qualifications & Prior Experience
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Highest Qualification / Degree</Label>
                <Input value={formData.highest_qualification} onChange={(e) => handleChange('highest_qualification', e.target.value)} disabled={!canEdit} placeholder="e.g. B.Tech in Computer Science / MBA" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Total Prior Work Experience (Years)</Label>
                <Input type="number" step="0.5" value={formData.total_experience_years} onChange={(e) => handleChange('total_experience_years', e.target.value)} disabled={!canEdit} placeholder="e.g. 4.5" className="h-9 font-mono" />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {canEdit && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button type="submit" disabled={saving} className="font-bold text-xs">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Save Employee Master Profile
          </Button>
        </div>
      )}
    </form>
  );
}
