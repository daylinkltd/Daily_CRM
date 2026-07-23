'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string | null;
  defaultBillable: boolean;
  onSaved: () => void;
}

export function LogTimeModal({
  open,
  onOpenChange,
  taskId,
  projectId,
  defaultBillable,
  onSaved,
}: LogTimeModalProps) {
  const { activeWorkspace: workspace, activeMember } = useWorkspace();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(defaultBillable);

  // Reset form when opened with new defaults
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]);
      setDuration('');
      setDescription('');
      setBillable(defaultBillable);
    }
  }, [open, defaultBillable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !activeMember || !taskId) return;
    
    const hours = parseFloat(duration);
    if (isNaN(hours) || hours <= 0) {
      toast.error('Please enter a valid duration in hours.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('time_logs').insert({
        workspace_id: workspace.id,
        task_id: taskId,
        workspace_member_id: activeMember.id,
        log_date: date,
        duration: hours,
        description: description.trim() || null,
        billable: billable
      });

      if (error) throw error;

      toast.success('Time logged successfully!');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to log time');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Hours</Label>
              <Input
                id="duration"
                type="number"
                step="0.25"
                min="0.25"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 2.5"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="resize-none h-20"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label>Billable</Label>
              <p className="text-[10px] text-muted-foreground">
                Include this time in client invoices
              </p>
            </div>
            <Switch checked={billable} onCheckedChange={setBillable} />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
