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
import { Badge } from '@/components/ui/badge';
import { Laptop, Plus, Loader2 } from 'lucide-react';
import { AssignAssetForm } from '@/components/assets/assign-asset-form';

export default function AssetsPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage' as any);

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [showAssign, setShowAssign] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_assets')
        .select(`
          *,
          workspace_members(
            id,
            profiles:user_id ( full_name )
          )
        `)
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (err: any) {
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  if (!canManagePeople) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Laptop className="size-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need people management permissions to view assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Asset Management" 
        description="Track company laptops, phones, and physical assets assigned to employees."
        action={
          <Button onClick={() => setShowAssign(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4 mr-2" />
            Assign Asset
          </Button>
        }
      />
      
      <AssignAssetForm 
        open={showAssign} 
        onOpenChange={setShowAssign} 
        onSaved={fetchAssets} 
      />

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/20 hover:bg-transparent">
              <TableHead>Asset Name</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No assets assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => {
                const profile = Array.isArray(asset.workspace_members?.profiles) 
                  ? asset.workspace_members?.profiles[0] 
                  : asset.workspace_members?.profiles;
                  
                const isReturned = !!asset.returned_date;

                return (
                  <TableRow key={asset.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">{asset.asset_name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{asset.serial_number || 'N/A'}</TableCell>
                    <TableCell>
                      {profile?.full_name ? profile.full_name : <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      {isReturned ? (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Returned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">In Use</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isReturned && (
                        <Button variant="ghost" size="sm" onClick={() => toast.success('Marked as returned!')}>
                          Mark Returned
                        </Button>
                      )}
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
