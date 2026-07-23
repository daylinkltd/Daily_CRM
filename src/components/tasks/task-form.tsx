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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Tags, Eye, EyeOff } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { TaskComments } from '@/components/tasks/task-comments';
import { TaskAttachments } from '@/components/tasks/task-attachments';
import { TaskActivity } from '@/components/tasks/task-activity';
import { TaskTimeLogs } from '@/components/tasks/task-time-logs';
import { LogTimeModal } from '@/components/tasks/log-time-modal';
import { 
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any | null;
  defaultProjectId?: string;
  defaultColumnId?: string;
  defaultParentId?: string;
  onSaved: () => void;
}

export function TaskForm({ open, onOpenChange, task, defaultProjectId, defaultColumnId, defaultParentId, onSaved }: TaskFormProps) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [allComponents, setAllComponents] = useState<any[]>([]);
  const [defaultBillable, setDefaultBillable] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [statusId, setStatusId] = useState('none');
  const [taskType, setTaskType] = useState('GENERAL');
  const [projectId, setProjectId] = useState('none');
  const [assigneeId, setAssigneeId] = useState('none');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState('none');
  const [epicId, setEpicId] = useState('none');
  const [estimatedHours, setEstimatedHours] = useState('');

  // Many-to-Many State
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  
  // Custom Statuses
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);

  // Subtasks State
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  // Time Logging State
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeLogsKey, setTimeLogsKey] = useState(0); // Used to force refresh TaskTimeLogs

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      supabase.from('projects').select('id, name').eq('workspace_id', activeWorkspace.id).eq('status', 'active').then(({ data }) => setProjects(data || []));
      supabase.from('workspace_members').select(`id, profiles:user_id(full_name)`).eq('workspace_id', activeWorkspace.id).then(({ data }) => setMembers(data || []));
      supabase.from('workspace_labels').select('id, name, color').eq('workspace_id', activeWorkspace.id).then(({ data }) => setAllLabels(data || []));

      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setPriority(task.priority || 'medium');
        setStatusId(task.status_id || 'none');
        setTaskType(task.task_type || 'GENERAL');
        setProjectId(task.project_id || 'none');
        setAssigneeId(task.assigned_workspace_member_id || 'none');
        setStartDate(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
        setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
        setSprintId(task.sprint_id || 'none');
        setEpicId(task.epic_id || 'none');
        setEstimatedHours(task.estimated_hours ? task.estimated_hours.toString() : '');
        fetchSubtasks(task.id);
        fetchJoins(task.id);
      } else {
        setTitle('');
        setDescription('');
        setPriority('medium');
        setStatusId('none');
        setTaskType(defaultProjectId ? 'PROJECT' : 'GENERAL');
        setProjectId(defaultProjectId || 'none');
        setAssigneeId(activeMember?.id || 'none'); // Auto assign to self by default
        setStartDate('');
        setDueDate('');
        setSprintId('none');
        setEpicId('none');
        setEstimatedHours('');
        setSelectedLabels([]);
        setSelectedComponents([]);
        setIsWatching(true); // Watch tasks you create
        setSubtasks([]);
      }
    }
  }, [open, task, activeWorkspace?.id, activeMember?.id, defaultProjectId]);

  const fetchJoins = async (taskId: string) => {
    const [labelsRes, compsRes, watcherRes] = await Promise.all([
      supabase.from('task_labels').select('label_id').eq('task_id', taskId),
      supabase.from('task_components').select('component_id').eq('task_id', taskId),
      supabase.from('task_watchers').select('*').eq('task_id', taskId).eq('workspace_member_id', activeMember?.id).maybeSingle()
    ]);
    
    setSelectedLabels(labelsRes.data?.map(l => l.label_id) || []);
    setSelectedComponents(compsRes.data?.map(c => c.component_id) || []);
    setIsWatching(!!watcherRes.data);
  };

  useEffect(() => {
    if (projectId && projectId !== 'none') {
      supabase.from('sprints').select('id, name').eq('project_id', projectId).then(({ data }) => setSprints(data || []));
      supabase.from('epics').select('id, name').eq('project_id', projectId).then(({ data }) => setEpics(data || []));
      supabase.from('project_components').select('id, name').eq('project_id', projectId).then(({ data }) => setAllComponents(data || []));
      supabase.from('projects').select('default_billable_time').eq('id', projectId).single().then(({ data }) => {
        if (data && data.default_billable_time !== undefined) {
          setDefaultBillable(data.default_billable_time);
        }
      });
      supabase.from('project_statuses').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }).then(({ data }) => {
        setProjectStatuses(data || []);
        if (!task?.id && data && data.length > 0 && statusId === 'none') {
          // Default to first status (usually To Do) if not editing an existing task
          setStatusId(data[0].id);
        }
      });
    } else {
      setSprints([]);
      setEpics([]);
      setAllComponents([]);
      setProjectStatuses([]);
      setStatusId('none');
    }
  }, [projectId, supabase, task?.id]);

  const fetchSubtasks = async (parentId: string) => {
    setLoadingSubtasks(true);
    const { data } = await supabase.from('tasks').select('id, title, status, priority').eq('parent_id', parentId).order('created_at', { ascending: true });
    setSubtasks(data || []);
    setLoadingSubtasks(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !activeMember?.id || !title.trim()) return;

    setSaving(true);
    
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status_id: statusId === 'none' ? null : statusId,
        task_type: projectId !== 'none' ? 'PROJECT' : 'GENERAL',
        project_id: projectId === 'none' ? null : projectId,
        assigned_workspace_member_id: assigneeId === 'none' ? null : assigneeId,
        start_date: startDate || null,
        due_date: dueDate || null,
        sprint_id: sprintId === 'none' ? null : sprintId,
        epic_id: epicId === 'none' ? null : epicId,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null
      };

      if (!task?.id && defaultColumnId) {
         payload.column_id = defaultColumnId;
      }
      if (!task?.id && defaultParentId) {
         payload.parent_id = defaultParentId;
      }

      let returnedTaskId = task?.id;

      if (task?.id) {
        payload.updated_at = new Date().toISOString();
        // Since custom statuses don't have hardcoded 'completed', we check if category is DONE
        const currentStatus = projectStatuses.find(s => s.id === statusId);
        if (currentStatus?.category === 'DONE' && task.status_id !== statusId) {
           payload.completed_at = new Date().toISOString();
        } else if (currentStatus?.category !== 'DONE') {
           payload.completed_at = null;
        }
        const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
        if (error) throw error;
      } else {
        payload.workspace_id = activeWorkspace.id;
        payload.created_by_workspace_member_id = activeMember.id;
        
        const { data, error } = await supabase.from('tasks').insert(payload).select('id').single();
        if (error) throw error;
        returnedTaskId = data.id;
      }
      
      // Handle Joins
      if (returnedTaskId) {
        // Labels
        await supabase.from('task_labels').delete().eq('task_id', returnedTaskId);
        if (selectedLabels.length > 0) {
          await supabase.from('task_labels').insert(selectedLabels.map(l => ({ task_id: returnedTaskId, label_id: l })));
        }
        
        // Components
        await supabase.from('task_components').delete().eq('task_id', returnedTaskId);
        if (selectedComponents.length > 0) {
          await supabase.from('task_components').insert(selectedComponents.map(c => ({ task_id: returnedTaskId, component_id: c })));
        }
        
        // Watchers
        if (isWatching) {
          await supabase.from('task_watchers').upsert({ task_id: returnedTaskId, workspace_member_id: activeMember.id });
        } else {
          await supabase.from('task_watchers').delete().eq('task_id', returnedTaskId).eq('workspace_member_id', activeMember.id);
        }
      }

      toast.success(task?.id ? 'Task updated successfully' : 'Task created successfully');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  }

  const renderDetails = () => (
    <form id="task-form" onSubmit={handleSubmit} className="space-y-4 py-4">
      
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 space-y-2">
          <Label>Task Title <span className="text-red-500">*</span></Label>
          <Input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="e.g. Design Landing Page" 
            className="bg-card border-border text-foreground"
            required 
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`mt-6 ${isWatching ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground'}`}
          onClick={() => setIsWatching(!isWatching)}
        >
          {isWatching ? <Eye className="size-4 mr-2" /> : <EyeOff className="size-4 mr-2" />}
          {isWatching ? 'Watching' : 'Watch'}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="Add extra details or links..." 
          className="bg-card border-border text-foreground resize-none"
          rows={3}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={statusId} onValueChange={(val) => setStatusId(val || '')} disabled={projectStatuses.length === 0}>
            <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Select Status" /></SelectTrigger>
            <SelectContent>
              {projectStatuses.length === 0 ? (
                 <SelectItem value="none">No statuses</SelectItem>
              ) : (
                projectStatuses.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(val) => setPriority(val as string)}>
            <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={(val) => setAssigneeId(val as string)}>
            <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Unassigned --</SelectItem>
              {members.map(m => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return <SelectItem key={m.id} value={m.id}>{profile?.full_name || 'Unknown'}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input 
            type="date"
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="bg-card border-border text-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input 
            type="date"
            value={dueDate} 
            onChange={(e) => setDueDate(e.target.value)} 
            className="bg-card border-border text-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label>Est. Hours</Label>
          <Input 
            type="number"
            min="0"
            step="0.5"
            placeholder="0.0"
            value={estimatedHours} 
            onChange={(e) => setEstimatedHours(e.target.value)} 
            className="bg-card border-border text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Labels</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-card border-border text-foreground">
                  <Tags className="size-4 mr-2" />
                  {selectedLabels.length > 0 ? `${selectedLabels.length} labels` : 'Select Labels'}
                </Button>
              }
            />
            <DropdownMenuContent className="w-56 bg-popover border-border">
              {allLabels.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No workspace labels</div>
              ) : (
                allLabels.map(label => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={selectedLabels.includes(label.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedLabels([...selectedLabels, label.id]);
                      else setSelectedLabels(selectedLabels.filter(id => id !== label.id));
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-primary" />
                      {label.name}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {projectId !== 'none' && (
          <div className="space-y-2">
            <Label>Components</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-card border-border text-foreground">
                    {selectedComponents.length > 0 ? `${selectedComponents.length} components` : 'Select Components'}
                  </Button>
                }
              />
              <DropdownMenuContent className="w-56 bg-popover border-border">
                {allComponents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No project components</div>
                ) : (
                  allComponents.map(comp => (
                    <DropdownMenuCheckboxItem
                      key={comp.id}
                      checked={selectedComponents.includes(comp.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedComponents([...selectedComponents, comp.id]);
                        else setSelectedComponents(selectedComponents.filter(id => id !== comp.id));
                      }}
                    >
                      {comp.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      {!defaultParentId && (
        <div className="space-y-4 pt-2 border-t border-border mt-4">
          <div className="space-y-2">
            <Label>Project Context</Label>
            <Select value={projectId} onValueChange={(val) => setProjectId(val as string)}>
              <SelectTrigger className="bg-card border-border"><SelectValue placeholder="General Task (No Project)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- General Task --</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {projectId !== 'none' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Epic</Label>
                <Select value={epicId} onValueChange={(val) => setEpicId(val as string)}>
                  <SelectTrigger className="bg-card border-border"><SelectValue placeholder="No Epic" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Epic --</SelectItem>
                    {epics.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sprint</Label>
                <Select value={sprintId} onValueChange={(val) => setSprintId(val as string)}>
                  <SelectTrigger className="bg-card border-border"><SelectValue placeholder="No Sprint" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Sprint --</SelectItem>
                    {sprints.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-2xl min-h-[500px] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-popover-foreground text-lg">
            {task ? title || 'Edit Task' : (defaultParentId ? 'Create Subtask' : 'Create Task')}
          </DialogTitle>
          {task && (
            <Button variant="outline" size="sm" onClick={() => setShowLogTime(true)} className="mr-6">
              Log Time
            </Button>
          )}
        </DialogHeader>

        {task ? (
          <Tabs defaultValue="details" className="flex-1 flex flex-col mt-2">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Details</TabsTrigger>
              <TabsTrigger value="subtasks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Subtasks</TabsTrigger>
              <TabsTrigger value="comments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Comments</TabsTrigger>
              <TabsTrigger value="attachments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Attachments</TabsTrigger>
              <TabsTrigger value="time_logs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Time Logs</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Activity</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto pt-4">
              <TabsContent value="details" className="mt-0 border-0 p-0">
                {renderDetails()}
              </TabsContent>
              
              <TabsContent value="subtasks" className="mt-0 border-0 p-0 space-y-4">
                {loadingSubtasks ? (
                  <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin" /></div>
                ) : (
                  <>
                    {subtasks.length > 0 ? (
                      <div className="border rounded-md divide-y bg-card">
                        {subtasks.map(st => (
                          <div key={st.id} className="p-3 flex items-center justify-between text-sm">
                            <span className={st.status === 'completed' ? 'line-through text-muted-foreground' : ''}>{st.title}</span>
                            <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">{st.status.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No subtasks found.</p>
                    )}
                    {/* Simplified subtask creation for UI (usually this opens the same modal with parentId, but for now we skip complex nested modals, or just add a hint) */}
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded text-center border border-dashed">
                      Save this task to create new subtasks, or create them from the board.
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="comments" className="mt-0 border-0 p-0 h-full">
                <TaskComments taskId={task.id} />
              </TabsContent>
              
              <TabsContent value="attachments" className="mt-0 border-0 p-0">
                <TaskAttachments taskId={task.id} />
              </TabsContent>

              <TabsContent value="time_logs" className="mt-0 border-0 p-0 h-full">
                <TaskTimeLogs key={timeLogsKey} taskId={task.id} />
              </TabsContent>

              <TabsContent value="activity" className="mt-0 border-0 p-0">
                <TaskActivity taskId={task.id} />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {renderDetails()}
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-border mt-auto">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-border hover:bg-muted">Close</Button>
          <Button type="submit" form="task-form" disabled={saving || !title.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving && <Loader2 className="size-4 animate-spin mr-2" />} {task ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {task && (
        <LogTimeModal
          open={showLogTime}
          onOpenChange={setShowLogTime}
          taskId={task.id}
          projectId={projectId === 'none' ? null : projectId}
          defaultBillable={defaultBillable}
          onSaved={() => setTimeLogsKey(prev => prev + 1)}
        />
      )}
    </Dialog>
  );
}
