'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/social/status-badge';
import { PlatformIconStack } from '@/components/social/platform-badge';
import type { SocialPost, AuditHistoryItem } from '@/types/calendar';
import { CheckCircle2, Clock, Edit3, XCircle, AlertCircle, Send, CalendarClock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<AuditHistoryItem['action'], React.ReactNode> = {
  created:            <Edit3 className="h-3.5 w-3.5" />,
  edited:             <Edit3 className="h-3.5 w-3.5" />,
  submitted:          <Send className="h-3.5 w-3.5" />,
  resubmitted:        <Send className="h-3.5 w-3.5" />,
  changes_requested:  <AlertCircle className="h-3.5 w-3.5" />,
  approved:           <CheckCircle2 className="h-3.5 w-3.5" />,
  scheduled:          <CalendarClock className="h-3.5 w-3.5" />,
  published:          <Eye className="h-3.5 w-3.5" />,
  failed:             <XCircle className="h-3.5 w-3.5" />,
  rejected:           <XCircle className="h-3.5 w-3.5" />,
  rescheduled:        <CalendarClock className="h-3.5 w-3.5" />,
  reassigned:         <Clock className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<AuditHistoryItem['action'], string> = {
  created:            'bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-400/30',
  edited:             'bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-400/30',
  submitted:          'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-400/30',
  resubmitted:        'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-400/30',
  changes_requested:  'bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-400/30',
  approved:           'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-400/30',
  scheduled:          'bg-blue-500/12 text-blue-700 dark:text-blue-400 border-blue-400/30',
  published:          'bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  failed:             'bg-rose-600/15 text-rose-800 dark:text-rose-300 border-rose-600/30',
  rejected:           'bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-400/30',
  rescheduled:        'bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-400/30',
  reassigned:         'bg-purple-500/12 text-purple-700 dark:text-purple-400 border-purple-400/30',
};

const ACTION_LABELS: Record<AuditHistoryItem['action'], string> = {
  created:            'Created',
  edited:             'Edited',
  submitted:          'Submitted for Approval',
  resubmitted:        'Resubmitted for Approval',
  changes_requested:  'Changes Requested',
  approved:           'Approved',
  scheduled:          'Scheduled',
  published:          'Published',
  failed:             'Publishing Failed',
  rejected:           'Rejected',
  rescheduled:        'Rescheduled',
  reassigned:         'Reviewer Reassigned',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

interface PostHistoryDrawerProps {
  post: SocialPost | null;
  onClose: () => void;
}

export function PostHistoryDrawer({ post, onClose }: PostHistoryDrawerProps) {
  if (!post) return null;

  const history = [...post.auditHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <Sheet open={!!post} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0">
        <div className="p-5 border-b border-border shrink-0">
          <SheetTitle className="text-base font-bold text-foreground mb-1 truncate">{post.title}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PlatformIconStack platforms={post.channels} size="sm" />
            <StatusBadge status={post.status} size="sm" />
            <span className="text-[10px] text-muted-foreground">by {post.creatorName}</span>
          </div>
        </div>

        {/* Preview thumbnail */}
        {post.mediaUrl && (
          <div className="px-5 pt-4 shrink-0">
            <img
              src={post.mediaUrl}
              alt={post.title}
              className="w-full h-36 object-cover rounded-xl border border-border"
            />
          </div>
        )}

        {/* Caption preview */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{post.defaultCaption}</p>
        </div>

        <div className="px-5 py-2 shrink-0 border-t border-border/60">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Activity Timeline</p>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {history.map((item, idx) => (
                <div key={item.id} className="relative flex gap-3">
                  {/* Icon dot */}
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                    ACTION_COLORS[item.action]
                  )}>
                    {ACTION_ICONS[item.action]}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{ACTION_LABELS[item.action]}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground">{item.userName}</span>
                      {' · '}{item.userRole}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      {formatDateTime(item.timestamp)}
                    </p>
                    {item.comment && (
                      <div className="mt-1.5 rounded-lg bg-muted/60 border border-border/60 px-3 py-2">
                        <p className="text-xs text-foreground/80 leading-relaxed">&ldquo;{item.comment}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
