'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Loader2, BadgeCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { GatedButton } from '@/components/ui/gated-button';
import { useWorkspace } from '@/hooks/use-workspace';
import { DesignationForm } from '@/components/designations/designation-form';

export default function DesignationsPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage');

  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editDesig, setEditDesig] = useState<any | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDesignations = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    let query = supabase
      .from('designations')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('name', { ascending: true });

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load designations');
    } else {
      setDesignations(data || []);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, search]);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  function openAddForm() {
    setEditDesig(null);
    setFormOpen(true);
  }

  function openEditForm(desig: any) {
    setEditDesig(desig);
    setFormOpen(true);
  }

  function confirmDelete(desig: any) {
    setDeleteTarget(desig);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('designations')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete designation');
    } else {
      toast.success('Designation deleted');
      fetchDesignations();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Designations" 
        description="Manage job titles and roles within your organization."
        action={
          <GatedButton
            canAct={canManagePeople}
            gateReason="manage designations"
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4 mr-2" />
            Add Designation
          </GatedButton>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designations..."
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading designations...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : designations.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <BadgeCheck className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No designations match your search.' : 'No designations yet.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5 mr-2" />
                        Add your first designation
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              designations.map((desig) => (
                <TableRow key={desig.id} className="border-border hover:bg-muted/50">
                  <TableCell className="text-foreground font-medium">
                    {desig.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {desig.description || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(desig.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem
                          onClick={() => openEditForm(desig)}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                        >
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => confirmDelete(desig)}
                          className="cursor-pointer"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DesignationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        designation={editDesig}
        onSaved={fetchDesignations}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Delete Designation</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="text-popover-foreground font-medium">{deleteTarget?.name}</span>? 
              This will remove the designation assignment from all associated employees.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
