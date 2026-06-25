'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  FileText,
  Copy,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  MoreVertical,
  Check,
} from 'lucide-react';
import type { CustomForm } from '@/types';

export default function FormsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [forms, setForms] = useState<CustomForm[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Creation State
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<CustomForm | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copy success mapping
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Fetch forms
      const { data: formsData, error: formsErr } = await supabase
        .from('custom_forms')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (formsErr) throw formsErr;

      // Fetch submission counts
      const { data: subsData, error: subsErr } = await supabase
        .from('custom_form_submissions')
        .select('form_id');

      if (subsErr) throw subsErr;

      const counts: Record<string, number> = {};
      subsData?.forEach((sub) => {
        counts[sub.form_id] = (counts[sub.form_id] || 0) + 1;
      });

      setSubmissionCounts(counts);
      setForms(formsData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !activeWorkspace?.id) {
      toast.error('Form title is required');
      return;
    }

    setCreating(true);
    try {
      const { data: newForm, error } = await supabase
        .from('custom_forms')
        .insert({
          workspace_id: activeWorkspace.id,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Form created successfully');
      setCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      router.push(`/forms/${newForm.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('custom_forms')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast.success('Form deleted successfully');
      setForms((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete form');
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (form: CustomForm, nextStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('custom_forms')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', form.id);

      if (error) throw error;

      setForms((prev) =>
        prev.map((f) => (f.id === form.id ? { ...f, is_active: nextStatus } : f))
      );
      toast.success(nextStatus ? 'Form activated' : 'Form deactivated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const copyShareLink = async (formId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareLink = `${origin}/forms/shared/${formId}`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedId(formId);
      toast.success('Public share link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Custom Forms</h1>
          <p className="text-sm text-slate-400 mt-1">
            Build forms to capture and ingest leads directly into your contacts and pipelines.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#00aef0] hover:bg-[#009bd6] text-white"
        >
          <Plus className="size-4 mr-2" />
          Create Form
        </Button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-[#00aef0]" />
          <p className="text-sm text-slate-400">Loading forms...</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 p-12 text-center bg-slate-900/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
            <div className="size-12 rounded-full bg-slate-800 flex items-center justify-center text-[#00aef0]">
              <FileText className="size-6" />
            </div>
            <h3 className="text-lg font-medium text-white">No forms created yet</h3>
            <p className="text-sm text-slate-400">
              Create a custom form, map its inputs to Contact properties or Pipelines, and publish the sharing link to generate leads automatically.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-2 bg-[#00aef0] hover:bg-[#009bd6] text-white"
            >
              <Plus className="size-4 mr-2" />
              Create your first form
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="group relative rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700/80 transition-all duration-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                {/* Title and Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-white group-hover:text-[#00aef0] transition-colors line-clamp-1">
                    {form.title}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white" />} >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-300">
                      <DropdownMenuItem
                        onClick={() => router.push(`/forms/${form.id}`)}
                        className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white"
                      >
                        <Pencil className="size-4 mr-2" />
                        Edit / Build
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => copyShareLink(form.id)}
                        className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white"
                      >
                        <Copy className="size-4 mr-2" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : '';
                          window.open(`${origin}/forms/shared/${form.id}`, '_blank');
                        }}
                        className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white"
                      >
                        <ExternalLink className="size-4 mr-2" />
                        Open Public Form
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-800 my-1" />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(form)}
                        className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete Form
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[2rem]">
                  {form.description || <span className="italic text-slate-500">No description</span>}
                </p>
              </div>

              {/* Bottom analytics/actions */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="font-semibold text-white">
                    {submissionCounts[form.id] || 0}
                  </span>
                  <span>responses</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => copyShareLink(form.id)}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                    title="Copy Public Link"
                  >
                    {copiedId === form.id ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Label className="text-slate-500 text-[10px] uppercase font-medium">Active</Label>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => toggleStatus(form, checked)}
                      className="data-checked:bg-[#00aef0] data-unchecked:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Form</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Enter a name and optional description. You will customize fields and mappings on the next screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="form-title" className="text-slate-300">Form Title</Label>
              <Input
                id="form-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Website Contact Form"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-desc" className="text-slate-300">Description</Label>
              <Textarea
                id="form-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Briefly state the goal of this form..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="bg-[#00aef0] hover:bg-[#009bd6] text-white"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : 'Create & Design'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Form</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Are you sure you want to delete <span className="text-white font-medium">"{deleteTarget?.title}"</span>? All fields and submissions will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
