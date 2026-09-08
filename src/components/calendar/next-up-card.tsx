'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ArrowUpRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SocialPlatformIcon } from '@/components/calendar/social-icons';
import { formatCountdown, getMinutesUntil } from '@/lib/marketing/calendar-notifications';
import type { NextScheduledPostItem } from '@/types/calendar';

interface NextUpCardProps {
  nextPost: NextScheduledPostItem | null;
  isLoading?: boolean;
  onViewPost?: (postId: string) => void;
}

export function NextUpCard({
  nextPost,
  isLoading,
  onViewPost,
}: NextUpCardProps) {
  // Live dynamic countdown update
  const [countdownText, setCountdownText] = useState<string>(nextPost?.countdownLabel || '');

  useEffect(() => {
    if (!nextPost?.scheduledAt) return;

    const updateTimer = () => {
      const minutes = getMinutesUntil(nextPost.scheduledAt, new Date());
      setCountdownText(formatCountdown(minutes));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [nextPost?.scheduledAt]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 animate-pulse h-36 flex flex-col justify-between shadow-xs">
        <div className="h-4 w-24 bg-muted rounded-md" />
        <div className="h-6 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-32 bg-muted/60 rounded-md" />
      </div>
    );
  }

  if (!nextPost) {
    return (
      <div className="rounded-3xl border border-border bg-card/60 p-5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Next Up</span>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground">No upcoming posts scheduled in the queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-primary/5 via-card to-card p-5 md:p-6 shadow-xs space-y-4">
      {/* Top Row: Label & Countdown pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Next Up
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
            {nextPost.date}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-primary text-primary-foreground shadow-xs animate-pulse">
          <span>{countdownText || nextPost.countdownLabel}</span>
        </div>
      </div>

      {/* Main Content Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm md:text-base font-black font-mono text-foreground">
              {nextPost.time}
            </span>
            <div className="flex items-center gap-1">
              {nextPost.channels.map((ch) => (
                <div key={ch} className="flex h-5 w-5 items-center justify-center rounded-md bg-background border border-border p-0.5">
                  <SocialPlatformIcon platform={ch} className="h-3 w-3" />
                </div>
              ))}
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-muted text-muted-foreground">
              {nextPost.contentType}
            </span>
          </div>

          <h3 className="text-sm md:text-base font-extrabold text-foreground truncate max-w-lg" title={nextPost.title.replace(/<[^>]*>/g, ' ').trim()}>
            {nextPost.title.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()}
          </h3>

          {nextPost.attentionReason && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {nextPost.attentionReason.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewPost?.(nextPost.id)}
          className="self-start sm:self-center flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <span>View Post</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
