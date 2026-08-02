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
import { Plus, Layers, Search, Scale, Loader2, Edit3, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_UNITS = [
  { name: 'Pieces', code: 'PCS', precision: 0 },
  { name: 'Kilograms', code: 'KG', precision: 2 },
  { name: 'Grams', code: 'GM', precision: 2 },
  { name: 'Liters', code: 'LTR', precision: 2 },
  { name: 'Meters', code: 'MTR', precision: 2 },
  { name: 'Box (12 pcs)', code: 'BOX', precision: 0 },
  { name: 'Carton', code: 'CTN', precision: 0 },
  { name: 'Pack', code: 'PKT', precision: 0 },
];

export default function UnitsPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const fetchUnits = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('name', { ascending: true });

      if (error || !data || data.length === 0) {
        // Fallback default list
        setUnits(DEFAULT_UNITS.map((u, idx) => ({ id: `unit_${idx}`, ...u })));
      } else {
        setUnits(data);
      }
    } catch {
      setUnits(DEFAULT_UNITS.map((u, idx) => ({ id: `unit_${idx}`, ...u })));
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleSeedDefaults = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);

    try {
      const rows = DEFAULT_UNITS.map(u => ({
        workspace_id: activeWorkspace.id,
        name: u.name,
        code: u.code,
      }));

      await supabase.from('units').upsert(rows, { onConflict: 'workspace_id,code' });
      toast.success('Default measurement units added!');
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed default units');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setName('');
    setCode('');
    setOpenModal(true);
  };

  const handleOpenEdit = (unit: any) => {
    setEditingUnit(unit);
    setName(unit.name || '');
    setCode(unit.code || '');
    setOpenModal(true);
  };

  /** Insert every typed or pasted row in one statement. */
  const bulkAdd = async (rows: Record<string, string>[]) => {
    const { error } = await supabase.from('units').insert(
      rows.map((r) => ({ workspace_id: activeWorkspace!.id, name: r.name.trim(), code: r.code.trim().toUpperCase() }))
    );
    if (error) throw error;
    toast.success(`Added ${rows.length} unit${rows.length === 1 ? '' : 's'}.`);
    fetchUnits();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim() || !code.trim()) return;

    setSaving(true);
    try {
      if (editingUnit?.id && !editingUnit.id.startsWith('unit_')) {
        const { error } = await supabase
          .from('units')
          .update({ name: name.trim(), code: code.trim().toUpperCase() })
          .eq('id', editingUnit.id);

        if (error) throw error;
        toast.success('Unit updated successfully');
      } else {
        const { error } = await supabase
          .from('units')
          .insert({
            workspace_id: activeWorkspace.id,
            name: name.trim(),
            code: code.trim().toUpperCase()
          });

        if (error) throw error;
        toast.success('Unit created successfully');
      }

      setOpenModal(false);
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save unit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
      toast.success('Unit deleted');
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete unit');
    }
  };

  const filteredUnits = units.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units of Measurement"
        description="Manage product quantity units, short codes, and conversion metrics."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSeedDefaults} disabled={saving} className="border-border">
              <Sparkles className="size-4 mr-2 text-amber-500" />
              Seed Defaults
            </Button>
            <Button variant="outline" onClick={() => setBulkAddOpen(true)} className="border-border">
              <Layers className="size-4 mr-2" />
              Bulk add
            </Button>
            <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground">
              <Plus className="size-4 mr-2" />
              Add Unit
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search units..."
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
              <TableHead className="text-muted-foreground">Unit Name</TableHead>
              <TableHead className="text-muted-foreground">Unit Code</TableHead>
              <TableHead className="text-muted-foreground w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading measurement units...</p>
                </TableCell>
              </TableRow>
            ) : filteredUnits.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={3} className="text-center py-12">
                  <Scale className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No measurement units found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map(unit => (
                <TableRow key={unit.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{unit.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs uppercase">{unit.code}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        label={`Edit ${unit.name}`}
                        icon={<Edit3 className="size-4" />}
                        onClick={() => handleOpenEdit(unit)}
                      />
                      <IconAction
                        label={`Delete ${unit.name}`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => handleDelete(unit.id)}
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
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Measurement Unit'}</DialogTitle>
            <DialogDescription>Define unit names and short codes (e.g. PCS, KG, BOX).</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Unit Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Pieces, Kilograms, Box"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Unit Code (Short Symbol) <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. PCS, KG, LTR, BOX"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                className="bg-card border-border uppercase font-mono"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {editingUnit ? 'Save Changes' : 'Create Unit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkEntryDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        title="Add several units"
        scope="units"
        workspaceId={activeWorkspace?.id}
        noun="unit"
        columns={[
          { key: 'name', label: 'Unit name', required: true, placeholder: 'e.g. Kilogram' },
          { key: 'code', label: 'Code', required: true, placeholder: 'e.g. KG' },
        ]}
        onSubmit={bulkAdd}
      />
    </div>
  );
}
