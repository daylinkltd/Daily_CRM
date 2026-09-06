'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { PlatformIconStack } from '@/components/social/platform-badge';
import { StatusBadge } from '@/components/social/status-badge';
import type { SocialPost, UserRole } from '@/types/calendar';
import { Calendar, User, Clock, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatDate(d?: string): string {
  if (!d) return 'No date set';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

interface ApprovalCardProps {
  post: SocialPost;
  currentUserId: string;
  currentUserRole: UserRole;
  onReview: (post: SocialPost) => void;
  className?: string;
}

export function ApprovalCard({
  post,
  currentUserId,
  currentUserRole,
  onReview,
  className,
}: ApprovalCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const isSelfApproval = post.creatorId === currentUserId;
  const lastSubmit = post.auditHistory.find((h) => h.action === 'submitted' || h.action === 'resubmitted');

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="sm:w-32 sm:h-32 w-full h-44 rounded-xl overflow-hidden bg-muted shrink-0 relative">
        {post.mediaUrl && !imageError ? (
          <img
            src={post.mediaUrl}
            alt={post.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 text-muted-foreground">
            <span className="text-2xl opacity-50">📷</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2">
          <PlatformIconStack platforms={post.channels} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground leading-snug truncate">{post.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={post.status} size="sm" />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {post.defaultCaption}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground mt-auto pt-1">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <User className="h-3 w-3 text-primary shrink-0" />
            {post.creatorName}
          </span>
          {lastSubmit && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              Submitted {formatRelative(lastSubmit.timestamp)}
            </span>
          )}
          {post.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              Scheduled {formatDate(post.date)} @ {post.time || '12:00'}
            </span>
          )}
        </div>

        {/* Action Button: Review */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-1">
          {isSelfApproval ? (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Waiting for another reviewer
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Reviewer: <strong className="text-foreground">{post.approverName || 'Vivian Torres'}</strong>
            </span>
          )}

          <Button
            size="sm"
            onClick={() => onReview(post)}
            className="h-8 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl shadow-sm"
          >
            <Eye className="h-3.5 w-3.5" /> Review
          </Button>
        </div>
      </div>
    </div>
  );
}
