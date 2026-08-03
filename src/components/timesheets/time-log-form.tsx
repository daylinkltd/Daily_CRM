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
import { Loader2, Plus, Sparkles, Trash2, Clock, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { sanitizeErrorMessage } from '@/lib/commerce/barcode-utils';

interface LogEntryItem {
  id: string;
  taskId: string;
  hours: string;
  description: string;
  isBillable: boolean;
  showQuickTask: boolean;
  quickTaskTitle: string;
  creatingTask?: boolean;
}

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
  const [logDate, setLogDate] = useState('');

  // Multi-Entry Form State
  const [entries, setEntries] = useState<LogEntryItem[]>([]);

  useEffect(() => {
    if (open && activeWorkspace?.id && activeMember?.id) {
      // Fetch open tasks assigned to the user
      supabase.from('tasks')
        .select('id, title, project_id, project:projects!tasks_project_id_fkey(name)')
        .eq('workspace_id', activeWorkspace.id)
        .eq('assigned_workspace_member_id', activeMember.id)
        .neq('status', 'DONE')
        .then(({ data }) => setTasks(data || []));

      setLogDate(new Date().toISOString().split('T')[0]);
      
      // Initialize with default or single entry
      setEntries([
        {
          id: Math.random().toString(36).substring(2, 9),
          taskId: defaultTaskId || 'none',
          hours: defaultHours ? String(defaultHours) : '',
          description: '',
          isBillable: false,
          showQuickTask: false,
          quickTaskTitle: '',
        },
      ]);
    }
  }, [open, activeWorkspace?.id, activeMember?.id, defaultTaskId, defaultHours, supabase]);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        taskId: 'none',
        hours: '',
        description: '',
        isBillable: false,
        showQuickTask: false,
        quickTaskTitle: '',
      },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const updateEntry = (id: string, updates: Partial<LogEntryItem>) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  async function handleCreateQuickTaskForEntry(entryId: string) {
    const target = entries.find((e) => e.id === entryId);
    if (!target || !target.quickTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    if (!activeWorkspace?.id || !activeMember?.id) return;

    updateEntry(entryId, { creatingTask: true });
    try {
      const payload: any = {
        workspace_id: activeWorkspace.id,
        created_by_workspace_member_id: activeMember.id,
        assigned_workspace_member_id: activeMember.id,
        title: target.quickTaskTitle.trim(),
        priority: 'MEDIUM',
      };

      let { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select('id, title')
        .single();

      if (error && error.message?.includes('status')) {
        delete payload.status;
        const retry = await supabase
          .from('tasks')
          .insert({ ...payload, status: 'todo' })
          .select('id, title')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (!data) throw new Error('Failed to retrieve created task');

      toast.success(`Task "${data.title}" created & selected!`);
      setTasks((prev) => [data, ...prev]);
      updateEntry(entryId, {
        taskId: data.id,
        showQuickTask: false,
        quickTaskTitle: '',
      });
    } catch (err: any) {
      toast.error(sanitizeErrorMessage(err, 'Failed to create task'));
    } finally {
      updateEntry(entryId, { creatingTask: false });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!logDate) {
      toast.error('Please select a date');
      return;
    }

    // Validate all entries
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const hrs = parseFloat(entry.hours);
      if (isNaN(hrs) || hrs <= 0) {
        toast.error(`Entry #${i + 1}: Please enter valid hours (e.g. 2.5)`);
        return;
      }
      if (!entry.taskId || entry.taskId === 'none') {
        toast.error(`Entry #${i + 1}: Please pick or create a task`);
        return;
      }
    }

    if (!activeWorkspace?.id || !activeMember?.id) return;

    setSaving(true);
    try {
      const timeLogPayloads = entries.map((entry) => ({
        workspace_id: activeWorkspace.id,
        workspace_member_id: activeMember.id,
        task_id: entry.taskId,
        log_date: logDate,
        duration: parseFloat(entry.hours),
        description: entry.description.trim() || null,
        billable: entry.isBillable,
      }));

      const { error } = await supabase.from('time_logs').insert(timeLogPayloads);
      if (error) throw error;

      const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0);
      toast.success(`Successfully logged ${entries.length} time ${entries.length === 1 ? 'entry' : 'entries'} (${totalHours.toFixed(1)} hrs total)!`);

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to save time entries');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const totalHours = entries.reduce((sum, e) => {
    const val = parseFloat(e.hours);
    return isNaN(val) ? sum : sum + val;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        
        {/* Modal Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Clock className="size-5 text-primary" /> Log Daily Time
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add multiple task entries for the day in a single submission.
              </p>
            </div>
            {totalHours > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono font-bold px-3 py-1 text-xs">
                Total: {totalHours.toFixed(2)} hrs
              </Badge>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1 max-h-[60vh]">
            
            {/* Global Date Input */}
            <div className="flex items-center justify-between gap-4 p-3.5 bg-muted/40 border border-border rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <Label className="text-sm font-semibold text-foreground">Log Date <span className="text-red-500">*</span></Label>
              </div>
              <Input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-card border-border text-foreground text-sm w-44 font-medium"
                required
              />
            </div>

            {/* Entries List */}
            <div className="space-y-4">
              {entries.map((entry, index) => (
                <div key={entry.id} className="p-4 bg-card border border-border rounded-xl space-y-3.5 relative shadow-xs group">
                  
                  {/* Card Entry Header */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      Entry #{index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateEntry(entry.id, { showQuickTask: !entry.showQuickTask })}
                        className="h-6 px-2 text-[11px] font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 gap-1 rounded-md"
                      >
                        <Plus className="size-3" />
                        {entry.showQuickTask ? 'Select Task' : 'Create Task'}
                      </Button>
                      {entries.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEntry(entry.id)}
                          className="size-6 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-md"
                          title="Remove entry"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Task Selector / Quick Task */}
                  {entry.showQuickTask ? (
                    <div className="p-3 bg-muted/50 border border-primary/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" /> Create New Task
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Quick Add
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={entry.quickTaskTitle}
                          onChange={(e) => updateEntry(entry.id, { quickTaskTitle: e.target.value })}
                          placeholder="Task title (e.g., Client Meeting / Bug Fix)..."
                          className="bg-card border-border text-foreground text-xs h-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateQuickTaskForEntry(entry.id);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={entry.creatingTask || !entry.quickTaskTitle.trim()}
                          onClick={() => handleCreateQuickTaskForEntry(entry.id)}
                          className="h-9 px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 rounded-lg"
                        >
                          {entry.creatingTask ? <Loader2 className="size-3.5 animate-spin" /> : 'Create'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Select
                        value={entry.taskId}
                        onValueChange={(val) => {
                          if (val === 'create_new_task') {
                            updateEntry(entry.id, { showQuickTask: true });
                          } else {
                            updateEntry(entry.id, { taskId: val });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background border-border text-sm font-medium">
                          <SelectValue placeholder="-- Select a task --">
                            {(val: any) => {
                              if (!val || val === 'none') return '-- Select a task --';
                              const taskObj = tasks.find((t) => t.id === val);
                              if (taskObj) {
                                return `${taskObj.title}${taskObj.project?.name ? ` (${taskObj.project.name})` : ''}`;
                              }
                              return '-- Select a task --';
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Select a task --</SelectItem>
                          <SelectItem value="create_new_task" className="text-primary font-semibold">
                            + Create New Task
                          </SelectItem>
                          {tasks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.title} {t.project ? `(${t.project.name})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Hours & Billable Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <Label className="text-xs font-medium text-foreground">Hours Logged <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0.1"
                        max="24"
                        value={entry.hours}
                        onChange={(e) => updateEntry(entry.id, { hours: e.target.value })}
                        placeholder="e.g. 2.5"
                        className="bg-background border-border text-foreground font-semibold text-sm h-9 mt-1"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between sm:justify-start sm:gap-3 pt-5">
                      <Switch
                        id={`billable-${entry.id}`}
                        checked={entry.isBillable}
                        onCheckedChange={(val) => updateEntry(entry.id, { isBillable: val })}
                      />
                      <Label htmlFor={`billable-${entry.id}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                        Billable time
                      </Label>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-xs font-medium text-foreground">Description (Optional)</Label>
                    <Textarea plain
                      value={entry.description}
                      onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                      placeholder="What did you work on for this task?"
                      className="bg-background border-border text-foreground resize-none text-xs h-16 mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Another Entry Button */}
            <Button
              type="button"
              variant="outline"
              onClick={addEntry}
              className="w-full py-2.5 text-xs font-bold border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 gap-2 rounded-xl"
            >
              <Plus className="size-4" /> Add Another Task Entry
            </Button>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5"
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              {saving
                ? 'Saving Entries...'
                : entries.length > 1
                ? `Save All ${entries.length} Entries (${totalHours.toFixed(1)} hrs)`
                : 'Save Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
