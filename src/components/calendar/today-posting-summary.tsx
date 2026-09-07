'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SocialPlatformIcon } from '@/components/calendar/social-icons';
import type {
  TodaysPostingSummary,
  TodayScheduledPostItem,
  AttentionItem,
} from '@/types/calendar';

interface TodayPostingSummaryProps {
  summary: TodaysPostingSummary;
  isLoading?: boolean;
  onSelectPost?: (postId: string) => void;
  onFilterToday?: () => void;
}

export function TodayPostingSummary({
  summary,
  isLoading,
  onSelectPost,
  onFilterToday,
}: TodayPostingSummaryProps) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 animate-pulse space-y-4 shadow-xs">
        <div className="h-5 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-72 bg-muted/60 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="h-20 bg-muted/40 rounded-2xl" />
          <div className="h-20 bg-muted/40 rounded-2xl" />
          <div className="h-20 bg-muted/40 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { totalScheduled, attentionCount, readyCount, publishedCount, posts, attentionItems } = summary;

  // Compute friendly status headline
  let headline = "Today's Posting";
  let subtext = '';
  let badgeTone: 'ok' | 'warn' | 'muted' = 'muted';

  if (totalScheduled === 0) {
    headline = "Today's Posting";
    subtext = "You're all caught up. No posts are scheduled for today.";
    badgeTone = 'ok';
  } else if (attentionCount > 0) {
    subtext = `You have ${totalScheduled} post${totalScheduled === 1 ? '' : 's'} scheduled today · ${attentionCount} need${attentionCount === 1 ? 's' : ''} your attention`;
    badgeTone = 'warn';
  } else if (publishedCount === totalScheduled) {
    subtext = `All ${totalScheduled} post${totalScheduled === 1 ? '' : 's'} scheduled for today have been published.`;
    badgeTone = 'ok';
  } else {
    subtext = `You have ${totalScheduled} post${totalScheduled === 1 ? '' : 's'} scheduled today. All ready for dispatch.`;
    badgeTone = 'ok';
  }

  return (
    <div className="rounded-3xl border border-border bg-card/95 backdrop-blur-md p-5 md:p-6 shadow-xs transition-all space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl border shadow-xs transition-colors shrink-0',
            attentionCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : totalScheduled > 0
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground'
          )}>
            <Bell className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black text-foreground tracking-tight">
                {headline}
              </h2>
              {totalScheduled > 0 && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black border font-mono',
                  attentionCount > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                )}>
                  {totalScheduled} scheduled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
          </div>
        </div>

        {totalScheduled > 0 && onFilterToday && (
          <button
            type="button"
            onClick={onFilterToday}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted text-foreground transition-all shadow-2xs shrink-0"
          >
            <span>View Today's Posts</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Posts List / Grid for Today */}
      {totalScheduled === 0 ? (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-dashed border-border bg-background/60 text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs font-medium">No posts queued for today. Use the composer to schedule new content.</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {posts.map((post) => {
            const isAttention = post.needsAttention;
            const cleanTitle = (post.title || 'Untitled Post')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&nbsp;/gi, ' ')
              .replace(/&amp;/gi, '&')
              .replace(/&quot;/gi, '"')
              .replace(/&#39;/gi, "'")
              .replace(/&lt;/gi, '<')
              .replace(/&gt;/gi, '>')
              .replace(/\s+/g, ' ')
              .trim();

            const cleanReason = (post.attentionReason || '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&nbsp;/gi, ' ')
              .replace(/&amp;/gi, '&')
              .replace(/&quot;/gi, '"')
              .replace(/&#39;/gi, "'")
              .replace(/&lt;/gi, '<')
              .replace(/&gt;/gi, '>')
              .replace(/\s+/g, ' ')
              .trim();

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost?.(post.id)}
                className={cn(
                  'group relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-xs overflow-hidden',
                  isAttention
                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                    : post.operationalStatus === 'PUBLISHED'
                    ? 'bg-muted/30 border-border hover:border-primary/40'
                    : 'bg-background border-border hover:border-primary/50'
                )}
              >
                {/* Top Row: Time & Channels & Status Badge */}
                <div className="flex items-center justify-between gap-2 min-w-0 pb-1">
                  <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-black font-mono text-foreground shrink-0 whitespace-nowrap bg-muted/60 px-1.5 py-0.5 rounded-md border border-border/40">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      {post.time || '12:00 PM'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {post.channels.map((ch) => (
                        <div key={ch} className="flex h-5 w-5 items-center justify-center rounded-md bg-muted/60 p-0.5 border border-border/30">
                          <SocialPlatformIcon platform={ch} className="h-3 w-3" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 whitespace-nowrap">
                    {post.operationalStatus === 'READY' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Ready
                      </span>
                    )}
                    {post.operationalStatus === 'PENDING_APPROVAL' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Approval pending
                      </span>
                    )}
                    {post.operationalStatus === 'MISSING_MEDIA' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                        <XCircle className="h-3 w-3 shrink-0" /> Creative missing
                      </span>
                    )}
                    {post.operationalStatus === 'FAILED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                        <XCircle className="h-3 w-3 shrink-0" /> Failed
                      </span>
                    )}
                    {post.operationalStatus === 'MISSED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                        <Clock className="h-3 w-3 shrink-0" /> Missed
                      </span>
                    )}
                    {post.operationalStatus === 'PUBLISHED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap shrink-0">
                        <Send className="h-3 w-3 shrink-0" /> Published
                      </span>
                    )}
                    {post.operationalStatus === 'CHANGES_REQUESTED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/30 whitespace-nowrap shrink-0">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Changes requested
                      </span>
                    )}
                    {post.operationalStatus === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
                        <XCircle className="h-3 w-3 shrink-0" /> Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Title & Content Type */}
                <div className="my-2 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground shrink-0 border border-border/40">
                      {post.contentType}
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors" title={cleanTitle}>
                      {cleanTitle}
                    </h4>
                  </div>
                  {cleanReason && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-tight truncate" title={cleanReason}>
                      {cleanReason}
                    </p>
                  )}
                </div>

                {/* Bottom Row: Creator & Details action */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[140px]">{post.creatorName ? `By ${post.creatorName}` : 'Marketing team'}</span>
                  <span className="flex items-center gap-0.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0">
                    Details <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
