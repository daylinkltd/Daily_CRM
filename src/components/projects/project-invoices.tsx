'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { toast } from 'sonner';
import { Loader2, FileText, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

interface ProjectInvoicesProps {
  projectId: string;
}

export function ProjectInvoices({ projectId }: ProjectInvoicesProps) {
  const { activeWorkspace: workspace, activeMember } = useWorkspace();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [hourlyRate, setHourlyRate] = useState(0);
  const [unbilledLogs, setUnbilledLogs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const fetchInvoiceData = useCallback(async () => {
    if (!projectId || !workspace) return;
    setLoading(true);
    
    try {
      // 1. Get project hourly rate
      const { data: projectData } = await supabase
        .from('projects')
        .select('hourly_rate')
        .eq('id', projectId)
        .single();
      
      const rate = projectData?.hourly_rate || 0;
      setHourlyRate(rate);

      // 2. Get unbilled time logs for this project
      // Need to join through tasks to filter by project_id
      const { data: tasks } = await supabase.from('tasks').select('id, title').eq('project_id', projectId);
      const taskIds = tasks?.map(t => t.id) || [];
      
      let logs: any[] = [];
      if (taskIds.length > 0) {
        const { data: timeLogs } = await supabase
          .from('time_logs')
          .select(`
            id,
            duration,
            description,
            task_id
          `)
          .in('task_id', taskIds)
          .eq('billable', true)
          .is('invoice_id', null);
          
        // Attach task titles for snapshotting
        logs = (timeLogs || []).map(log => ({
          ...log,
          taskTitle: tasks?.find(t => t.id === log.task_id)?.title || 'Unknown Task'
        }));
      }
      setUnbilledLogs(logs);

      // 3. Get existing invoices
      const { data: existingInvoices } = await supabase
        .from('project_invoices')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
        
      setInvoices(existingInvoices || []);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  }, [projectId, workspace, supabase]);

  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  const handleGenerateInvoice = async () => {
    if (!workspace || !activeMember || unbilledLogs.length === 0) return;
    setGenerating(true);

    try {
      const totalHours = unbilledLogs.reduce((sum, log) => sum + Number(log.duration), 0);
      const totalAmount = totalHours * hourlyRate;
      
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('project_invoices')
        .insert({
          project_id: projectId,
          workspace_id: workspace.id,
          invoice_number: invoiceNumber,
          status: 'DRAFT',
          total_hours: totalHours,
          total_amount: totalAmount,
          created_by: activeMember.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. Create Invoice Items (Snapshots)
      const invoiceItems = unbilledLogs.map(log => ({
        invoice_id: invoice.id,
        workspace_id: workspace.id,
        description: `${log.taskTitle} ${log.description ? `- ${log.description}` : ''}`,
        quantity: log.duration,
        unit_price: hourlyRate,
        amount: Number(log.duration) * hourlyRate
      }));

      const { error: itemsError } = await supabase.from('project_invoice_items').insert(invoiceItems);
      if (itemsError) throw itemsError;

      // 3. Lock Time Logs by attaching invoice_id
      const timeLogIds = unbilledLogs.map(log => log.id);
      const { error: lockError } = await supabase
        .from('time_logs')
        .update({ invoice_id: invoice.id })
        .in('id', timeLogIds);
        
      if (lockError) throw lockError;

      toast.success(`Invoice ${invoiceNumber} generated successfully!`);
      fetchInvoiceData(); // Refresh UI

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const unbilledHours = unbilledLogs.reduce((sum, log) => sum + Number(log.duration), 0);
  const unbilledAmount = unbilledHours * hourlyRate;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Unbilled Overview */}
        <Card className="border-border shadow-sm md:col-span-1 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="size-5 text-primary" /> Unbilled Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unbilled Hours</p>
              <p className="text-2xl font-bold">{unbilledHours.toFixed(1)} hrs</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Rate</p>
              <p className="text-lg font-medium">${hourlyRate}/hr</p>
            </div>
            
            <div className="space-y-1 pt-4 border-t border-primary/10">
              <p className="text-sm font-medium">Estimated Invoice Total</p>
              <p className="text-3xl font-bold text-primary">${unbilledAmount.toFixed(2)}</p>
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerateInvoice}
              disabled={unbilledLogs.length === 0 || generating || hourlyRate <= 0}
            >
              {generating ? <Loader2 className="size-4 animate-spin mr-2" /> : <FileText className="size-4 mr-2" />}
              Generate Draft Invoice
            </Button>
            
            {hourlyRate <= 0 && unbilledLogs.length > 0 && (
              <p className="text-xs text-destructive text-center">Please set an hourly rate in Settings first.</p>
            )}
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="border-border shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <FileText className="size-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No invoices have been generated for this project yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invoice #</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Hours</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {inv.issue_date ? format(parseISO(inv.issue_date), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.total_hours} hrs</td>
                        <td className="px-4 py-3 font-medium">${Number(inv.total_amount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] uppercase
                              ${inv.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' : ''}
                              ${inv.status === 'SENT' ? 'bg-blue-100 text-blue-700' : ''}
                              ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : ''}
                            `}
                          >
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
