'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UploadCloud, Loader2, Download, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { UploadDocumentForm } from '@/components/documents/upload-document-form';

export default function DocumentsPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage');

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  // Documents live in the PRIVATE employee-documents bucket, so
  // downloads go through a short-lived signed URL.
  async function handleDownload(doc: { storage_path?: string | null }) {
    if (!doc.storage_path) {
      toast.error('This document has no stored file');
      return;
    }
    try {
      const res = await fetch(
        `/api/storage/sign?bucket=employee-documents&path=${encodeURIComponent(doc.storage_path)}`
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed to get download link');
      window.open(json.url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download document');
    }
  }

  async function handleDelete(doc: { id: string; document_type?: string | null }) {
    if (!confirm(`Delete this ${doc.document_type || 'document'}? This cannot be undone.`)) return;
    const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Document deleted');
    void fetchDocuments();
  }

  const fetchDocuments = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data: rawData, error } = await supabase
        .from('employee_documents')
        .select(`*, workspace_members( id, user_id )`)
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Two-step: enrich with profile data
      let data: any[] = rawData || [];
      if (data.length > 0) {
        const userIds = data.map((d: any) => d.workspace_members?.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
          const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
          data = data.map((d: any) => ({
            ...d,
            workspace_members: d.workspace_members
              ? { ...d.workspace_members, profiles: profileMap[d.workspace_members.user_id] || null }
              : null,
          }));
        }
      }
      setDocuments(data);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (!canManagePeople) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <ShieldCheck className="size-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need people management permissions to view the Document Vault.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Document Vault (KYC)" 
        description="Securely store and manage employee NDAs, Government IDs, and Offer Letters."
        action={
          <Button onClick={() => setShowUpload(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <UploadCloud className="size-4 mr-2" />
            Upload Document
          </Button>
        }
      />
      
      <UploadDocumentForm 
        open={showUpload} 
        onOpenChange={setShowUpload} 
        onSaved={fetchDocuments} 
      />

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/20 hover:bg-transparent">
              <TableHead>Document Type</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Uploaded On</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No documents found in the vault.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const profile = Array.isArray(doc.workspace_members?.profiles) 
                  ? doc.workspace_members?.profiles[0] 
                  : doc.workspace_members?.profiles;
                  
                return (
                  <TableRow key={doc.id} className="border-border hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-blue-500" />
                        <span className="font-medium">{doc.document_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile?.full_name ? profile.full_name : <span className="text-muted-foreground italic">Unknown</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {doc.created_at ? format(new Date(doc.created_at), 'PPP') : '—'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost" size="icon-sm" aria-label="Download document"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm" aria-label="Delete document"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
