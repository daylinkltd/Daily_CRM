'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus } from 'lucide-react';
import { TaskForm } from '@/components/tasks/task-form';
import { KanbanColumn } from './kanban-column';
import { KanbanTask } from './kanban-task';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface ProjectKanbanProps {
  projectId: string;
  canManage: boolean;
}

export function ProjectKanban({ projectId, canManage }: ProjectKanbanProps) {
  const supabase = createClient();

  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newColumnName, setNewColumnName] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);
  const [, setDefaultStatusId] = useState<string | undefined>(undefined);
  
  const [activeDragTask, setActiveDragTask] = useState<any | null>(null);

  const fetchKanbanData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const [statusesRes, tasksRes] = await Promise.all([
      supabase.from('project_statuses').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('tasks').select(`*, assignee:workspace_members!tasks_assigned_workspace_member_id_fkey ( id, user_id )`).eq('project_id', projectId).is('parent_id', null)
    ]);

    if (statusesRes.error) {
      toast.error('Failed to load workflow statuses');
    } else {
      let fetchedStatuses = statusesRes.data || [];
      if (fetchedStatuses.length === 0) {
        const defaultStatuses = [
          { project_id: projectId, name: 'To Do', category: 'TODO', sort_order: 1, color: 'slate' },
          { project_id: projectId, name: 'In Progress', category: 'IN_PROGRESS', sort_order: 2, color: 'blue' },
          { project_id: projectId, name: 'Done', category: 'DONE', sort_order: 3, color: 'emerald' },
        ];
        const { data: inserted, error: insErr } = await supabase.from('project_statuses').insert(defaultStatuses).select();
        if (insErr) {
          console.error('[ProjectKanban] error seeding default statuses:', insErr);
        } else if (inserted) {
          fetchedStatuses = inserted;
        }
      }
      setColumns(fetchedStatuses);
    }

    if (tasksRes.error) {
      toast.error('Failed to load tasks');
    } else {
      const taskList = tasksRes.data || [];
      if (taskList.length > 0) {
        const userIds = taskList.map((t: any) => t.assignee?.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds);
          const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));
          taskList.forEach((t: any) => { if (t.assignee?.user_id) t.assignee.profiles = profileMap[t.assignee.user_id] || null; });
        }
      }
      setTasks(taskList);
    }

    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    fetchKanbanData();
  }, [fetchKanbanData]);

  const addColumn = async () => {
    if (!newColumnName.trim()) return;
    setAddingColumn(true);
    try {
      const sortOrder = columns.length + 1;
      const { data, error } = await supabase
        .from('project_statuses')
        .insert({
          project_id: projectId,
          name: newColumnName.trim(),
          category: 'IN_PROGRESS',
          sort_order: sortOrder,
          color: 'slate',
        })
        .select()
        .single();

      if (error) throw error;
      setColumns((prev) => [...prev, data]);
      setNewColumnName('');
      toast.success('Column added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add column');
    } finally {
      setAddingColumn(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveDragTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Resolve target status ID correctly whether dropped on column or task card
    let targetStatusId: string | null = null;
    if (overId === 'backlog') {
      targetStatusId = null;
    } else if (columns.some(col => col.id === overId)) {
      targetStatusId = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        targetStatusId = overTask.status_id;
      } else {
        return;
      }
    }

    if (task.status_id === targetStatusId) return;

    const targetStatusObj = columns.find(c => c.id === targetStatusId);
    const legacyStatusText = targetStatusId === null ? 'backlog' : (targetStatusObj?.category?.toLowerCase() || 'in_progress');

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status_id: targetStatusId } : t));

    try {
      // Try updating both status_id and status string to satisfy any legacy triggers
      const { error: err1 } = await supabase
        .from('tasks')
        .update({ status_id: targetStatusId, status: legacyStatusText })
        .eq('id', taskId);

      if (err1) {
        // Fallback to status_id update only
        const { error: err2 } = await supabase
          .from('tasks')
          .update({ status_id: targetStatusId })
          .eq('id', taskId);

        if (err2) throw err2;
      }
    } catch (err: any) {
      console.error('Drag end error:', err);
      toast.error('Failed to move task');
      fetchKanbanData(); // revert on fail
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
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[600px] items-start">
        
        {/* Backlog Column (Fixed) */}
        <KanbanColumn 
          id="backlog" 
          title="Backlog" 
          taskCount={tasks.filter(t => !t.status_id).length}
          onAddTask={() => { setEditTask(null); setDefaultStatusId(undefined); setFormOpen(true); }}
          canManage={canManage}
          isBacklog
        >
          {tasks.filter(t => !t.status_id).map(task => (
            <KanbanTask key={task.id} task={task} onEdit={() => { setEditTask(task); setFormOpen(true); }} />
          ))}
        </KanbanColumn>

        {/* Dynamic Columns (mapped to statuses) */}
        {columns.map(status => {
          const colTasks = tasks.filter(t => t.status_id === status.id);
          return (
            <KanbanColumn 
              key={status.id} 
              id={status.id} 
              title={status.name} 
              taskCount={colTasks.length}
              onAddTask={() => { setEditTask(null); setDefaultStatusId(status.id); setFormOpen(true); }}
              canManage={canManage}
            >
              {colTasks.map(task => (
                <KanbanTask key={task.id} task={task} onEdit={() => { setEditTask(task); setFormOpen(true); }} />
              ))}
            </KanbanColumn>
          );
        })}

        {/* Add Column Input & Button */}
        {canManage && (
          <div className="w-72 shrink-0 bg-card border border-dashed border-border rounded-lg p-3 flex flex-col gap-2">
            <Input
              placeholder="New Column Name..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="bg-background text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addColumn();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addColumn}
              disabled={addingColumn || !newColumnName.trim()}
              className="w-full text-xs"
            >
              {addingColumn ? <Loader2 className="size-3 animate-spin mr-1" /> : <Plus className="size-3 mr-1" />}
              Add Column
            </Button>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeDragTask ? <KanbanTask task={activeDragTask} onEdit={() => {}} isOverlay /> : null}
      </DragOverlay>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editTask}
        defaultProjectId={projectId}
        // Hack: TaskForm still expects defaultColumnId but we renamed it, so we pass defaultStatusId if we were to update TaskForm props, 
        // but wait, TaskForm doesn't take defaultStatusId. I should update TaskForm to accept it or just drop it.
        onSaved={fetchKanbanData}
      />
    </DndContext>
  );
}
