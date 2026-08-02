import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { assertAffected } from '@/lib/supabase/affected-rows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employee_code: employee.employee_code || '',
    department_id: employee.department_id || 'none',
    designation_id: employee.designation_id || 'none',
    manager_workspace_member_id: employee.manager_workspace_member_id || 'none',
    joining_date: employee.joining_date || '',
    employment_type: employee.employment_type || '',
    salary_grade: employee.salary_grade || '',
    status: employee.status || 'ACTIVE',
    address: employee.address || '',
    notes: employee.notes || ''
  });

  const handleChange = (field: string, value: string) => {
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
        joining_date: formData.joining_date || null
      };

      const result = await supabase
        .from('employee_profiles')
        .update(payload)
        .eq('workspace_member_id', employee.workspace_member_id)
        .select('workspace_member_id');

      assertAffected(result, 'this employee', 'save');
      toast.success('Profile updated successfully');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core HR Details */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">Core Employment</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee ID (Code)</Label>
                <Input 
                  value={formData.employee_code}
                  onChange={(e) => handleChange('employee_code', e.target.value)}
                  disabled={!canEdit}
                  placeholder="EMP-0001"
                />
              </div>
              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select disabled={!canEdit} value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                    <SelectItem value="PROBATION">Probation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select disabled={!canEdit} value={formData.department_id} onValueChange={(val) => handleChange('department_id', val)}>
                  <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select disabled={!canEdit} value={formData.designation_id} onValueChange={(val) => handleChange('designation_id', val)}>
                  <SelectTrigger><SelectValue placeholder="Select Designation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {designations.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select disabled={!canEdit} value={formData.manager_workspace_member_id} onValueChange={(val) => handleChange('manager_workspace_member_id', val)}>
                  <SelectTrigger><SelectValue placeholder="Select Manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {managers.filter(m => m.workspace_member_id !== employee.workspace_member_id).map(m => {
                      const profile = Array.isArray(m.workspace_members?.profiles) ? m.workspace_members.profiles[0] : m.workspace_members?.profiles;
                      return (
                        <SelectItem key={m.workspace_member_id} value={m.workspace_member_id}>
                          {profile?.full_name || 'Unknown User'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input 
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => handleChange('joining_date', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Details */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">Compensation & Personal</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Input 
                  value={formData.employment_type}
                  onChange={(e) => handleChange('employment_type', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Full-Time, Contract, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Grade / Band</Label>
                <Input 
                  value={formData.salary_grade}
                  onChange={(e) => handleChange('salary_grade', e.target.value)}
                  disabled={!canEdit}
                  placeholder="L1, L2, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea 
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                disabled={!canEdit}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>HR Notes</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                disabled={!canEdit}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      )}
    </form>
  );
}
