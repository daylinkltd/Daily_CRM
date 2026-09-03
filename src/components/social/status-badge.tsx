import React from 'react';
import { cn } from '@/lib/utils';
import type { PostStatus } from '@/types/calendar';

export const STATUS_CONFIG: Record<PostStatus, { label: string; className: string; dotClass: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-500/20',
    dotClass: 'bg-slate-500',
  },
  pending_approval: {
    label: 'Pending Approval',
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  changes_requested: {
    label: 'Changes Requested',
    className: 'bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/20',
    dotClass: 'bg-orange-500',
  },
  approved: {
    label: 'Approved',
    className: 'bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/20',
    dotClass: 'bg-sky-500',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-500/12 text-blue-700 dark:text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-500',
  },
  published: {
    label: 'Published',
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500',
  },
  failed: {
    label: 'Failed',
    className: 'bg-rose-600/15 text-rose-800 dark:text-rose-300 border-rose-600/30',
    dotClass: 'bg-rose-600',
  },
  publishing: {
    label: 'Publishing...',
    className: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    dotClass: 'bg-indigo-500',
  },
  ai_generated: {
    label: 'AI Generated',
    className: 'bg-purple-500/12 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dotClass: 'bg-purple-500',
  },
};

interface StatusBadgeProps {
  status: PostStatus;
  showDot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, showDot = true, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
        config.className,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dotClass)} />}
      {config.label}
    </span>
  );
}
