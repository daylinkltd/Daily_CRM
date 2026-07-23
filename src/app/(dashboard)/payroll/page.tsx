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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Banknote, Plus, Loader2, Play, Download, IndianRupee, Receipt } from 'lucide-react';
import { format, subMonths } from 'date-fns';

export default function PayrollAdminPage() {
  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const canManagePeople = can('people_manage' as any);

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<any[]>([]);

  const fetchCycles = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_cycles')
        .select(`*`)
        .eq('workspace_id', activeWorkspace.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setCycles(data || []);
    } catch (err: any) {
      toast.error('Failed to load payroll cycles');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const handleRunPayroll = async () => {
    if (!activeWorkspace?.id) return;
    
    // Naively assume running for previous month
    const lastMonth = subMonths(new Date(), 1);
    const month = lastMonth.getMonth() + 1;
    const year = lastMonth.getFullYear();

    toast.promise(
      (async () => {
        const { error } = await supabase.from('payroll_cycles').insert({
          workspace_id: activeWorkspace.id,
          month,
          year,
          status: 'draft',
        });
        if (error) throw error;
      })(),
      {
        loading: 'Initializing Payroll Cycle...',
        success: () => {
          fetchCycles();
          return `Payroll cycle for ${format(lastMonth, 'MMM yyyy')} initialized.`;
        },
        error: 'Failed to initialize cycle. It might already exist.',
      }
    );
  };

  if (!canManagePeople) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Banknote className="size-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You need people management permissions to view the Payroll module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payroll Management" 
        description="Run monthly payroll cycles, generate standard payslips, and approve expenses."
        action={
          <Button onClick={handleRunPayroll} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="size-4 mr-2" />
            Run Payroll Cycle
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payout (YTD)</CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="size-4 animate-spin" /> : '₹ 0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Processed in {new Date().getFullYear()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="size-4 animate-spin" /> : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-amber-500">Requires Approval</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/20 hover:bg-transparent">
              <TableHead>Cycle Month</TableHead>
              <TableHead>Total Payout</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : cycles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No payroll cycles run yet. Click "Run Payroll Cycle" to start.
                </TableCell>
              </TableRow>
            ) : (
              cycles.map((cycle) => {
                const date = new Date(cycle.year, cycle.month - 1);
                return (
                  <TableRow key={cycle.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      {format(date, 'MMMM yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      ₹ {Number(cycle.total_payout).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {cycle.status === 'draft' && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">Draft</Badge>
                      )}
                      {cycle.status === 'processed' && (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">Processed</Badge>
                      )}
                      {cycle.status === 'paid' && (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Paid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {cycle.status === 'draft' ? (
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => toast.success('Processing payslips...')}>
                          Process Cycle
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-primary" onClick={() => toast.success('Exporting bank transfer sheet...')}>
                          <Download className="size-4 mr-2" /> Export Bank File
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
