'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, FileText, Download } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface EmployeeDocumentsTabProps {
  employeeId: string;
  canEdit: boolean;
}

export function EmployeeDocumentsTab({ employeeId, canEdit }: EmployeeDocumentsTabProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [docType, setDocType] = useState('');
  const [storagePath, setStoragePath] = useState('');

  const fetchDocs = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('workspace_member_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load documents');
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, employeeId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !docType.trim() || !storagePath.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('employee_documents')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: employeeId,
          document_type: docType.trim(),
          storage_path: storagePath.trim()
        });
      
      if (error) throw error;
      toast.success('Document recorded successfully');
      setFormOpen(false);
      setDocType('');
      setStoragePath('');
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">Compliance & Files</h3>
        {canEdit && (
          <Button onClick={() => setFormOpen(true)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="size-4 mr-2" /> Add Document
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Document Type</TableHead>
              <TableHead className="text-muted-foreground">Uploaded On</TableHead>
              <TableHead className="text-muted-foreground w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="size-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{doc.document_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <a href={doc.storage_path} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon-sm" className="hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Download className="size-4" />
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Add Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type <span className="text-red-500">*</span></Label>
              <Input 
                value={docType} 
                onChange={(e) => setDocType(e.target.value)} 
                placeholder="e.g. Identity Card, Contract" 
                className="bg-card border-border text-foreground"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>File URL / Path <span className="text-red-500">*</span></Label>
              <Input 
                type="url"
                value={storagePath} 
                onChange={(e) => setStoragePath(e.target.value)} 
                placeholder="https://..." 
                className="bg-card border-border text-foreground"
                required 
              />
              <p className="text-xs text-muted-foreground mt-1">Direct file uploads will be supported in Sprint 7.</p>
            </div>
            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="border-border hover:bg-muted">Cancel</Button>
              <Button type="submit" disabled={saving || !docType.trim() || !storagePath.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving && <Loader2 className="size-4 animate-spin mr-2" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
