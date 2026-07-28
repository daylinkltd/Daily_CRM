'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

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
  
  // Salary Breakdown
  const [basicSalary, setBasicSalary] = useState('');
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
      
      // 3. Fetch all workspace members (two-step: user_id refs auth.users not public.profiles)
      const { data: rawMembers } = await supabase
        .from('workspace_members')
        .select('id, user_id')
        .eq('workspace_id', activeWorkspace!.id);
      
      let members: any[] = [];
      if (rawMembers && rawMembers.length > 0) {
        const userIds = rawMembers.map((m: any) => m.user_id);
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
        members = rawMembers.map((m: any) => ({ ...m, profiles: profileMap[m.user_id] || null }));
      }

      // 4. Fetch existing employee profiles
      const { data: profiles } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id')
        .eq('workspace_id', activeWorkspace!.id);

      const existingIds = new Set((profiles || []).map(p => p.workspace_member_id));
      
      // Filter members who DO NOT have an employee profile yet
      const unassigned = members.filter(m => !existingIds.has(m.id));

      setDepartments(deps || []);
      setDesignations(desigs || []);
      setAvailableMembers(unassigned);
    } catch {
      toast.error('Failed to load form requirements');
    } finally {
      setLoadingDeps(false);
    }
  }

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
          salary_grade: JSON.stringify({
            basic: Number(basicSalary) || 0,
            hra: Number(hra) || 0,
            allowances: Number(allowances) || 0,
            pf: Number(pfDeduction) || 0,
            tds: Number(tds) || 0,
          }),
          status: 'ACTIVE'
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
                      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                      return (
                        <SelectItem key={m.id} value={m.id}>
                          {p?.full_name || p?.email || 'Unknown User'}
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
