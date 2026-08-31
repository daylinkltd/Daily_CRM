'use client';

import { useDraggable } from '@dnd-kit/core';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

import { plainTextFromHtml } from '@/lib/markdown-utils';

interface KanbanTaskProps {
  task: any;
  onEdit: () => void;
  isOverlay?: boolean;
}

export function KanbanTask({ task, onEdit, isOverlay }: KanbanTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-500/15 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-500/15 border-orange-200';
      case 'medium': return 'text-blue-600 bg-blue-500/15 border-blue-200';
      case 'low': return 'text-muted-foreground bg-muted/15 border-border';
      default: return 'text-muted-foreground bg-muted/15 border-border';
    }
  };

  const assignee = Array.isArray(task.assignee?.profiles) 
    ? task.assignee.profiles[0] 
    : task.assignee?.profiles;

  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => {
        // Prevent edit click if we are dragging
        if (!isDragging) {
          onEdit();
        }
      }}
      className={`bg-card border border-border rounded-md p-3 shadow-sm transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : 'hover:shadow-md'
      } ${isOverlay ? 'shadow-xl scale-105 rotate-2 cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h5 className="font-medium text-sm text-foreground leading-tight">{task.title}</h5>
      </div>
      
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{plainTextFromHtml(task.description)}</p>
      )}
      
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <Badge variant="outline" className={`uppercase text-[9px] px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </Badge>
        
        {assignee && (
          <Avatar className="size-5 border border-border" title={assignee.full_name}>
            <AvatarImage src={assignee.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary text-[8px]">{assignee.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
