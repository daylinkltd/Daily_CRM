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
import { Loader2, UploadCloud } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface UploadDocumentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const DOCUMENT_TYPES = [
  'NDA',
  'Offer Letter',
  'Relieving Letter',
  'Government ID (Aadhar)',
  'Government ID (PAN)',
  'Resume',
  'Other'
];

export function UploadDocumentForm({ open, onOpenChange, onSaved }: UploadDocumentFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loadingDeps, setLoadingDeps] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form State
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      loadEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWorkspace?.id]);

  async function loadEmployees() {
    setLoadingDeps(true);
    try {
      // Fetch only onboarded employees — two-step required since workspace_members.user_id refs auth.users
      const { data: empData } = await supabase
        .from('employee_profiles')
        // See employees/page.tsx: the embed needs the FK hint because
        // employee_profiles points at workspace_members twice.
        .select('workspace_member_id, workspace_members!workspace_member_id(id, user_id)')
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
    if (!activeWorkspace?.id || !memberId || !docType || !file) return;

    setSaving(true);
    
    try {
      // 1. Upload through the service-role storage API — direct
      // client uploads fail (the buckets carry no storage RLS
      // policies), and HR documents live in the PRIVATE
      // employee-documents bucket, reachable only via signed URLs.
      // No placeholder fallback: if storage fails, the upload fails.
      const form = new FormData();
      form.append('bucket', 'employee-documents');
      form.append('workspace_id', activeWorkspace.id);
      form.append('file', file);
      const res = await fetch('/api/storage/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.path) {
        throw new Error(json.error || 'File upload failed');
      }

      // 2. Save metadata — the column is storage_path (NOT NULL);
      // document_url never existed and made every insert fail.
      const { error: dbError } = await supabase
        .from('employee_documents')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: memberId,
          document_type: docType,
          storage_path: json.path
        });

      if (dbError) throw dbError;
      
      toast.success('Document securely uploaded!');
      
      // Reset form
      setMemberId('');
      setDocType('');
      setFile(null);
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Upload Employee Document
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
                          {profile?.full_name || profile?.email || 'Unknown User'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Document Type <span className="text-red-500">*</span></Label>
              <Select value={docType} onValueChange={(v) => setDocType(v || '')} required>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder="e.g. NDA" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 pt-2">
              <Label>Attach File (PDF, JPG, PNG) <span className="text-red-500">*</span></Label>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-border px-6 py-10">
                <div className="text-center">
                  <UploadCloud className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                  <div className="mt-4 flex text-sm leading-6 text-muted-foreground justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none hover:text-primary/80"
                    >
                      <span>Upload a file</span>
                      <Input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        required
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground mt-1">
                    {file ? <span className="text-emerald-500 font-medium">{file.name}</span> : 'PDF, PNG, JPG up to 10MB'}
                  </p>
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
                disabled={saving || !memberId || !docType || !file}
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save Document
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
