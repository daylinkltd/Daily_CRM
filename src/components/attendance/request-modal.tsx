'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileCheck2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';

interface AttendanceRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}

export function AttendanceRequestModal({ open, onOpenChange, onSubmitted }: AttendanceRequestModalProps) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<'MISSED_PUNCH' | 'CORRECTION' | 'EARLY_EXIT' | 'WFH' | 'OVERTIME'>('MISSED_PUNCH');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestedPunchIn, setRequestedPunchIn] = useState('09:00');
  const [requestedPunchOut, setRequestedPunchOut] = useState('18:00');
  const [reason, setReason] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please enter a reason for your request');
      return;
    }

    if (!activeWorkspace?.id || !activeMember?.id) return;
    setSubmitting(true);

    try {
      const punchInISO = `${attendanceDate}T${requestedPunchIn}:00.000Z`;
      const punchOutISO = `${attendanceDate}T${requestedPunchOut}:00.000Z`;

      const { error } = await supabase
        .from('hr_attendance_requests')
        .insert({
          workspace_id: activeWorkspace.id,
          workspace_member_id: activeMember.id,
          request_type: requestType,
          attendance_date: attendanceDate,
          requested_punch_in: punchInISO,
          requested_punch_out: punchOutISO,
          reason: reason.trim(),
          status: 'PENDING',
        });

      if (error) throw error;

      toast.success('Attendance request submitted for manager approval');
      onSubmitted();
      onOpenChange(false);
      setReason('');
    } catch (err: any) {
      toast.error(sanitizeErrorMessage(err, 'Failed to submit request'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2 text-lg font-bold">
            <FileCheck2 className="h-5 w-5 text-[#00aef0]" />
            Request Attendance Regularization
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div>
            <Label className="text-slate-300 mb-1 block">Request Type</Label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-xs font-semibold focus:border-[#00aef0]"
            >
              <option value="MISSED_PUNCH">Missed Punch (Forgot to Punch In/Out)</option>
              <option value="CORRECTION">Attendance Correction</option>
              <option value="EARLY_EXIT">Early Exit Approval</option>
              <option value="WFH">Work From Home Approval</option>
              <option value="OVERTIME">Overtime Hours Claim</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-slate-300 mb-1 block">Date *</Label>
              <Input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
                required
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Punch In</Label>
              <Input
                type="time"
                value={requestedPunchIn}
                onChange={(e) => setRequestedPunchIn(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Punch Out</Label>
              <Input
                type="time"
                value={requestedPunchOut}
                onChange={(e) => setRequestedPunchOut(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300 mb-1 block">Reason / Justification *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed explanation for your manager..."
              className="bg-slate-950 border-slate-800 text-white text-xs resize-none"
              rows={3}
              required
            />
          </div>

          <DialogFooter className="pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20"
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
