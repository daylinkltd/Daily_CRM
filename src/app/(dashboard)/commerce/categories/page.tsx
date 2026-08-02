'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { BulkEntryDialog } from '@/components/ui/bulk-entry-dialog';
import { IconAction } from '@/components/ui/icon-action';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Layers, Search, Tag, Loader2, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriesPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchCategories = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('name', { ascending: true });

      if (error) {
        // Fallback: search products categories
        const { data: prodData } = await supabase
          .from('products')
          .select('category_name')
          .eq('workspace_id', activeWorkspace.id);

        const uniqueCats = Array.from(
          new Set((prodData || []).map(p => p.category_name).filter(Boolean))
        ).map((catName, idx) => ({
          id: `cat_${idx}`,
          name: catName,
          description: 'Product Category',
          created_at: new Date().toISOString()
        }));

        setCategories(uniqueCats);
      } else {
        setCategories(data || []);
      }
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setOpenModal(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name || '');
    setDescription(cat.description || '');
    setOpenModal(true);
  };

  /** Insert every typed or pasted row in one statement. */
  const bulkAdd = async (rows: Record<string, string>[]) => {
    const { error } = await supabase.from('categories').insert(
      rows.map((r) => ({ workspace_id: activeWorkspace!.id, name: r.name.trim(), description: r.description?.trim() || '' }))
    );
    if (error) throw error;
    toast.success(`Added ${rows.length} category${rows.length === 1 ? '' : 's'}.`);
    fetchCategories();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory?.id && !editingCategory.id.startsWith('cat_')) {
        const { error } = await supabase
          .from('categories')
          .update({ name: name.trim(), description: description.trim() })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            workspace_id: activeWorkspace.id,
            name: name.trim(),
            description: description.trim()
          });

        if (error) throw error;
        toast.success('Category created successfully');
      }

      setOpenModal(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Categories"
        description="Organize your store inventory into structured product categories."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
              <Layers className="size-4 mr-2" />
              Bulk add
            </Button>
            <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" />
              Add Category
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-card border-border"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Category Name</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading categories...</p>
                </TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Tag className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No categories found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map(cat => (
                <TableRow key={cat.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cat.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        label={`Edit ${cat.name}`}
                        icon={<Edit3 className="size-4" />}
                        onClick={() => handleOpenEdit(cat)}
                      />
                      <IconAction
                        label={`Delete ${cat.name}`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => handleDelete(cat.id)}
                        destructive
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border rounded-xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>Define category names and descriptions for your catalog.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Apparel, Electronics, Groceries"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional category description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-card border-border"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkEntryDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        title="Add several categorys"
        scope="categories"
        workspaceId={activeWorkspace?.id}
        noun="category"
        columns={[
          { key: 'name', label: 'Category name', required: true, placeholder: 'e.g. Electronics' },
          { key: 'description', label: 'Description', placeholder: 'Optional' },
        ]}
        onSubmit={bulkAdd}
      />
    </div>
  );
}
