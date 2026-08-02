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
          <h1 className="text-2xl font-bold text-foreground">Custom Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build forms to capture and ingest leads directly into your contacts and pipelines.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary-hover text-primary-foreground"
        >
          <Plus className="size-4 mr-2" />
          Create Form
        </Button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading forms...</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center bg-card/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-primary">
              <FileText className="size-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No forms created yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a custom form, map its inputs to Contact properties or Pipelines, and publish the sharing link to generate leads automatically.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-2 bg-primary hover:bg-primary-hover text-primary-foreground"
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
              className="group relative rounded-xl border border-border/80 bg-card/50 hover:bg-card/80 hover:border-border/80 transition-all duration-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                {/* Title and Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {form.title}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" aria-label="More actions"
                          />} >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                      <DropdownMenuItem
                        onClick={() => router.push(`/forms/${form.id}`)}
                        className="hover:bg-muted focus:bg-muted focus:text-foreground"
                      >
                        <Pencil className="size-4 mr-2" />
                        Edit / Build
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => copyShareLink(form.id)}
                        className="hover:bg-muted focus:bg-muted focus:text-foreground"
                      >
                        <Copy className="size-4 mr-2" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : '';
                          window.open(`${origin}/forms/shared/${form.id}`, '_blank');
                        }}
                        className="hover:bg-muted focus:bg-muted focus:text-foreground"
                      >
                        <ExternalLink className="size-4 mr-2" />
                        Open Public Form
                      </DropdownMenuItem>
                      <div className="h-px bg-muted my-1" />
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

                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                  {form.description || <span className="italic text-muted-foreground">No description</span>}
                </p>
              </div>

              {/* Bottom analytics/actions */}
              <div className="flex items-center justify-between border-t border-border/80 pt-3 mt-1 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {submissionCounts[form.id] || 0}
                  </span>
                  <span>responses</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => copyShareLink(form.id)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-none hover:bg-muted transition-colors"
                    title="Copy Public Link"
                  >
                    {copiedId === form.id ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Label className="text-muted-foreground text-[10px] uppercase font-medium">Active</Label>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => toggleStatus(form, checked)}
                      className="data-checked:bg-primary data-unchecked:bg-muted"
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
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New Form</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Enter a name and optional description. You will customize fields and mappings on the next screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="form-title" className="text-foreground">Form Title</Label>
              <Input
                id="form-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Website Contact Form"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-desc" className="text-foreground">Description</Label>
              <Textarea
                id="form-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Briefly state the goal of this form..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-border text-foreground hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : 'Create & Design'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Form</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Are you sure you want to delete <span className="text-foreground font-medium">&quot;{deleteTarget?.title}&quot;</span>? All fields and submissions will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border text-foreground hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-foreground"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
