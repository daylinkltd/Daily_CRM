"use client";

import React from 'react';
import type { CRMActivity } from '@/types/calendar';
import {
  Calendar as CalendarIcon,
  Phone,
  PhoneCall,
  CheckSquare,
  Briefcase,
  Clock,
  User,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CRMEventCardProps {
  activity: CRMActivity;
  compact?: boolean;
  onClick?: () => void;
}

const TYPE_CONFIG = {
  meeting: {
    label: 'Meeting',
    icon: CalendarIcon,
    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  call: {
    label: 'Call',
    icon: Phone,
    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  followup: {
    label: 'Follow-up',
    icon: PhoneCall,
    bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  task: {
    label: 'Task',
    icon: CheckSquare,
    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  appointment: {
    label: 'Appointment',
    icon: Clock,
    bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  deal: {
    label: 'Deal Activity',
    icon: Briefcase,
    bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  reminder: {
    label: 'Reminder',
    icon: Clock,
    bg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  },
};

export function CRMEventCard({ activity, compact = false, onClick }: CRMEventCardProps) {
  const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.meeting;
  const Icon = config.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', activity.id);
        e.dataTransfer.setData('application/json', JSON.stringify({ id: activity.id, type: 'crm' }));
      }}
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border p-2 text-left transition-all hover:shadow-md cursor-pointer select-none',
        'bg-card hover:border-primary/40',
        compact ? 'py-1.5 px-2 text-xs space-y-1' : 'p-3 space-y-2'
      )}
    >
      {/* Header Badge & Time */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-wider text-[9px] border',
            config.bg
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span>{config.label}</span>
        </span>
        {activity.time && (
          <span className="text-[10px] font-mono font-medium text-muted-foreground shrink-0">
            {activity.time}
          </span>
        )}
      </div>

      {/* Activity Title */}
      <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
        {activity.title}
      </h4>

      {/* Contact / Company details */}
      {(activity.contactName || activity.companyName) && !compact && (
        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground pt-0.5">
          {activity.contactName && (
            <div className="flex items-center gap-1.5 truncate">
              <User className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              <span className="truncate font-medium">{activity.contactName}</span>
            </div>
          )}
          {activity.companyName && (
            <div className="flex items-center gap-1.5 truncate">
              <Building className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{activity.companyName}</span>
            </div>
          )}
        </div>
      )}

      {/* Compact mode single line subtitle */}
      {compact && (activity.contactName || activity.companyName) && (
        <p className="text-[10px] text-muted-foreground truncate">
          {activity.contactName || activity.companyName}
        </p>
      )}
    </div>
  );
}
