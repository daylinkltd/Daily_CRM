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
import { Loader2, Plus, Laptop, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { IconAction } from "@/components/ui/icon-action";

interface EmployeeAssetsTabProps {
  employeeId: string;
  canEdit: boolean;
}

export function EmployeeAssetsTab({ employeeId, canEdit }: EmployeeAssetsTabProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [assetName, setAssetName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchAssets = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('employee_assets')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('workspace_member_id', employeeId)
      .order('assigned_date', { ascending: false });

    if (error) {
      toast.error('Failed to load assets');
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, employeeId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !assetName.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('employee_assets')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: employeeId,
          asset_name: assetName.trim(),
          serial_number: serialNumber.trim() || null,
          assigned_date: assignedDate
        });
      
      if (error) throw error;
      toast.success('Asset assigned successfully');
      setFormOpen(false);
      setAssetName('');
      setSerialNumber('');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign asset');
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (id: string) => {
    try {
      const { error } = await supabase
        .from('employee_assets')
        .update({ returned_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Asset marked as returned');
      fetchAssets();
    } catch {
      toast.error('Failed to return asset');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">Assigned Equipment</h3>
        {canEdit && (
          <IconAction label="Assign Asset" icon={<Plus className="size-4 " />} onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" />
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Asset Name</TableHead>
              <TableHead className="text-muted-foreground">Serial Number</TableHead>
              <TableHead className="text-muted-foreground">Assigned Date</TableHead>
              <TableHead className="text-muted-foreground">Returned Date</TableHead>
              {canEdit && <TableHead className="text-muted-foreground w-24">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Laptop className="size-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No assets assigned yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{asset.asset_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{asset.serial_number || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(asset.assigned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {asset.returned_date ? new Date(asset.returned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      {!asset.returned_date ? (
                        <IconAction label="Return" icon={<CheckCircle2 className="size-3 " />} variant="outline" onClick={() => handleReturn(asset.id)} className="border-border hover:bg-muted text-xs h-7" />
                      ) : (
                        <span className="text-xs text-muted-foreground px-2">Returned</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Assign Asset</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Asset Name / Model <span className="text-red-500">*</span></Label>
              <Input 
                value={assetName} 
                onChange={(e) => setAssetName(e.target.value)} 
                placeholder="e.g. MacBook Pro M3" 
                className="bg-card border-border text-foreground"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input 
                value={serialNumber} 
                onChange={(e) => setSerialNumber(e.target.value)} 
                placeholder="Optional" 
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Date <span className="text-red-500">*</span></Label>
              <Input 
                type="date"
                value={assignedDate} 
                onChange={(e) => setAssignedDate(e.target.value)} 
                className="bg-card border-border text-foreground"
                required 
              />
            </div>
            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="border-border hover:bg-muted">Cancel</Button>
              <Button type="submit" disabled={saving || !assetName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving && <Loader2 className="size-4 animate-spin mr-2" />} Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
