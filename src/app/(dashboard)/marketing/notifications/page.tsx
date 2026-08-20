'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingNotification } from '@/types/calendar';

export default function MarketingNotificationsPage() {
  const store = useCalendarStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'approvals' | 'publishing'>('all');

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const notifications = store.notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'approvals') return n.type.startsWith('approval') || n.type === 'changes_requested';
    if (filter === 'publishing') return n.type === 'post_published';
    return true;
  });

  const getNotifIcon = (type: MarketingNotification['type']) => {
    switch (type) {
      case 'approval_submitted':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'approval_approved':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'changes_requested':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'approval_rejected':
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'post_published':
        return <Send className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Notifications"
        description="Stay notified on approval requests, reviewer comments, scheduled publishing, and campaign milestones."
        actions={
          store.unreadNotificationsCount > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={store.markAllNotificationsRead}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
            >
              <CheckCheck className="h-4 w-4" /> Mark All as Read
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {(['all', 'unread', 'approvals', 'publishing'] as const).map((tab) => {
          const count = tab === 'unread'
            ? store.unreadNotificationsCount
            : tab === 'all'
            ? store.notifications.length
            : store.notifications.filter((n) => (tab === 'approvals' ? n.type.includes('approval') : n.type === 'post_published')).length;

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all capitalize shrink-0',
                filter === tab
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab}</span>
              <span className={cn('px-1.5 py-0.2 rounded-md text-[10px] font-black', filter === tab ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40">
          <CheckCheck className="h-10 w-10 text-emerald-500 mb-2 opacity-80" />
          <p className="text-sm font-bold text-foreground">No notifications found</p>
          <p className="text-xs mt-1">You're all caught up with your marketing workflow.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-w-3xl">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => store.markNotificationRead(notif.id)}
              className={cn(
                'flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs',
                notif.isRead ? 'bg-card border-border hover:border-primary/30' : 'bg-primary/5 border-primary/20 hover:border-primary/40'
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-background border border-border shrink-0 shadow-xs">
                {getNotifIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={cn('text-xs font-bold truncate', notif.isRead ? 'text-foreground' : 'text-primary font-black')}>
                    {notif.title}
                  </h4>
                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
              </div>

              {!notif.isRead && (
                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
