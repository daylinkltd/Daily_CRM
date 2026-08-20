"use client";

import React from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { Share2, Calendar, Clock, CheckCircle2, FileEdit, Plus, History, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SocialMediaWidgetProps {
  onOpenComposer?: () => void;
}

export function SocialMediaWidget({ onOpenComposer }: SocialMediaWidgetProps) {
  const { isLoaded, scheduledPosts, pendingApprovalPosts, draftPosts, publishedPosts } = useCalendarStore();

  const scheduledCount = scheduledPosts ? scheduledPosts.length : 0;
  const pendingCount = pendingApprovalPosts ? pendingApprovalPosts.length : 0;
  const publishedCount = publishedPosts ? publishedPosts.length : 0;
  const draftsCount = draftPosts ? draftPosts.length : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500 border border-pink-500/20">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-foreground tracking-tight">Marketing & Social Media</h3>
            <p className="text-xs text-muted-foreground">
              Omnichannel campaigns, approval pipeline & content publishing.
            </p>
          </div>
        </div>

        {/* Buttons: Create, View Calendar, View History */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/marketing/create">
            <Button
              size="sm"
              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-sm gap-1"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" /> Create
            </Button>
          </Link>

          <Link href="/marketing/calendar">
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-xl gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Calendar
            </Button>
          </Link>

          <Link href="/marketing/history">
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-xl gap-1">
              <History className="h-3.5 w-3.5 text-primary" /> History
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Link href="/marketing/calendar" className="rounded-xl border border-border bg-background p-3 flex flex-col hover:border-blue-500/30 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Scheduled</span>
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-xl font-black text-foreground mt-1">{scheduledCount}</span>
        </Link>

        <Link href="/marketing/approvals" className="rounded-xl border border-border bg-background p-3 flex flex-col hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Approvals</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <span className="text-xl font-black text-foreground mt-1">{pendingCount}</span>
        </Link>

        <Link href="/marketing/published" className="rounded-xl border border-border bg-background p-3 flex flex-col hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Published</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-xl font-black text-foreground mt-1">{publishedCount}</span>
        </Link>

        <Link href="/marketing/content" className="rounded-xl border border-border bg-background p-3 flex flex-col hover:border-slate-500/30 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Drafts</span>
            <FileEdit className="h-4 w-4 text-slate-500" />
          </div>
          <span className="text-xl font-black text-foreground mt-1">{draftsCount}</span>
        </Link>
      </div>
    </div>
  );
}
