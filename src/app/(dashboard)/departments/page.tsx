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
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Loader2, Building } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { GatedButton } from '@/components/ui/gated-button';
import { useWorkspace } from '@/hooks/use-workspace';
import { DepartmentForm } from '@/components/departments/department-form';

export default function DepartmentsPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage');

  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editDept, setEditDept] = useState<any | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    let query = supabase
      .from('departments')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('name', { ascending: true });

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load departments');
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, search]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  function openAddForm() {
    setEditDept(null);
    setFormOpen(true);
  }

  function openEditForm(dept: any) {
    setEditDept(dept);
    setFormOpen(true);
  }

  function confirmDelete(dept: any) {
    setDeleteTarget(dept);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete department');
    } else {
      toast.success('Department deleted');
      fetchDepartments();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Departments" 
        description="Manage your organization's departments and structure."
        action={
          <GatedButton
            canAct={canManagePeople}
            gateReason="manage departments"
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4 mr-2" />
            Add Department
          </GatedButton>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments..."
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
                    <p className="text-sm text-muted-foreground">Loading departments...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : departments.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Building className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No departments match your search.' : 'No departments yet.'}
                    </p>
                    {!search && canManagePeople && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5 mr-2" />
                        Add your first department
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.id} className="border-border hover:bg-muted/50">
                  <TableCell className="text-foreground font-medium">
                    {dept.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {dept.description || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(dept.created_at).toLocaleDateString('en-US', {
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
                          onClick={() => openEditForm(dept)}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                        >
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => confirmDelete(dept)}
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

      <DepartmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        department={editDept}
        onSaved={fetchDepartments}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Delete Department</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="text-popover-foreground font-medium">{deleteTarget?.name}</span>? 
              This will remove the department assignment from all associated employees.
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
