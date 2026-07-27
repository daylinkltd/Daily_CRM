'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Search, Loader2, CheckSquare, MoreHorizontal, Plus, Calendar, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskForm } from '@/components/tasks/task-form';

export default function GlobalTasksPage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);

    let query = supabase
      .from('tasks')
      .select(`
        *,
        project:projects!tasks_project_id_fkey ( name ),
        assignee:workspace_members!tasks_assigned_workspace_member_id_fkey (
          id, user_id
        )
      `)
      .eq('workspace_id', activeWorkspace.id)
      .eq('assigned_workspace_member_id', activeMember.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load tasks');
    } else {
      const taskList = data || [];
      const assigneeUserIds = taskList.map((t: any) => t.assignee?.user_id).filter(Boolean);
      if (assigneeUserIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', assigneeUserIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
        taskList.forEach((t: any) => { if (t.assignee?.user_id) t.assignee.profiles = profileMap[t.assignee.user_id] || null; });
      }
      setTasks(taskList);
    }
    setLoading(false);
  }, [supabase, activeWorkspace?.id, activeMember?.id, search]);

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
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-500/15 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-500/15 border-orange-200';
      case 'medium': return 'text-blue-600 bg-blue-500/15 border-blue-200';
      case 'low': return 'text-slate-600 bg-slate-500/15 border-slate-200';
      default: return 'text-slate-600 bg-slate-500/15 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      case 'in_progress': return 'bg-blue-500/15 text-blue-700 border-blue-200';
      case 'review': return 'bg-purple-500/15 text-purple-700 border-purple-200';
      default: return 'bg-slate-500/15 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Tasks" 
        description="Manage your assigned project deliverables and general to-dos."
        action={
          <Button onClick={() => { setEditTask(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="size-4 mr-2" />
            New Task
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Task</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Project Context</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">Priority</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Due Date</TableHead>
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <CheckSquare className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No tasks match your search.' : 'You have no assigned tasks.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => {
                const isOverdue = task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date();
                
                return (
                  <TableRow key={task.id} className="border-border hover:bg-muted/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className={`font-medium text-foreground ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize flex items-center gap-1 mt-0.5">
                          {task.task_type.toLowerCase()} Task
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {task.project ? task.project.name : '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={`uppercase text-[10px] ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </Badge>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem onClick={() => { setEditTask(task); setFormOpen(true); }} className="cursor-pointer">
                            Edit Task
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'todo')} className="cursor-pointer">Mark as To Do</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')} className="cursor-pointer">Mark as In Progress</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'review')} className="cursor-pointer">Mark for Review</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')} className="text-emerald-600 focus:text-emerald-700 cursor-pointer">
                            Mark as Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editTask}
        onSaved={fetchTasks}
      />
    </div>
  );
}
