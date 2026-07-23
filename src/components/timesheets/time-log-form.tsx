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

interface TimeLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTaskId?: string;
  onSaved: () => void;
}

export function TimeLogForm({ open, onOpenChange, defaultTaskId, onSaved }: TimeLogFormProps) {
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
        .neq('status', 'completed')
        .then(({ data }) => setTasks(data || []));

      setTaskId(defaultTaskId || 'none');
      setLogDate(new Date().toISOString().split('T')[0]);
      setHours('');
      setDescription('');
      setIsBillable(false);
    }
  }, [open, activeWorkspace?.id, activeMember?.id, defaultTaskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !activeMember?.id || !hours || !logDate) return;

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('time_logs')
        .insert({ 
          workspace_id: activeWorkspace.id, 
          workspace_member_id: activeMember.id,
          task_id: taskId === 'none' ? null : taskId,
          log_date: logDate,
          hours_logged: parseFloat(hours),
          description: description.trim() || null,
          is_billable: isBillable
        });
        
      if (error) throw error;
      toast.success('Time logged successfully');
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to log time');
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
                <SelectItem value="none">-- General / Unassigned --</SelectItem>
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
                min="0.25"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 2.5"
                className="bg-card border-border text-foreground"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Description (What did you work on?)</Label>
            <Textarea
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={saving || !hours || !logDate}
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
