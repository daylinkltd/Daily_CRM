"use client";

import React from 'react';
import type { SocialPost, SocialPlatform, PostStatus } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from './social-icons';
import { cn } from '@/lib/utils';
import {
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  XCircle,
  Eye,
  BarChart2,
} from 'lucide-react';

interface SocialEventCardProps {
  post: SocialPost;
  compact?: boolean;
  onClick?: () => void;
  onReview?: () => void;
  onViewHistory?: () => void;
  onViewAnalytics?: () => void;
}

export const PLATFORM_ICONS = SOCIAL_PLATFORM_ICONS;

export const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ElementType }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/20',
    icon: FileEdit,
  },
  pending_approval: {
    label: 'Pending Approval',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    icon: Clock,
  },
  changes_requested: {
    label: 'Changes Requested',
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
    icon: AlertCircle,
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    icon: Sparkles,
  },
  published: {
    label: 'Published',
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    icon: XCircle,
  },
};

export function SocialEventCard({
  post,
  compact = false,
  onClick,
  onReview,
  onViewHistory,
  onViewAnalytics,
}: SocialEventCardProps) {
  const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        e.dataTransfer.setData('application/json', JSON.stringify({ id: post.id, type: 'social' }));
      }}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col rounded-xl border transition-all hover:shadow-lg cursor-pointer select-none overflow-hidden',
        'bg-card border-border hover:border-primary/50',
        compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2.5'
      )}
    >
      {/* Thumbnail + Overlay Channels */}
      {post.mediaUrl && !compact && (
        <div className="relative h-28 w-full rounded-lg overflow-hidden bg-muted">
          <img
            src={post.mediaUrl}
            alt={post.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

          {/* Channels floating badge on thumbnail */}
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/10">
            {post.channels.map((ch) => {
              const info = SOCIAL_PLATFORM_ICONS[ch];
              if (!info) return null;
              const IconComponent = info.icon;
              return (
                <IconComponent
                  key={ch}
                  className="h-3 w-3 text-white"
                />
              );
            })}
          </div>

          {/* Time Badge */}
          {post.time && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white backdrop-blur-md text-[10px] font-mono font-medium rounded-md px-1.5 py-0.5">
              <Clock className="h-3 w-3" />
              <span>{post.time}</span>
            </div>
          )}
        </div>
      )}

      {/* Header for compact view or non-media post */}
      {(!post.mediaUrl || compact) && (
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {post.channels.map((ch) => {
              const info = SOCIAL_PLATFORM_ICONS[ch];
              if (!info) return null;
              const IconComponent = info.icon;
              return (
                <div
                  key={ch}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs',
                    info.color
                  )}
                  title={info.label}
                >
                  <IconComponent className="h-3 w-3" />
                </div>
              );
            })}
          </div>
          {post.time && (
            <span className="text-[10px] font-mono font-medium text-muted-foreground shrink-0">
              {post.time}
            </span>
          )}
        </div>
      )}

      {/* Post Title */}
      <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
        {post.title}
      </h4>

      {/* Status Badge + Action Triggers */}
      <div className="flex items-center justify-between gap-1.5 pt-1">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] border',
            statusCfg.bg,
            statusCfg.text,
            statusCfg.border
          )}
        >
          <StatusIcon className="h-2.5 w-2.5 shrink-0" />
          <span>{statusCfg.label}</span>
        </span>

        {/* Quick actions for review / history / analytics */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {post.status === 'pending_approval' && onReview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReview();
              }}
              className="p-1 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 transition-colors"
              title="Review Pending Post"
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
          {post.status === 'published' && post.analytics && onViewAnalytics && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewAnalytics();
              }}
              className="p-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              title="View Post Analytics"
            >
              <BarChart2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
