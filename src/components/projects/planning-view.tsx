'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  useDroppable
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanTask } from '@/components/tasks/kanban-task';
import { IconAction } from "@/components/ui/icon-action";

// --- Subcomponents for DND Zones ---

function DroppableSprint({ sprint, tasks, onStartSprint }: { sprint: any, tasks: any[], onStartSprint: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: sprint.id });
  
  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isOver ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="bg-muted/50 p-3 border-b flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          {sprint.name} 
          <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">{tasks.length}</span>
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase px-2 py-1 bg-muted rounded-none text-muted-foreground">{sprint.status}</span>
          {sprint.status === 'planning' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onStartSprint}>Start Sprint</Button>
          )}
        </div>
      </div>
      <div ref={setNodeRef} className="p-3 min-h-[100px] flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6 border-2 border-dashed border-transparent rounded-none">
            Drag tasks here
          </div>
        ) : (
          tasks.map(task => (
            <KanbanTask key={task.id} task={task} onEdit={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}

function DroppableBacklog({ tasks }: { tasks: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });
  
  return (
    <div className={`w-full md:w-1/3 border rounded-lg p-4 transition-colors flex flex-col ${isOver ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Backlog</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-none">{tasks.length} issues</span>
      </div>
      <div ref={setNodeRef} className="flex-1 space-y-2 min-h-[200px]">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Your backlog is empty.</p>
        ) : (
          tasks.map(task => (
             <KanbanTask key={task.id} task={task} onEdit={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}

// --- Main View ---

interface PlanningViewProps {
  projectId: string;
  canManage: boolean;
}

export function PlanningView({ projectId, canManage }: PlanningViewProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sprints, setSprints] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeDragTask, setActiveDragTask] = useState<any | null>(null);

  const fetchPlanningData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const [sprintsRes, tasksRes] = await Promise.all([
      supabase.from('sprints').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('tasks').select(`*, assignee:workspace_members!tasks_assigned_workspace_member_id_fkey ( id, user_id )`).eq('project_id', projectId).is('parent_id', null)
    ]);

    if (!sprintsRes.error) setSprints(sprintsRes.data || []);
    if (!tasksRes.error) {
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
  }, [projectId, supabase]);

  useEffect(() => {
    fetchPlanningData();
  }, [fetchPlanningData]);

  const createSprint = async () => {
    try {
      const { error } = await supabase.from('sprints').insert({
        project_id: projectId,
        name: `Sprint ${sprints.length + 1}`
      });
      if (error) throw error;
      toast.success('Sprint created');
      fetchPlanningData();
    } catch {
      toast.error('Failed to create sprint');
    }
  };

  const startSprint = async (sprintId: string) => {
    try {
      // Typically, you only allow one active sprint at a time.
      const hasActive = sprints.some(s => s.status === 'active');
      if (hasActive) {
        toast.error('You already have an active sprint.');
        return;
      }
      
      const { error } = await supabase.from('sprints').update({ status: 'active', start_date: new Date().toISOString() }).eq('id', sprintId);
      if (error) throw error;
      toast.success('Sprint started!');
      fetchPlanningData();
    } catch {
      toast.error('Failed to start sprint');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

    let targetSprintId: string | null = null;
    if (overId === 'backlog') {
      targetSprintId = null;
    } else {
      const isSprintContainer = sprints.some(s => s.id === overId);
      if (isSprintContainer) {
        targetSprintId = overId;
      } else {
        const overTask = tasks.find(t => t.id === overId);
        targetSprintId = overTask ? (overTask.sprint_id || null) : null;
      }
    }

    if (task.sprint_id === targetSprintId) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, sprint_id: targetSprintId } : t));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: targetSprintId })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Drag end error:', err);
      toast.error('Failed to move task');
      fetchPlanningData(); // revert
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const backlogTasks = tasks.filter(t => !t.sprint_id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Backlog Zone */}
        <DroppableBacklog tasks={backlogTasks} />

        {/* Sprints Zone */}
        <div className="w-full md:w-2/3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Sprints</h3>
            {canManage && (
              <IconAction label="Create Sprint" icon={<Plus className="size-4 " />} onClick={createSprint} />
            )}
          </div>

          {sprints.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground">
              No sprints have been created yet.
            </div>
          ) : (
            sprints.map(sprint => (
              <DroppableSprint 
                key={sprint.id} 
                sprint={sprint} 
                tasks={tasks.filter(t => t.sprint_id === sprint.id)} 
                onStartSprint={() => startSprint(sprint.id)}
              />
            ))
          )}
        </div>

      </div>

      <DragOverlay>
        {activeDragTask ? <KanbanTask task={activeDragTask} onEdit={() => {}} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
