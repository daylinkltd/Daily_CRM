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
import { Plus, Layers, Search, Bookmark, Loader2, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BrandsPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchBrands = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('name', { ascending: true });

      if (error) {
        // Fallback: search products manufacturers/brands
        const { data: prodData } = await supabase
          .from('products')
          .select('manufacturer')
          .eq('workspace_id', activeWorkspace.id);

        const uniqueBrands = Array.from(
          new Set((prodData || []).map(p => p.manufacturer).filter(Boolean))
        ).map((bName, idx) => ({
          id: `brand_${idx}`,
          name: bName,
          description: 'Product Brand / Manufacturer',
          created_at: new Date().toISOString()
        }));

        setBrands(uniqueBrands);
      } else {
        setBrands(data || []);
      }
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleOpenAdd = () => {
    setEditingBrand(null);
    setName('');
    setDescription('');
    setOpenModal(true);
  };

  const handleOpenEdit = (brand: any) => {
    setEditingBrand(brand);
    setName(brand.name || '');
    setDescription(brand.description || '');
    setOpenModal(true);
  };

  /** Insert every typed or pasted row in one statement. */
  const bulkAdd = async (rows: Record<string, string>[]) => {
    const { error } = await supabase.from('brands').insert(
      rows.map((r) => ({ workspace_id: activeWorkspace!.id, name: r.name.trim(), description: r.description?.trim() || '' }))
    );
    if (error) throw error;
    toast.success(`Added ${rows.length} brand${rows.length === 1 ? '' : 's'}.`);
    fetchBrands();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) return;

    setSaving(true);
    try {
      if (editingBrand?.id && !editingBrand.id.startsWith('brand_')) {
        const { error } = await supabase
          .from('brands')
          .update({ name: name.trim(), description: description.trim() })
          .eq('id', editingBrand.id);

        if (error) throw error;
        toast.success('Brand updated successfully');
      } else {
        const { error } = await supabase
          .from('brands')
          .insert({
            workspace_id: activeWorkspace.id,
            name: name.trim(),
            description: description.trim()
          });

        if (error) throw error;
        toast.success('Brand created successfully');
      }

      setOpenModal(false);
      fetchBrands();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    try {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      toast.success('Brand deleted');
      fetchBrands();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete brand');
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Brands"
        description="Manage product manufacturers, suppliers, and brand catalogs."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
              <Layers className="size-4 mr-2" />
              Bulk add
            </Button>
            <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" />
              Add Brand
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search brands..."
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
              <TableHead className="text-muted-foreground">Brand / Manufacturer</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading brands...</p>
                </TableCell>
              </TableRow>
            ) : filteredBrands.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Bookmark className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No brands found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredBrands.map(brand => (
                <TableRow key={brand.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{brand.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{brand.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        label={`Edit ${brand.name}`}
                        icon={<Edit3 className="size-4" />}
                        onClick={() => handleOpenEdit(brand)}
                      />
                      <IconAction
                        label={`Delete ${brand.name}`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => handleDelete(brand.id)}
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
            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
            <DialogDescription>Define brand names and details for your products.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Brand / Manufacturer Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Nike, Apple, Samsung, Ray-Ban"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional brand notes..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-card border-border"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {editingBrand ? 'Save Changes' : 'Create Brand'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkEntryDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        title="Add several brands"
        scope="brands"
        workspaceId={activeWorkspace?.id}
        noun="brand"
        columns={[
          { key: 'name', label: 'Brand name', required: true, placeholder: 'e.g. Samsung' },
          { key: 'description', label: 'Description', placeholder: 'Optional' },
        ]}
        onSubmit={bulkAdd}
      />
    </div>
  );
}
