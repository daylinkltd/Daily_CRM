'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileCheck, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { IconAction } from "@/components/ui/icon-action";

const REQUEST_TYPES = [
  { value: 'SALARY_CERTIFICATE', label: 'Salary Certificate Request' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience & Relieving Letter' },
  { value: 'BANK_DETAILS_CHANGE', label: 'Bank Account Details Change' },
  { value: 'PF_DECLARATION', label: 'PF Declaration / Transfer' },
  { value: 'ADDRESS_CHANGE', label: 'Personal Address Change' },
  { value: 'RESIGNATION', label: 'Official Resignation Intimation' }
];

export default function EmployeeRequestsPage() {
  const { activeWorkspace, activeMember, can } = useWorkspace();
  const canManage = can('people_manage');

  async function decideRequest(requestId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const res = await fetch('/api/hr/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update request');
      toast.success(`Request ${status.toLowerCase()}`);
      void fetchRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update request');
    }
  }


  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [requestType, setRequestType] = useState('SALARY_CERTIFICATE');
  const [notes, setNotes] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/hr/requests?workspaceId=${activeWorkspace.id}`);
      const json = await res.json();
      setRequests(json.requests || []);
    } catch {
      toast.error('Failed to load employee requests');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !activeMember?.id) return;

    setSaving(true);
    try {
      const res = await fetch('/api/hr/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          employeeId: activeMember.id,
          requestType,
          notes
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Request submitted to HR');
      setNotes('');
      setModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Self-Service Requests"
        description="Submit and track HR requests for salary certificates, experience letters, bank account changes, and formal requests."
        action={
          <IconAction label="New ESS Request" icon={<Plus className="size-4 " />} onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground" />
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="size-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No ESS Requests Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Submit employee self-service requests for certificates, bank account updates, or official letters.
            </p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4 mr-2" /> Submit First Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map(r => (
            <Card key={r.id} className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono bg-secondary/50">
                    {r.request_type.replace(/_/g, ' ')}
                  </Badge>
                  <Badge
                    variant={r.status === 'APPROVED' ? 'default' : r.status === 'REJECTED' ? 'destructive' : 'secondary'}
                    className={r.status === 'APPROVED' ? 'bg-emerald-600 text-foreground' : ''}
                  >
                    {r.status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold mt-2">{r.request_type.replace(/_/g, ' ')}</CardTitle>
                <CardDescription className="text-xs line-clamp-2 mt-1">{r.notes || 'Employee request submission.'}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground border-t border-border/50 flex items-center justify-between mt-3 pt-3">
                <span>Submitted {new Date(r.created_at).toLocaleDateString()}</span>
                {r.status === 'PENDING' && canManage ? (
                  <span className="flex items-center gap-2">
                    <button
                      className="text-emerald-500 hover:underline"
                      onClick={() => decideRequest(r.id, 'APPROVED')}
                    >
                      Approve
                    </button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => decideRequest(r.id, 'REJECTED')}
                    >
                      Reject
                    </button>
                  </span>
                ) : (
                  <span>{r.status === 'PENDING' ? '⏳ Under HR Review' : 'Resolved'}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Submit Request Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Employee Self-Service Request</DialogTitle>
            <DialogDescription>Select the request type and provide details for HR processing.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRequest} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={(val) => setRequestType(val || 'SALARY_CERTIFICATE')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map(rt => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Details / Notes for HR</Label>
              <Textarea plain
                placeholder="Provide context or the reason for the request. Do NOT include bank details here — HR will collect them securely."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
