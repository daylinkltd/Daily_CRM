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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { RichTextArea } from "@/components/ui/rich-textarea";

interface LeaveRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function LeaveRequestForm({ open, onOpenChange, onSaved }: LeaveRequestFormProps) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Paid Time Off', 'Unpaid Leave', 'Maternity/Paternity'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !activeMember?.id || !leaveType || !fromDate || !toDate) return;

    if (new Date(toDate) < new Date(fromDate)) {
      toast.error('End date cannot be before start date.');
      return;
    }

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({ 
          workspace_id: activeWorkspace.id, 
          workspace_member_id: activeMember.id,
          leave_type: leaveType, 
          from_date: fromDate,
          to_date: toDate,
          reason: reason.trim(),
          status: 'pending'
        });
        
      if (error) throw error;
      toast.success('Leave request submitted successfully');
      
      // Reset form
      setLeaveType('');
      setFromDate('');
      setToDate('');
      setReason('');
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Request Leave
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-foreground">
              Leave Type <span className="text-red-500">*</span>
            </Label>
            <Select value={leaveType} onValueChange={(val) => setLeaveType(val || '')} required>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">From Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-card border-border text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">To Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-card border-border text-foreground"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Reason / Remarks (Optional)</Label>
            <RichTextArea plain
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a brief explanation..."
              className="bg-card border-border text-foreground resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="pt-4 border-t border-border mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={saving || !leaveType || !fromDate || !toDate}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
