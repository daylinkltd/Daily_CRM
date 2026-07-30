'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield } from 'lucide-react';

const CATEGORIES = [
  { value: 'CODE_OF_CONDUCT', label: 'Code of Conduct' },
  { value: 'LEAVE', label: 'Leave Policy' },
  { value: 'REMOTE_WORK', label: 'Remote Work & WFH' },
  { value: 'CONFIDENTIALITY', label: 'Data Confidentiality & NDA' },
  { value: 'IT_SECURITY', label: 'IT Security & Assets' },
  { value: 'POSH', label: 'POSH & Harassment Policy' },
  { value: 'TRAVEL', label: 'Travel & Reimbursement' },
  { value: 'ATTENDANCE', label: 'Working Hours & Attendance' },
  { value: 'TERMS_AND_CONDITIONS', label: 'General Terms & Conditions' },
  { value: 'CUSTOM', label: 'Custom Policy' }
];

interface PolicyEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId?: string | null;
  onSaved: () => void;
}

export function PolicyEditorModal({ open, onOpenChange, policyId, onSaved }: PolicyEditorModalProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CODE_OF_CONDUCT');
  const [content, setContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [effectiveAt, setEffectiveAt] = useState('');
  const [linkedModule, setLinkedModule] = useState('NONE');

  const [, setDepartments] = useState<any[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadAuxData() {
      if (!activeWorkspace?.id) return;
      const { data } = await supabase.from('departments').select('id, name').eq('workspace_id', activeWorkspace.id);
      setDepartments(data || []);
    }
    if (open) loadAuxData();
  }, [open, activeWorkspace?.id, supabase]);

  useEffect(() => {
    async function fetchPolicyDetails() {
      if (!policyId || !open) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/hr/policies/${policyId}`);
        const json = await res.json();
        if (json.policy) {
          const p = json.policy;
          setTitle(p.title);
          setCategory(p.category);
          setLinkedModule(p.linked_module || 'NONE');

          const verList = p.versions || [];
          const maxVerNum = verList.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
          const latestVer = verList.find((v: any) => v.version_number === maxVerNum);

          if (latestVer) {
            setContent(latestVer.content || '');
            setChangeSummary(latestVer.change_summary || '');
            setMandatory(!!latestVer.mandatory);
            if (latestVer.effective_at) {
              setEffectiveAt(new Date(latestVer.effective_at).toISOString().slice(0, 10));
            }
          }

          const targetDepts = (p.targets || []).filter((t: any) => t.target_type === 'DEPARTMENT').map((t: any) => t.target_id);
          setSelectedDeptIds(targetDepts);
        }
      } catch {
        toast.error('Failed to load policy details');
      } finally {
        setLoading(false);
      }
    }

    if (open && policyId) {
      fetchPolicyDetails();
    } else if (open) {
      // Reset form
      setTitle('');
      setCategory('CODE_OF_CONDUCT');
      setContent('');
      setChangeSummary('Initial Policy Creation');
      setMandatory(true);
      setEffectiveAt(new Date().toISOString().slice(0, 10));
      setLinkedModule('NONE');
      setSelectedDeptIds([]);
    }
  }, [policyId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in title and policy text');
      return;
    }
    if (!activeWorkspace?.id) return;

    setSaving(true);
    try {
      const targets = selectedDeptIds.map(dId => ({ target_type: 'DEPARTMENT', target_id: dId }));

      if (policyId) {
        // Update
        const res = await fetch(`/api/hr/policies/${policyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            category,
            content,
            changeSummary,
            mandatory,
            effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : null,
            linkedModule,
            targets
          })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        toast.success('Policy draft updated');
      } else {
        // Create new
        const res = await fetch('/api/hr/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            title,
            category,
            content,
            changeSummary,
            mandatory,
            effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : null,
            linkedModule,
            targets
          })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        toast.success('Policy created as Draft');
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            {policyId ? 'Edit & Version Policy Document' : 'Create New Company Policy'}
          </DialogTitle>
          <DialogDescription>
            Draft, version, and configure compliance policies for your workspace.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Policy Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Employee Handbook & Code of Conduct 2026"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Policy Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val || 'CODE_OF_CONDUCT')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={effectiveAt}
                  onChange={(e) => setEffectiveAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Operational Module</Label>
                <Select value={linkedModule} onValueChange={(val) => setLinkedModule(val || 'NONE')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None (General Document)</SelectItem>
                    <SelectItem value="ATTENDANCE">Attendance & Shift Settings</SelectItem>
                    <SelectItem value="LEAVE">Leave Rules & Accruals</SelectItem>
                    <SelectItem value="PAYROLL">Payroll & Salary Rules</SelectItem>
                    <SelectItem value="EXPENSES">Expense Claims & Reimbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Policy Content (Visual Rich Text Editor)</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Enter complete policy text, terms, clauses, and employee responsibilities..."
                minHeight="220px"
              />
            </div>

            <div className="space-y-2">
              <Label>Change Summary (&quot;What&apos;s New in this Version&quot;)</Label>
              <Input
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Updated annual leave allowance from 18 to 21 days"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="mandatory"
                checked={mandatory}
                onCheckedChange={(checked) => setMandatory(!!checked)}
              />
              <label htmlFor="mandatory" className="text-sm font-medium leading-none cursor-pointer">
                Mandatory Sign-off (Requires employee digital signature)
              </label>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {policyId ? 'Save Draft / Update' : 'Create Draft Policy'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
