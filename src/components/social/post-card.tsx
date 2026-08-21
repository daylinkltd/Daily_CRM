'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/social/status-badge';
import { PlatformIconStack } from '@/components/social/platform-badge';
import type { SocialPost } from '@/types/calendar';
import { MoreHorizontal, Eye, Edit3, Copy, Trash2, Calendar, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

function formatDate(d?: string): string {
  if (!d) return 'No date';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PostCardProps {
  post: SocialPost;
  onView?: (post: SocialPost) => void;
  onEdit?: (post: SocialPost) => void;
  onDuplicate?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onReview?: (post: SocialPost) => void;
  className?: string;
}

export function PostCard({ post, onView, onEdit, onDuplicate, onDelete, onReview, className }: PostCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/30',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-40 bg-muted overflow-hidden">
        {post.mediaUrl ? (
          <img
            src={post.mediaUrl}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15">
            <span className="text-3xl opacity-30">📷</span>
          </div>
        )}
        {/* Status overlay */}
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={post.status} size="sm" />
        </div>
        {/* Platform icons overlay */}
        <div className="absolute bottom-2.5 left-2.5">
          <PlatformIconStack platforms={post.channels} size="sm" />
        </div>
        {/* Action menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 border border-border text-muted-foreground hover:text-foreground shadow-sm"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            } />
            <DropdownMenuContent align="end" className="w-40">
              {onView && (
                <DropdownMenuItem onClick={() => onView(post)} className="gap-2 text-xs">
                  <Eye className="h-3.5 w-3.5" /> View
                </DropdownMenuItem>
              )}
              {onReview && post.status === 'pending_approval' && (
                <DropdownMenuItem onClick={() => onReview(post)} className="gap-2 text-xs text-amber-600 dark:text-amber-400 focus:text-amber-600">
                  <Eye className="h-3.5 w-3.5" /> Review
                </DropdownMenuItem>
              )}
              {onEdit && post.status !== 'published' && (
                <DropdownMenuItem onClick={() => onEdit(post)} className="gap-2 text-xs">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(post.id)} className="gap-2 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(post.id)} className="gap-2 text-xs text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-3.5 flex-1">
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">{post.title}</h3>

        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed flex-1">
          {post.defaultCaption}
        </p>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/60">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{post.creatorName}</span>
          <span className="mx-1 text-border">·</span>
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatDate(post.date)}</span>
        </div>
      </div>
    </div>
  );
}
