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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/hooks/use-workspace';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';

interface TimeLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTaskId?: string;
  defaultHours?: string | number;
  onSaved: () => void;
}

export function TimeLogForm({ open, onOpenChange, defaultTaskId, defaultHours, onSaved }: TimeLogFormProps) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  // Form State
  const [taskId, setTaskId] = useState('none');
  const [logDate, setLogDate] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(false);

  useEffect(() => {
    if (open && activeWorkspace?.id && activeMember?.id) {
      // Fetch open tasks assigned to the user
      supabase.from('tasks')
        .select('id, title, project_id, project:projects!tasks_project_id_fkey(name)')
        .eq('workspace_id', activeWorkspace.id)
        .eq('assigned_workspace_member_id', activeMember.id)
        .neq('status', 'DONE')
        .then(({ data }) => setTasks(data || []));

      setTaskId(defaultTaskId || 'none');
      setLogDate(new Date().toISOString().split('T')[0]);
      setHours(defaultHours ? String(defaultHours) : '');
      setDescription('');
      setIsBillable(false);
    }
    // `supabase` is the memoised browser singleton from createClient(), so its
    // identity is stable and listing it cannot re-trigger this effect.
  }, [open, activeWorkspace?.id, activeMember?.id, defaultTaskId, defaultHours, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hours || Number(hours) <= 0) {
      toast.error('Please enter valid hours logged (e.g. 2.5)');
      return;
    }

    if (!logDate) {
      toast.error('Please select a date');
      return;
    }

    // time_logs.task_id is NOT NULL in the schema — an unassigned
    // log can't be stored, so require a task instead of failing the
    // insert with a raw constraint error.
    if (!taskId || taskId === 'none') {
      toast.error('Pick the task this time was spent on');
      return;
    }

    if (!activeWorkspace?.id || !activeMember?.id) return;

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('time_logs')
        .insert({ 
          workspace_id: activeWorkspace.id, 
          workspace_member_id: activeMember.id,
          task_id: taskId,
          log_date: logDate,
          duration: parseFloat(hours),
          description: description.trim() || null,
          billable: isBillable
        });
        
      if (error) throw error;
      toast.success('Time logged successfully');
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to log time');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Log Time
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          
          <div className="space-y-2">
            <Label className="text-foreground">Task / Project</Label>
            <Select value={taskId} onValueChange={(val) => setTaskId(val as string)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="General (No Specific Task)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select a task --</SelectItem>
                {tasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title} {t.project ? `(${t.project.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-card border-border text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Hours Logged <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.25"
                min="0.1"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 2.5"
                className="bg-card border-border text-foreground font-semibold"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Description (What did you work on?)</Label>
            <Textarea plain
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief details..."
              className="bg-card border-border text-foreground resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch id="billable" checked={isBillable} onCheckedChange={setIsBillable} />
            <Label htmlFor="billable" className="text-sm font-normal text-muted-foreground cursor-pointer">
              Mark as billable time (for project invoicing)
            </Label>
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
