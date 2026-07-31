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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface AssignAssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AssignAssetForm({ open, onOpenChange, onSaved }: AssignAssetFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loadingDeps, setLoadingDeps] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form State
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      loadEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWorkspace?.id]);

  async function loadEmployees() {
    setLoadingDeps(true);
    try {
      const { data: empData } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id, workspace_members(id, user_id)')
        .eq('workspace_id', activeWorkspace!.id)
        .eq('status', 'ACTIVE');

      const empList = empData || [];
      if (empList.length > 0) {
        const userIds = empList.map((e: any) => e.workspace_members?.user_id).filter(Boolean);
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
        const enriched = empList.map((e: any) => ({
          ...e,
          workspace_members: e.workspace_members
            ? { ...e.workspace_members, profiles: profileMap[e.workspace_members.user_id] || null }
            : null
        }));
        setEmployees(enriched);
      } else {
        setEmployees([]);
      }
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoadingDeps(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !memberId || !assetName.trim()) return;

    setSaving(true);
    
    try {
      const { error: dbError } = await supabase
        .from('employee_assets')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: memberId,
          asset_name: assetName.trim(),
          serial_number: serialNumber.trim() || null,
        });

      if (dbError) throw dbError;
      
      toast.success('Asset successfully assigned!');
      
      // Reset form
      setMemberId('');
      setAssetName('');
      setSerialNumber('');
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Assign Company Asset
          </DialogTitle>
        </DialogHeader>
        
        {loadingDeps ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            
            <div className="space-y-2">
              <Label>Select Employee <span className="text-red-500">*</span></Label>
              {employees.length === 0 ? (
                <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-md border border-amber-500/20">
                  No active employees found. Onboard someone first.
                </div>
              ) : (
                <Select value={memberId} onValueChange={(v) => setMemberId(v || '')} required>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => {
                      const profile = Array.isArray(emp.workspace_members?.profiles) 
                        ? emp.workspace_members?.profiles[0] 
                        : emp.workspace_members?.profiles;
                      
                      return (
                        <SelectItem key={emp.workspace_member_id} value={emp.workspace_member_id}>
                          {profile?.full_name?.trim() || profile?.email || emp.workspace_members?.full_name?.trim() || 'Workspace Member'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Asset Name / Type <span className="text-red-500">*</span></Label>
              <Input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. MacBook Pro M3 (16-inch)"
                className="bg-card border-border"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Serial / Tracking Number</Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. C02X543210ABC"
                className="bg-card border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Helpful for tracking devices if they are lost or need maintenance.
              </p>
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
                disabled={saving || !memberId || !assetName.trim()}
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Assign Asset
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
