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
import { Receipt, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';

export default function ExpensesPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember, defaultCurrency } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);

  const fetchExpenses = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`*`)
        .eq('workspace_id', activeWorkspace.id)
        .eq('workspace_member_id', activeMember.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Expense Claims" 
        description="Submit receipts for travel, meals, or office supplies to be reimbursed in your next payslip."
        action={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4 mr-2" />
            Submit Claim
          </Button>
        }
      />

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/20 hover:bg-transparent">
              <TableHead>Date Submitted</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No expense claims submitted yet.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => {
                return (
                  <TableRow key={expense.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(expense.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {expense.category}
                      {expense.description && (
                        <p className="text-xs text-muted-foreground font-normal mt-0.5">{expense.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(Number(expense.amount), defaultCurrency, { decimals: 2 })}
                    </TableCell>
                    <TableCell>
                      {expense.status === 'pending' && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">Pending</Badge>
                      )}
                      {expense.status === 'approved' && (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">Approved</Badge>
                      )}
                      {expense.status === 'reimbursed' && (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Reimbursed</Badge>
                      )}
                      {expense.status === 'rejected' && (
                        <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => toast.info('No receipt uploaded')}>
                        <Receipt className="size-4 text-muted-foreground" />
                      </Button>
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
