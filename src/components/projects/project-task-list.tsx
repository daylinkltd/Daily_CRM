'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Loader2, 
  Plus, 
  Search, 
  Calendar, 
  CheckSquare, 
  Sparkles, 
  Bookmark, 
  Bug, 
  ChevronRight,
  ChevronDown,
  Layers,
  CornerDownRight,
  ChevronsUpDown,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskForm, formatMemberName } from '@/components/tasks/task-form';
import { format } from 'date-fns';

import { EpicDetailsModal } from '@/components/projects/epic-details-modal';

interface ProjectTaskListProps {
  projectId: string;
  canManage: boolean;
}

export function ProjectTaskList({ projectId, canManage }: ProjectTaskListProps) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupByEpic, setGroupByEpic] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [allExpanded, setAllExpanded] = useState(true);

  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);

  // Quick-add under epic
  const [quickAddEpicId, setQuickAddEpicId] = useState<string | null>(null);
  const [quickAddType, setQuickAddType] = useState<string>('TASK');

  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [selectedEpicIdModal, setSelectedEpicIdModal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      const [tasksRes, epicsRes, membersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, project_statuses(id, name, color, category)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('epics')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
        fetch('/api/account/members').then((r) => r.json()).catch(() => ({ members: [] })),
      ]);

      const loadedTasks = tasksRes.data || [];
      const memberList = membersRes?.members || [];
      const loadedEpics = epicsRes.data || [];

      setEpics(loadedEpics);

      const memberMap = new Map(memberList.map((m: any) => [m.id, m]));
      const enriched = loadedTasks.map((t: any) => ({
        ...t,
        assignee_member: t.assigned_workspace_member_id
          ? memberMap.get(t.assigned_workspace_member_id)
          : null,
      }));

      setTasks(enriched);

      // Expand all epics by default
      const expE: Record<string, boolean> = {};
      loadedEpics.forEach((e: any) => (expE[e.id] = true));
      expE['no-epic'] = true;
      setExpandedEpics(expE);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load project hierarchy');
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleEpic = (epicId: string) => {
    setExpandedEpics((prev) => ({ ...prev, [epicId]: !prev[epicId] }));
  };

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleExpandAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);

    const expE: Record<string, boolean> = {};
    epics.forEach((e) => (expE[e.id] = nextState));
    expE['no-epic'] = nextState;
    setExpandedEpics(expE);

    const expT: Record<string, boolean> = {};
    tasks.forEach((t) => (expT[t.id] = nextState));
    setExpandedTasks(expT);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = t.title?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'ALL' || (t.task_type || 'TASK').toUpperCase() === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [tasks, search, typeFilter]);

  // Group top-level tasks by Epic
  const epicGroups = useMemo(() => {
    const topLevelTasks = filteredTasks.filter((t) => !t.parent_id);
    const subtaskMap = new Map<string, any[]>();

    filteredTasks.forEach((t) => {
      if (t.parent_id) {
        const list = subtaskMap.get(t.parent_id) || [];
        list.push(t);
        subtaskMap.set(t.parent_id, list);
      }
    });

    const groups: Array<{ id: string; name: string; tasks: any[] }> = epics.map((e) => ({
      id: e.id,
      name: e.name,
      tasks: topLevelTasks
        .filter((t) => t.epic_id === e.id)
        .map((t) => ({ ...t, subtasks: subtaskMap.get(t.id) || [] })),
    }));

    const orphanTasks = topLevelTasks
      .filter((t) => !t.epic_id || !epics.some((e) => e.id === t.epic_id))
      .map((t) => ({ ...t, subtasks: subtaskMap.get(t.id) || [] }));

    if (orphanTasks.length > 0 || groups.length === 0) {
      groups.push({
        id: 'no-epic',
        name: 'No Epic / General Tasks',
        tasks: orphanTasks,
      });
    }

    return groups;
  }, [filteredTasks, epics]);

  const getIssueIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'FEATURE':
        return <Sparkles className="size-4 text-emerald-500 shrink-0" />;
      case 'STORY':
        return <Bookmark className="size-4 text-green-600 shrink-0" />;
      case 'BUG':
        return <Bug className="size-4 text-red-500 shrink-0" />;
      default:
        return <CheckSquare className="size-4 text-blue-500 shrink-0" />;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-medium bg-red-500/10 text-red-600 border border-red-200/50">Urgent</span>;
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">High</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-medium bg-blue-500/10 text-blue-600 border border-blue-200/50">Medium</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-medium bg-muted/10 text-muted-foreground border border-border/50">Low</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border h-9 text-sm"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-9 bg-card border-border text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="All Types" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="TASK">Task 🟦</SelectItem>
              <SelectItem value="FEATURE">Feature ✨</SelectItem>
              <SelectItem value="STORY">Story 🔖</SelectItem>
              <SelectItem value="BUG">Bug 🐞</SelectItem>
            </SelectContent>
          </Select>

          {/* Group Switcher */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupByEpic(!groupByEpic)}
            className={`h-9 text-xs border-border ${groupByEpic ? 'bg-primary/10 text-primary border-primary/20' : 'bg-card text-muted-foreground'}`}
          >
            <Layers className="size-3.5 mr-1.5" />
            {groupByEpic ? 'Grouped by Epic' : 'Flat List'}
          </Button>

          {/* Expand/Collapse All */}
          {groupByEpic && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-9 text-xs border-border bg-card text-muted-foreground"
              title="Expand or collapse all groups"
            >
              <ChevronsUpDown className="size-3.5 mr-1.5" />
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditTask(null);
              setFormOpen(true);
            }}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <Plus className="size-4 mr-1.5" /> Add Task
          </Button>
        )}
      </div>

      {/* Jira Hierarchy Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <Table className="w-full">
          <TableHeader className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 px-4 w-12 text-center">Type</TableHead>
              <TableHead className="py-3 px-4">Task / Story / Bug</TableHead>
              <TableHead className="py-3 px-4 w-32">Status</TableHead>
              <TableHead className="py-3 px-4 w-28">Priority</TableHead>
              <TableHead className="py-3 px-4 w-40">Assignee</TableHead>
              <TableHead className="py-3 px-4 w-32 text-right">Due Date</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border/60">
            {groupByEpic ? (
              epicGroups.length === 0 || epicGroups.every((g) => g.tasks.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center text-sm text-muted-foreground">
                    No items match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                epicGroups.map((group) => {
                  if (group.tasks.length === 0) return null;
                  const isExpanded = expandedEpics[group.id] !== false;

                  return (
                    <Fragment key={`group-${group.id}`}>
                      {/* Epic Header Row */}
                      <TableRow
                        className="bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer border-t border-b border-border/80"
                        onClick={() => toggleEpic(group.id)}
                      >
                        <TableCell colSpan={6} className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                            <span 
                              className="font-semibold text-xs uppercase tracking-wide text-foreground hover:text-purple-600 transition-colors flex items-center gap-2"
                              onClick={(e) => {
                                if (group.id !== 'no-epic') {
                                  e.stopPropagation();
                                  setSelectedEpicIdModal(group.id);
                                  setEpicModalOpen(true);
                                }
                              }}
                              title="Click to open Jira Epic details"
                            >
                              <span className="size-2 rounded-full bg-purple-500" />
                              Epic: {group.name}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                              {group.tasks.length} {group.tasks.length === 1 ? 'item' : 'items'}
                            </span>

                            {/* Quick-add button */}
                            <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 h-6 px-2 rounded-none text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer select-none border-0 bg-transparent"
                                    >
                                      <Plus className="size-3" />
                                      Add
                                    </button>
                                  }
                                />
                                <DropdownMenuContent align="end" className="w-36 bg-popover border-border">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditTask(null);
                                      setQuickAddEpicId(group.id === 'no-epic' ? null : group.id);
                                      setQuickAddType('TASK');
                                      setFormOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <CheckSquare className="size-4 text-blue-500" />
                                    Task
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditTask(null);
                                      setQuickAddEpicId(group.id === 'no-epic' ? null : group.id);
                                      setQuickAddType('STORY');
                                      setFormOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Bookmark className="size-4 text-emerald-500" />
                                    Story
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditTask(null);
                                      setQuickAddEpicId(group.id === 'no-epic' ? null : group.id);
                                      setQuickAddType('BUG');
                                      setFormOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Bug className="size-4 text-red-500" />
                                    Bug
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Top-Level Tasks under Epic */}
                      {isExpanded &&
                        group.tasks.map((t) => {
                          const statusObj = t.project_statuses;
                          const statusName = statusObj?.name || t.status?.replace('_', ' ') || 'To Do';
                          const assigneeName = formatMemberName(t.assignee_member);
                          const hasSubtasks = t.subtasks && t.subtasks.length > 0;
                          const isTaskExpanded = expandedTasks[t.id];

                          return (
                            <Fragment key={t.id}>
                              <TableRow
                                className="group hover:bg-muted/40 transition-colors cursor-pointer"
                                onClick={() => {
                                  setEditTask(t);
                                  setFormOpen(true);
                                }}
                              >
                                {/* 1. Type Icon */}
                                <TableCell className="py-2.5 px-4 text-center">
                                  <div className="flex justify-center" title={t.task_type || 'Task'}>
                                    {getIssueIcon(t.task_type)}
                                  </div>
                                </TableCell>

                                {/* 2. Task Title */}
                                <TableCell className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    {hasSubtasks && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleTask(t.id);
                                        }}
                                        className="p-0.5 rounded-none hover:bg-muted text-muted-foreground"
                                      >
                                        {isTaskExpanded ? (
                                          <ChevronDown className="size-3.5" />
                                        ) : (
                                          <ChevronRight className="size-3.5" />
                                        )}
                                      </button>
                                    )}
                                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                      {t.title}
                                    </span>
                                    {hasSubtasks && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-none font-mono">
                                        {t.subtasks.length} subtasks
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* 3. Status */}
                                <TableCell className="py-2.5 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground capitalize whitespace-nowrap">
                                    <span className="size-1.5 rounded-full bg-primary" />
                                    {statusName}
                                  </span>
                                </TableCell>

                                {/* 4. Priority */}
                                <TableCell className="py-2.5 px-4">
                                  {getPriorityBadge(t.priority)}
                                </TableCell>

                                {/* 5. Assignee */}
                                <TableCell className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="size-6">
                                      <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                                        {assigneeName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                      {assigneeName}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* 6. Due Date */}
                                <TableCell className="py-2.5 px-4 text-right">
                                  {t.due_date ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                      <Calendar className="size-3 text-muted-foreground" />
                                      {format(new Date(t.due_date), 'MMM d, yyyy')}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/50">-</span>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Sub-tasks */}
                              {isTaskExpanded &&
                                t.subtasks.map((st: any) => {
                                  const stStatusObj = st.project_statuses;
                                  const stStatusName = stStatusObj?.name || st.status?.replace('_', ' ') || 'To Do';
                                  const stAssigneeName = formatMemberName(st.assignee_member);

                                  return (
                                    <TableRow
                                      key={`sub-${st.id}`}
                                      className="bg-muted/15 hover:bg-muted/30 transition-colors cursor-pointer"
                                      onClick={() => {
                                        setEditTask(st);
                                        setFormOpen(true);
                                      }}
                                    >
                                      <TableCell className="py-2 px-4 text-center">
                                        <CornerDownRight className="size-3.5 text-muted-foreground ml-auto" />
                                      </TableCell>
                                      <TableCell className="py-2 px-4 pl-8">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground uppercase font-mono">Sub-task:</span>
                                          <span className="text-xs text-foreground font-medium truncate">
                                            {st.title}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 px-4">
                                        <span className="text-[11px] text-muted-foreground capitalize whitespace-nowrap">
                                          {stStatusName}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-2 px-4">
                                        {getPriorityBadge(st.priority)}
                                      </TableCell>
                                      <TableCell className="py-2 px-4 text-xs text-muted-foreground">
                                        {stAssigneeName}
                                      </TableCell>
                                      <TableCell className="py-2 px-4 text-right text-xs text-muted-foreground font-mono">
                                        {st.due_date ? format(new Date(st.due_date), 'MMM d') : '-'}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })
              )
            ) : (
              // Flat List View
              filteredTasks.map((t) => {
                const statusObj = t.project_statuses;
                const statusName = statusObj?.name || t.status?.replace('_', ' ') || 'To Do';
                const assigneeName = formatMemberName(t.assignee_member);

                return (
                  <TableRow
                    key={t.id}
                    className="group hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setEditTask(t);
                      setFormOpen(true);
                    }}
                  >
                    <TableCell className="py-2.5 px-4 text-center">
                      <div className="flex justify-center">{getIssueIcon(t.task_type)}</div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-sm font-medium text-foreground">
                      {t.title}
                    </TableCell>
                    <TableCell className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground capitalize whitespace-nowrap">
                        {statusName}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-4">{getPriorityBadge(t.priority)}</TableCell>
                    <TableCell className="py-2.5 px-4 text-xs text-muted-foreground">{assigneeName}</TableCell>
                    <TableCell className="py-2.5 px-4 text-right text-xs text-muted-foreground font-mono">
                      {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer Item Counter */}
        <div className="py-2.5 px-4 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Total Work Items: {filteredTasks.length}</span>
          <span>{tasks.filter((t) => t.status === 'completed' || t.project_statuses?.category === 'DONE').length} Completed</span>
        </div>
      </div>

      <TaskForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setQuickAddEpicId(null);
            setQuickAddType('TASK');
          }
        }}
        task={editTask}
        defaultProjectId={projectId}
        defaultEpicId={quickAddEpicId || undefined}
        defaultTaskType={editTask ? undefined : quickAddType}
        onSaved={fetchData}
      />

      <EpicDetailsModal
        open={epicModalOpen}
        onOpenChange={setEpicModalOpen}
        epicId={selectedEpicIdModal}
        projectId={projectId}
        onSaved={fetchData}
      />
    </div>
  );
}
