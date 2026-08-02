'use client';

import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { IconAction } from "@/components/ui/icon-action";

interface KanbanColumnProps {
  id: string;
  title: string;
  taskCount: number;
  onAddTask: () => void;
  canManage: boolean;
  isBacklog?: boolean;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, taskCount, onAddTask, canManage, isBacklog, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 flex flex-col max-h-full border rounded-lg transition-colors ${
        isOver ? 'bg-primary/5 border-primary/50' : 'bg-muted/30 border-border'
      } ${isBacklog ? 'border-dashed' : ''}`}
    >
      <div className={`p-3 border-b flex items-center justify-between rounded-t-lg ${isBacklog ? 'bg-muted/50 border-border/50' : 'bg-card border-border'}`}>
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          {title}
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">
            {taskCount}
          </Badge>
        </h4>
        {canManage && (
          <IconAction
            label="Add"
            icon={<Plus className="size-3.5" />}
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:bg-muted"
            onClick={onAddTask}
          />
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
        {children}
      </div>
    </div>
  );
}
