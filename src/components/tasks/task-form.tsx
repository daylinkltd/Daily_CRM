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
import { Loader2, Tags, Eye, EyeOff, CheckSquare, Sparkles, Bookmark, Bug } from 'lucide-react';
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
import { IconAction } from "@/components/ui/icon-action";
import { RichTextArea } from "@/components/ui/rich-textarea";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any | null;
  defaultProjectId?: string;
  defaultColumnId?: string;
  defaultParentId?: string;
  defaultEpicId?: string;
  defaultTaskType?: string;
  onSaved: () => void;
}

export function formatMemberName(m: any): string {
  if (!m) return 'Unassigned';
  if (typeof m.full_name === 'string' && m.full_name.trim() && m.full_name.trim() !== 'Member') {
    return m.full_name.trim();
  }
  const emp = m.employee_profiles;
  if (emp?.first_name || emp?.last_name) {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
    if (fullName) return fullName;
  }
  const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  if (prof?.full_name?.trim()) {
    return prof.full_name.trim();
  }
  const rawEmail = m.email || prof?.email || emp?.email || m.invited_email;
  if (rawEmail && typeof rawEmail === 'string') {
    const handle = rawEmail.split('@')[0].trim();
    if (handle) {
      const formatted = handle
        .split(/[._-]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (formatted) return formatted;
    }
  }
  return 'Member';
}

export function TaskForm({ open, onOpenChange, task, defaultProjectId, defaultColumnId, defaultParentId, defaultEpicId, defaultTaskType, onSaved }: TaskFormProps) {
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
  const [timeLogsKey, setTimeLogsKey] = useState(0);

  // Quick Epic Creation State
  const [showQuickEpicModal, setShowQuickEpicModal] = useState(false);
  const [newEpicNameQuick, setNewEpicNameQuick] = useState('');
  const [isCreatingEpicQuick, setIsCreatingEpicQuick] = useState(false);

  const handleCreateEpicQuick = async () => {
    if (!newEpicNameQuick.trim()) return;
    if (projectId === 'none') {
      toast.error('Please select a project first before creating an epic');
      return;
    }
    setIsCreatingEpicQuick(true);
    try {
      const { data, error } = await supabase
        .from('epics')
        .insert({ project_id: projectId, name: newEpicNameQuick.trim() })
        .select()
        .single();
      if (error) throw error;
      setEpics((prev) => [...prev, data]);
      setEpicId(data.id);
      setNewEpicNameQuick('');
      setShowQuickEpicModal(false);
      toast.success('Epic created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create epic');
    } finally {
      setIsCreatingEpicQuick(false);
    }
  };

  // Quick Component Creation State
  const [showQuickComponentModal, setShowQuickComponentModal] = useState(false);
  const [newComponentNameQuick, setNewComponentNameQuick] = useState('');
  const [isCreatingComponentQuick, setIsCreatingComponentQuick] = useState(false);

  const handleCreateComponentQuick = async () => {
    if (!newComponentNameQuick.trim()) return;
    if (projectId === 'none') {
      toast.error('Please select a project first before creating a component');
      return;
    }
    setIsCreatingComponentQuick(true);
    try {
      const { data, error } = await supabase
        .from('project_components')
        .insert({ project_id: projectId, name: newComponentNameQuick.trim() })
        .select()
        .single();
      if (error) throw error;
      setAllComponents((prev) => [...prev, data]);
      setSelectedComponents((prev) => [...prev, data.id]);
      setNewComponentNameQuick('');
      setShowQuickComponentModal(false);
      toast.success('Component created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create component');
    } finally {
      setIsCreatingComponentQuick(false);
    }
  };

  useEffect(() => {
    if (open && activeWorkspace?.id) {
      supabase.from('projects').select('id, name').eq('workspace_id', activeWorkspace.id).eq('status', 'active').then(({ data }) => setProjects(data || []));
      fetch(`/api/account/members?workspace_id=${activeWorkspace.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.members) {
            setMembers(data.members);
          }
        })
        .catch((err) => {
          console.error('[TaskForm] member fetch error:', err);
        });
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
        setEpicId('none'); // Will be set after epics load (see effect below)
        setEstimatedHours('');
        setSelectedLabels([]);
        setSelectedComponents([]);
        setIsWatching(true); // Watch tasks you create
        setSubtasks([]);
        if (defaultTaskType) setTaskType(defaultTaskType);
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
      // `epics` has no `title` — selecting it errored and left the epic
      // dropdown permanently empty. The UI renders `name` anyway.
      supabase.from('epics').select('id, name').eq('project_id', projectId).then(({ data }) => {
        const loaded = data || [];
        setEpics(loaded);
        // Apply defaultEpicId only after epics are loaded so SelectItem exists
        if (!task?.id && defaultEpicId && defaultEpicId !== 'none') {
          const found = loaded.find(e => e.id === defaultEpicId);
          if (found) setEpicId(defaultEpicId);
        }
      });
      supabase.from('project_components').select('id, name').eq('project_id', projectId).then(({ data }) => setAllComponents(data || []));
      supabase.from('projects').select('default_billable_time').eq('id', projectId).single().then(({ data }) => {
        if (data && data.default_billable_time !== undefined) {
          setDefaultBillable(data.default_billable_time);
        }
      });
      supabase.from('project_statuses').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }).then(({ data }) => {
        setProjectStatuses(data || []);
        if (!task?.id && data && data.length > 0 && statusId === 'none') {
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
  }, [projectId, supabase, task?.id, defaultEpicId]);

  const fetchSubtasks = async (parentId: string) => {
    setLoadingSubtasks(true);
    // No `status` column on tasks; it was never read from this result anyway.
    const { data } = await supabase.from('tasks').select('id, title, priority').eq('parent_id', parentId).order('created_at', { ascending: true });
    setSubtasks(data || []);
    setLoadingSubtasks(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !activeMember?.id || !title.trim()) return;

    setSaving(true);
    
    try {
      const currentStatusObj = projectStatuses.find(s => s.id === statusId);
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status_id: statusId === 'none' ? null : statusId,
        task_type: ['TASK', 'FEATURE', 'STORY', 'BUG'].includes(taskType) ? taskType : 'TASK',
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
    <form id="task-form" onSubmit={handleSubmit} className="space-y-3 py-2">
      
      <div className="flex justify-between items-start gap-3">
        <div className="w-[130px] space-y-1.5 shrink-0">
          <Label className="text-xs">Issue Type</Label>
          <Select value={taskType} onValueChange={(val) => setTaskType(val as string)}>
            <SelectTrigger className="bg-card border-border h-9">
              <SelectValue>
                {(() => {
                  switch (taskType) {
                    case 'FEATURE':
                      return <span className="flex items-center gap-1.5 font-medium text-xs"><Sparkles className="size-3.5 text-emerald-500 shrink-0" /> Feature</span>;
                    case 'STORY':
                      return <span className="flex items-center gap-1.5 font-medium text-xs"><Bookmark className="size-3.5 text-green-600 shrink-0" /> Story</span>;
                    case 'BUG':
                      return <span className="flex items-center gap-1.5 font-medium text-xs"><Bug className="size-3.5 text-red-500 shrink-0" /> Bug</span>;
                    default:
                      return <span className="flex items-center gap-1.5 font-medium text-xs"><CheckSquare className="size-3.5 text-blue-500 shrink-0" /> Task</span>;
                  }
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TASK" label="Task">
                <span className="flex items-center gap-2 text-xs"><CheckSquare className="size-4 text-blue-500" /> Task</span>
              </SelectItem>
              <SelectItem value="FEATURE" label="Feature">
                <span className="flex items-center gap-2 text-xs"><Sparkles className="size-4 text-emerald-500" /> Feature</span>
              </SelectItem>
              <SelectItem value="STORY" label="Story">
                <span className="flex items-center gap-2 text-xs"><Bookmark className="size-4 text-green-600" /> Story</span>
              </SelectItem>
              <SelectItem value="BUG" label="Bug">
                <span className="flex items-center gap-2 text-xs"><Bug className="size-4 text-red-500" /> Bug</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Task Title <span className="text-red-500">*</span></Label>
          <Input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="e.g. Design Landing Page" 
            className="bg-card border-border text-foreground h-9"
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
        <RichTextArea 
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
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Select Status">
                {statusId === 'none' ? 'No statuses' : projectStatuses.find(s => s.id === statusId)?.name}
              </SelectValue>
            </SelectTrigger>
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
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Unassigned">
                {assigneeId === 'none' || !assigneeId
                  ? '-- Unassigned --'
                  : formatMemberName(members.find((mem) => mem.id === assigneeId))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Unassigned --</SelectItem>
              {members.map(m => {
                const name = formatMemberName(m);
                return <SelectItem key={m.id} value={m.id} label={name}>{name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Epic Selector */}
        {projectId && projectId !== 'none' && (
          <div className="space-y-2">
            <Label>Epic</Label>
            <Select value={epicId} onValueChange={(val) => setEpicId(val)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="-- No Epic --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- No Epic --</SelectItem>
                {epics.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.title || e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
            <div className="flex items-center justify-between">
              <Label>Components</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 px-1 text-[11px] text-primary hover:text-primary/80 font-medium"
                onClick={() => setShowQuickComponentModal(true)}
              >
                + New Component
              </Button>
            </div>
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
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="General Task (No Project)">
                  {projectId === 'none' ? '-- General Task --' : projects.find(p => p.id === projectId)?.name}
                </SelectValue>
              </SelectTrigger>
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
                <div className="flex items-center justify-between">
                  <Label>Epic</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 px-1 text-[11px] text-primary hover:text-primary/80 font-medium"
                    onClick={() => setShowQuickEpicModal(true)}
                  >
                    + New Epic
                  </Button>
                </div>
                <Select value={epicId} onValueChange={(val) => setEpicId(val as string)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="No Epic">
                      {epicId === 'none' ? '-- No Epic --' : epics.find(e => e.id === epicId)?.name}
                    </SelectValue>
                  </SelectTrigger>
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
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="No Sprint">
                      {sprintId === 'none' ? '-- No Sprint --' : sprints.find(s => s.id === sprintId)?.name}
                    </SelectValue>
                  </SelectTrigger>
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
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-xl w-full max-h-[85vh] flex flex-col p-6 overflow-y-auto overflow-x-hidden">
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
                            <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded-none">{st.status.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No subtasks found.</p>
                    )}
                    {/* Simplified subtask creation for UI (usually this opens the same modal with parentId, but for now we skip complex nested modals, or just add a hint) */}
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-none text-center border border-dashed">
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

      <Dialog open={showQuickEpicModal} onOpenChange={setShowQuickEpicModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Epic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Epic Name</Label>
              <Input
                value={newEpicNameQuick}
                onChange={(e) => setNewEpicNameQuick(e.target.value)}
                placeholder="e.g. User Authentication Q3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateEpicQuick();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickEpicModal(false)} disabled={isCreatingEpicQuick}>
              Cancel
            </Button>
            <Button onClick={handleCreateEpicQuick} disabled={isCreatingEpicQuick || !newEpicNameQuick.trim()} className="font-bold">
              {isCreatingEpicQuick ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Epic'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickComponentModal} onOpenChange={setShowQuickComponentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Component Name</Label>
              <Input
                value={newComponentNameQuick}
                onChange={(e) => setNewComponentNameQuick(e.target.value)}
                placeholder="e.g. Frontend, API Engine, Auth Module"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateComponentQuick();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickComponentModal(false)} disabled={isCreatingComponentQuick}>
              Cancel
            </Button>
            <Button onClick={handleCreateComponentQuick} disabled={isCreatingComponentQuick || !newComponentNameQuick.trim()} className="font-bold">
              {isCreatingComponentQuick ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Component'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
