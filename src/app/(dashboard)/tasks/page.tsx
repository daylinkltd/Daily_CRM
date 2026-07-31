'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  CheckSquare,
  MoreHorizontal,
  Plus,
  Calendar,
  AlertCircle,
  List,
  Layers,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  FolderKanban,
  ChevronsUpDown,
  Filter,
  CheckCircle2,
  Sparkles,
  Bookmark,
  Pencil
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TaskForm } from '@/components/tasks/task-form';

type ViewMode = 'list' | 'hierarchy';

export default function GlobalTasksPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);

  // Expansion states for 4-Level Hierarchy View: Project -> Epic -> Task -> Subtask
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const fetchTasks = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Epics
      const { data: epicsData, error: epicsErr } = await supabase
        .from('epics')
        .select('id, name, project_id');

      if (epicsErr) {
        console.warn('Epics query warning:', epicsErr);
      }
      setEpics(epicsData || []);

      // 2. Fetch Tasks assigned to user
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects!tasks_project_id_fkey ( id, name ),
          epic:epics!tasks_epic_id_fkey ( id, name ),
          assignee:workspace_members!tasks_assigned_workspace_member_id_fkey (
            id, user_id
          )
        `)
        .eq('workspace_id', activeWorkspace.id)
        .eq('assigned_workspace_member_id', activeMember.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) {
        toast.error('Failed to load tasks');
      } else {
        const taskList = data || [];
        const assigneeUserIds = taskList.map((t: any) => t.assignee?.user_id).filter(Boolean);
        if (assigneeUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', assigneeUserIds);
          const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
          taskList.forEach((t: any) => {
            if (t.assignee?.user_id) t.assignee.profiles = profileMap[t.assignee.user_id] || null;
          });
        }
        setTasks(taskList);

        // Default all expanded
        const initialProj: Record<string, boolean> = {};
        const initialEpic: Record<string, boolean> = {};
        const initialPar: Record<string, boolean> = {};

        taskList.forEach((t: any) => {
          const projId = t.project_id || 'unassigned';
          const epicKey = `${projId}:${t.epic_id || 'no-epic'}`;
          initialProj[projId] = true;
          initialEpic[epicKey] = true;
          if (!t.parent_id) {
            initialPar[t.id] = true;
          }
        });

        setExpandedProjects(initialProj);
        setExpandedEpics(initialEpic);
        setExpandedParents(initialPar);
      }
    } catch {
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const payload: any = { status };
      if (status === 'completed') payload.completed_at = new Date().toISOString();
      else payload.completed_at = null;

      const { error } = await supabase.from('tasks').update(payload).eq('id', id);
      if (error) throw error;
      toast.success('Task status updated');
      fetchTasks();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handlePriorityChange = async (id: string, priority: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ priority }).eq('id', id);
      if (error) throw error;
      toast.success('Priority updated');
      fetchTasks();
    } catch {
      toast.error('Failed to update priority');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'text-red-600 bg-red-500/15 border-red-200 hover:bg-red-500/25';
      case 'high': return 'text-orange-600 bg-orange-500/15 border-orange-200 hover:bg-orange-500/25';
      case 'medium': return 'text-blue-600 bg-blue-500/15 border-blue-200 hover:bg-blue-500/25';
      case 'low': return 'text-muted-foreground bg-muted/15 border-border hover:bg-muted/30';
      default: return 'text-muted-foreground bg-muted/15 border-border hover:bg-muted/30';
    }
  };

  const getStatusColor = (status?: string) => {
    const s = (status || 'todo').toLowerCase();
    switch (s) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/25';
      case 'in_progress': return 'bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/25';
      case 'review': return 'bg-purple-500/15 text-purple-700 border-purple-200 hover:bg-purple-500/25';
      default: return 'bg-muted/15 text-foreground border-border hover:bg-muted/30';
    }
  };

  // Filter tasks based on search, status, and type
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = !search.trim() || t.title?.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || (t.status || 'todo').toLowerCase() === statusFilter.toLowerCase();
      const matchesType = typeFilter === 'ALL' || (t.task_type || 'PROJECT').toUpperCase() === typeFilter.toUpperCase();
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tasks, search, statusFilter, typeFilter]);

  // 4-Level Hierarchy Grouping: Project -> Epic -> Parent Task -> Subtask
  const hierarchyData = useMemo(() => {
    // 1. Map parent IDs to subtasks
    const subtaskMap = new Map<string, any[]>();
    filteredTasks.forEach((t) => {
      if (t.parent_id) {
        const list = subtaskMap.get(t.parent_id) || [];
        list.push(t);
        subtaskMap.set(t.parent_id, list);
      }
    });

    // 2. Filter top-level tasks (tasks with no parent, OR subtasks whose parent isn't in filtered list)
    const topLevelTasks = filteredTasks.filter((t) => {
      if (!t.parent_id) return true;
      return !filteredTasks.some((parent) => parent.id === t.parent_id);
    });

    // 3. Group by Project
    const projectMap = new Map<string, { id: string; name: string; tasks: any[] }>();
    topLevelTasks.forEach((t) => {
      const projId = t.project_id || 'unassigned';
      const projName = t.project ? t.project.name : 'General & Personal To-dos';
      if (!projectMap.has(projId)) {
        projectMap.set(projId, { id: projId, name: projName, tasks: [] });
      }
      projectMap.get(projId)!.tasks.push({
        ...t,
        subtasks: subtaskMap.get(t.id) || []
      });
    });

    // 4. Group each project's top-level tasks by Epic
    const epicMap = new Map<string, any>(epics.map((e) => [e.id, e]));

    return Array.from(projectMap.values()).map((projectGroup) => {
      const epicGroupMap = new Map<string, { id: string; key: string; name: string; isGeneral: boolean; tasks: any[] }>();

      projectGroup.tasks.forEach((task) => {
        const epicId = task.epic_id || 'no-epic';
        const epicKey = `${projectGroup.id}:${epicId}`;
        const epicObj = epicMap.get(task.epic_id) || task.epic;
        const epicName = epicObj?.name ? epicObj.name : (task.epic_id ? 'Untitled Epic' : 'General Tasks (No Epic)');

        if (!epicGroupMap.has(epicKey)) {
          epicGroupMap.set(epicKey, {
            id: epicId,
            key: epicKey,
            name: epicName,
            isGeneral: !task.epic_id,
            tasks: []
          });
        }
        epicGroupMap.get(epicKey)!.tasks.push(task);
      });

      let projTotal = 0;
      let projCompleted = 0;

      const epicGroups = Array.from(epicGroupMap.values()).map((epicGroup) => {
        epicGroup.tasks.forEach((t) => {
          projTotal += 1;
          if (t.status === 'completed') projCompleted += 1;
          (t.subtasks || []).forEach((st: any) => {
            projTotal += 1;
            if (st.status === 'completed') projCompleted += 1;
          });
        });
        return epicGroup;
      });

      return {
        id: projectGroup.id,
        name: projectGroup.name,
        totalCount: projTotal,
        completedCount: projCompleted,
        epics: epicGroups
      };
    });
  }, [filteredTasks, epics]);

  const toggleProjectExpand = (projId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projId]: !prev[projId] }));
  };

  const toggleEpicExpand = (epicKey: string) => {
    setExpandedEpics((prev) => ({ ...prev, [epicKey]: !prev[epicKey] }));
  };

  const toggleParentExpand = (taskId: string) => {
    setExpandedParents((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleExpandAll = () => {
    const allProjExpanded = Object.values(expandedProjects).every(Boolean);
    const nextState = !allProjExpanded;
    const newProj: Record<string, boolean> = {};
    const newEpic: Record<string, boolean> = {};
    const newPar: Record<string, boolean> = {};

    hierarchyData.forEach((projectGroup) => {
      newProj[projectGroup.id] = nextState;
      projectGroup.epics.forEach((epicGroup) => {
        newEpic[epicGroup.key] = nextState;
        epicGroup.tasks.forEach((t) => {
          newPar[t.id] = nextState;
        });
      });
    });

    setExpandedProjects(newProj);
    setExpandedEpics(newEpic);
    setExpandedParents(newPar);
  };

  // Helper to render task row (and nested subtasks if any)
  const renderTaskRow = (task: any, isSubtask = false) => {
    const isOverdue = task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date();
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = !!expandedParents[task.id];

    return (
      <Fragment key={task.id}>
        <TableRow className={`border-border hover:bg-muted/50 ${isSubtask ? 'bg-muted/20' : ''}`}>
          <TableCell>
            <div className={`flex items-center gap-2 ${isSubtask ? 'pl-6' : ''}`}>
              {isSubtask ? (
                <CornerDownRight className="size-3.5 text-muted-foreground shrink-0" />
              ) : hasSubtasks ? (
                <button
                  type="button"
                  onClick={() => toggleParentExpand(task.id)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0 cursor-pointer border-0 bg-transparent"
                >
                  {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : (
                <div className="w-5 shrink-0" />
              )}

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditTask(task); setFormOpen(true); }}
                    className={`font-medium text-sm text-foreground text-left hover:text-primary transition-colors cursor-pointer border-0 bg-transparent p-0 ${
                      task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {task.title}
                  </button>
                  {hasSubtasks && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                      {task.subtasks.length} {task.subtasks.length === 1 ? 'subtask' : 'subtasks'}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize flex items-center gap-1 mt-0.5">
                  {(task.task_type || 'task').toLowerCase()} Task
                </span>
              </div>
            </div>
          </TableCell>

          <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
            {task.project ? task.project.name : '-'}
          </TableCell>

          {/* Priority Column - Interactive Dropdown */}
          <TableCell className="hidden sm:table-cell">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border transition-colors cursor-pointer select-none",
                      getPriorityColor(task.priority)
                    )}
                  >
                    <span>{task.priority || 'medium'}</span>
                    <ChevronDown className="size-2.5 opacity-70" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-32 bg-popover border-border">
                <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'low')} className="cursor-pointer">
                  Low
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'medium')} className="cursor-pointer">
                  Medium
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'high')} className="cursor-pointer">
                  High
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'urgent')} className="text-red-600 focus:text-red-700 font-medium cursor-pointer">
                  Urgent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>

          {/* Status Column - Interactive Dropdown */}
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase border transition-colors cursor-pointer select-none",
                      getStatusColor(task.status)
                    )}
                  >
                    <span>{(task.status || 'todo').replace('_', ' ')}</span>
                    <ChevronDown className="size-3 opacity-70" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-36 bg-popover border-border">
                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'todo')} className="cursor-pointer">
                  To Do
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')} className="cursor-pointer">
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'review')} className="cursor-pointer">
                  In Review
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange(task.id, 'completed')}
                  className="text-emerald-600 focus:text-emerald-700 font-medium cursor-pointer"
                >
                  Completed (Done)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>

          <TableCell className="hidden lg:table-cell">
            {task.due_date ? (
              <span className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                {isOverdue ? <AlertCircle className="size-3.5" /> : <Calendar className="size-3.5" />}
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>

          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setEditTask(task); setFormOpen(true); }}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Edit Task"
              >
                <Pencil className="size-3.5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none border-0 bg-transparent cursor-pointer"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem onClick={() => { setEditTask(task); setFormOpen(true); }} className="cursor-pointer">
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'todo')} className="cursor-pointer">
                    Mark as To Do
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')} className="cursor-pointer">
                    Mark as In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'review')} className="cursor-pointer">
                    Mark for Review
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange(task.id, 'completed')}
                    className="text-emerald-600 focus:text-emerald-700 cursor-pointer"
                  >
                    Mark as Completed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        </TableRow>

        {/* Render Level 4 Subtasks if parent is expanded */}
        {!isSubtask && hasSubtasks && isExpanded && (
          task.subtasks.map((sub: any) => renderTaskRow(sub, true))
        )}
      </Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="Manage your assigned deliverables across Projects, Epics, Tasks, and Subtasks."
        action={
          <Button onClick={() => { setEditTask(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="size-4 mr-2" />
            New Task
          </Button>
        }
      />

      {/* Toolbar & View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground h-9"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">In Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-9 bg-card border-border">
              <SelectValue placeholder="Task Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="PROJECT">Project Task</SelectItem>
              <SelectItem value="GENERAL">General Task</SelectItem>
              <SelectItem value="SUPPORT">Support</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {viewMode === 'hierarchy' && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-9 px-2.5 text-xs border-border"
              title="Expand or collapse all groups"
            >
              <ChevronsUpDown className="size-3.5 mr-1.5" />
              Toggle All
            </Button>
          )}

          <div className="flex items-center rounded-lg border border-border bg-card p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('hierarchy')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border-0 ${
                viewMode === 'hierarchy'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted bg-transparent'
              }`}
            >
              <Layers className="size-3.5" />
              Hierarchy
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border-0 ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted bg-transparent'
              }`}
            >
              <List className="size-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card py-16 flex flex-col items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading tasks...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 flex flex-col items-center justify-center gap-2 text-center">
          <CheckSquare className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No tasks found</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'Try adjusting your filters or search query.'
              : 'You have no assigned tasks in this workspace.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* FLAT LIST VIEW */
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Task</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Project Context</TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">Priority</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">Due Date</TableHead>
                <TableHead className="text-muted-foreground w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => renderTaskRow(task, false))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* 4-LEVEL HIERARCHY TREE VIEW: PROJECT -> EPIC -> TASK -> SUBTASK */
        <div className="space-y-6">
          {hierarchyData.map((projectGroup) => {
            const isProjectExpanded = expandedProjects[projectGroup.id] ?? true;

            return (
              <div key={projectGroup.id} className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
                {/* Level 1: Project Header Bar */}
                <div
                  onClick={() => toggleProjectExpand(projectGroup.id)}
                  className="flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 cursor-pointer select-none border-b border-border/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isProjectExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <FolderKanban className="size-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">{projectGroup.name}</span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {projectGroup.totalCount} {projectGroup.totalCount === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      {projectGroup.completedCount} / {projectGroup.totalCount} completed
                    </span>
                  </div>
                </div>

                {/* Level 2: Epics inside Project */}
                {isProjectExpanded && (
                  <div className="p-3 space-y-4 bg-background/50">
                    {projectGroup.epics.map((epicGroup) => {
                      const isEpicExpanded = expandedEpics[epicGroup.key] ?? true;

                      return (
                        <div key={epicGroup.key} className="rounded-md border border-border/70 overflow-hidden bg-card">
                          {/* Level 2: Epic Header */}
                          <div
                            onClick={() => toggleEpicExpand(epicGroup.key)}
                            className="flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 cursor-pointer select-none border-b border-border/40 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isEpicExpanded ? (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted-foreground" />
                              )}
                              {epicGroup.isGeneral ? (
                                <Bookmark className="size-3.5 text-muted-foreground" />
                              ) : (
                                <Sparkles className="size-3.5 text-purple-500" />
                              )}
                              <span className={`text-xs font-medium ${epicGroup.isGeneral ? 'text-muted-foreground' : 'text-purple-600 dark:text-purple-400 font-semibold'}`}>
                                {epicGroup.isGeneral ? epicGroup.name : `Epic: ${epicGroup.name}`}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {epicGroup.tasks.length} {epicGroup.tasks.length === 1 ? 'task' : 'tasks'}
                              </Badge>
                            </div>
                          </div>

                          {/* Level 3 & Level 4: Tasks & Subtasks Table */}
                          {isEpicExpanded && (
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border hover:bg-transparent bg-muted/10">
                                  <TableHead className="text-muted-foreground text-xs">Task & Subtask</TableHead>
                                  <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Project Context</TableHead>
                                  <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Priority</TableHead>
                                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                                  <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Due Date</TableHead>
                                  <TableHead className="text-muted-foreground text-xs w-16 text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {epicGroup.tasks.length === 0 ? (
                                  <TableRow className="border-border">
                                    <TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground">
                                      No tasks under this epic.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  epicGroup.tasks.map((task) => renderTaskRow(task, false))
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editTask}
        onSaved={fetchTasks}
      />
    </div>
  );
}
