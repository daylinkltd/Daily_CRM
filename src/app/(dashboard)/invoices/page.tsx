'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, Search, FileText, HandCoins } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function InvoicesPage() {
  const { activeWorkspace } = useWorkspace();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('project_invoices')
        .select(`
          *,
          projects ( name )
        `)
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
    setPaymentAmount(balance > 0 ? balance.toString() : '');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    const payment = Number(paymentAmount);
    
    if (isNaN(payment) || payment <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    const currentPaid = Number(selectedInvoice.amount_paid || 0);
    const totalAmount = Number(selectedInvoice.total_amount || 0);
    const newTotalPaid = currentPaid + payment;

    if (newTotalPaid > totalAmount) {
      toast.error('Payment exceeds total invoice amount');
      return;
    }

    setIsSubmitting(true);
    try {
      let newStatus = selectedInvoice.status;
      if (newTotalPaid >= totalAmount) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const { error } = await supabase
        .from('project_invoices')
        .update({
          amount_paid: newTotalPaid,
          status: newStatus
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;
      
      toast.success('Payment recorded successfully');
      setPaymentModalOpen(false);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
      case 'SENT': return <Badge variant="outline" className="text-blue-500 border-blue-500">Sent</Badge>;
      case 'PARTIALLY_PAID': return <Badge variant="outline" className="text-orange-500 border-orange-500">Partial</Badge>;
      case 'PAID': return <Badge className="bg-emerald-500 hover:bg-emerald-600">Paid</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">Cancelled</Badge>;
      case 'VOID': return <Badge variant="destructive">Void</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (inv.projects?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = invoices.reduce((sum, inv) => {
    if (['DRAFT', 'CANCELLED', 'VOID', 'PAID'].includes(inv.status)) return sum;
    return sum + (Number(inv.total_amount) - Number(inv.amount_paid));
  }, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage billing and track payments across all projects.</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold text-orange-500">${totalOutstanding.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">All Invoices</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-8 w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No invoices found</p>
              <p className="text-sm text-muted-foreground">Generate an invoice from a Project dashboard.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const balance = Number(inv.total_amount) - Number(inv.amount_paid);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {inv.invoice_number}
                      </TableCell>
                      <TableCell>{Array.isArray(inv.projects) ? inv.projects[0]?.name : inv.projects?.name}</TableCell>
                      <TableCell>{format(new Date(inv.issue_date || inv.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">${Number(inv.total_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {balance > 0 ? <span className="text-orange-500">${balance.toFixed(2)}</span> : '$0.00'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {balance > 0 && inv.status !== 'DRAFT' && (
                          <Button variant="outline" size="sm" onClick={() => openPaymentModal(inv)}>
                            <HandCoins className="size-4 mr-2" /> Record Payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record an incoming payment for {selectedInvoice?.invoice_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm bg-muted p-3 rounded-md">
              <div>
                <p className="text-muted-foreground">Total Invoice Amount</p>
                <p className="font-medium">${Number(selectedInvoice?.total_amount || 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Outstanding Balance</p>
                <p className="font-medium text-orange-500">
                  ${(Number(selectedInvoice?.total_amount || 0) - Number(selectedInvoice?.amount_paid || 0)).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Amount ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={(Number(selectedInvoice?.total_amount || 0) - Number(selectedInvoice?.amount_paid || 0)).toFixed(2)}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isSubmitting || !paymentAmount}>
              {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
