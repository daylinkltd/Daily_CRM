"use client";

import React from 'react';
import type { BlogPost } from '@/types/calendar';
import { STATUS_CONFIG } from './social-event-card';
import { BookOpen, Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlogEventCardProps {
  post: BlogPost;
  compact?: boolean;
  onClick?: () => void;
}

export function BlogEventCard({ post, compact = false, onClick }: BlogEventCardProps) {
  const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        e.dataTransfer.setData('application/json', JSON.stringify({ id: post.id, type: 'blog' }));
      }}
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 p-2 text-left transition-all hover:shadow-md cursor-pointer select-none space-y-1.5',
        compact ? 'py-1.5 px-2 text-xs' : 'p-2.5'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-purple-500/20">
          <BookOpen className="h-3 w-3 shrink-0" />
          <span>Blog</span>
        </span>

        <span className={cn('text-[9px] font-bold px-1.5 py-0.2 rounded-md border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
          {statusCfg.label}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-bold text-xs text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
        {post.title}
      </h4>

      {/* Author & Time */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
        <span className="truncate">{post.authorName}</span>
        {post.time && <span>{post.time}</span>}
      </div>
    </div>
  );
}
