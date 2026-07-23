'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UploadCloud, File, Download, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface TaskAttachmentsProps {
  taskId: string;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('task_files')
      .select(`
        id,
        storage_path,
        created_at,
        uploader:workspace_members!task_files_uploaded_by_fkey (
          profiles:user_id ( full_name )
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load attachments');
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  }, [supabase, taskId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !activeWorkspace?.id || !activeMember?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeWorkspace.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          toast.info('Bucket not found. Ensure project-files bucket exists.');
        } else {
          throw uploadError;
        }
      }

      const { error: dbError } = await supabase
        .from('task_files')
        .insert({
          task_id: taskId,
          storage_path: filePath,
          uploaded_by: activeMember.id,
        });

      if (dbError) throw dbError;

      toast.success('File attached successfully');
      fetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to attach file');
    } finally {
      setUploading(false);
      // reset input
      if (e.target) e.target.value = '';
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('project-files').getPublicUrl(path);
    return data.publicUrl;
  };

  const deleteFile = async (id: string, path: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await supabase.storage.from('project-files').remove([path]);
      const { error } = await supabase.from('task_files').delete().eq('id', id);
      if (error) throw error;
      toast.success('Attachment deleted');
      fetchFiles();
    } catch (err) {
      toast.error('Failed to delete attachment');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-lg border border-dashed border-border px-6 py-6 bg-card/50">
        <div className="text-center">
          <UploadCloud className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <div className="mt-2 flex text-sm leading-6 text-muted-foreground justify-center">
            <label
              htmlFor="task-file-upload"
              className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80"
            >
              <span>{uploading ? 'Uploading...' : 'Upload a file'}</span>
              <Input
                id="task-file-upload"
                name="task-file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {files.map((file) => {
            const fileName = file.storage_path.split('/').pop()?.split('-').slice(1).join('-') || 'File';
            const url = getPublicUrl(file.storage_path);
            const uploaderName = Array.isArray(file.uploader?.profiles)
              ? file.uploader.profiles[0]?.full_name
              : file.uploader?.profiles?.full_name;

            return (
              <div key={file.id} className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="size-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <File className="size-4 text-primary" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate text-foreground">{fileName}</span>
                    <span className="text-xs text-muted-foreground truncate">Uploaded by {uploaderName || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => window.open(url, '_blank')}>
                    <Download className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => deleteFile(file.id, file.storage_path)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-center text-muted-foreground py-4">No attachments yet.</p>
      )}
    </div>
  );
}
