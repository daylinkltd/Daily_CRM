'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MarketingNotification, MarketingNotificationType } from '@/types/calendar';

export default function MarketingNotificationsPage() {
  const router = useRouter();
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();
  const [filter, setFilter] = useState<'all' | 'unread' | 'approvals' | 'reminders' | 'publishing' | 'errors'>('all');
  const [serverNotifications, setServerNotifications] = useState<MarketingNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch real notifications from backend
  const fetchNotifications = async () => {
    if (!activeWorkspace?.id) return;
    try {
      setIsLoading(true);
      setHasError(false);
      const res = await fetch(`/api/marketing/notifications?workspace_id=${activeWorkspace.id}&limit=100`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.notifications)) {
          setServerNotifications(json.notifications);
          store.saveNotifications(json.notifications);
        }
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [activeWorkspace?.id]);

  const allNotifications = serverNotifications || store.notifications || [];

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  const filteredNotifications = allNotifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'approvals') {
      return (
        n.type === 'APPROVAL_REQUIRED' ||
        n.type === 'POST_READY' ||
        n.type === 'POST_REJECTED' ||
        n.type === 'CHANGES_REQUESTED' ||
        n.type.startsWith('approval')
      );
    }
    if (filter === 'reminders') {
      return n.type === 'POSTING_TODAY' || n.type === 'POST_UPCOMING' || n.type === 'POST_MISSED';
    }
    if (filter === 'publishing') {
      return n.type === 'PUBLISHING_SUCCESS' || n.type === 'post_published';
    }
    if (filter === 'errors') {
      return (
        n.severity === 'ERROR' ||
        n.type === 'PUBLISHING_FAILED' ||
        n.type === 'MEDIA_MISSING' ||
        n.type === 'POST_MISSED' ||
        n.type === 'SOCIAL_ACCOUNT_DISCONNECTED'
      );
    }
    return true;
  });

  const handleMarkRead = async (notif: MarketingNotification) => {
    if (notif.isRead) return;

    // Optimistic update
    if (serverNotifications) {
      setServerNotifications((prev) =>
        prev ? prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)) : []
      );
    }
    store.markNotificationRead(notif.id);

    try {
      await fetch(`/api/marketing/notifications/${notif.id}/read`, { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    if (serverNotifications) {
      setServerNotifications((prev) =>
        prev ? prev.map((n) => ({ ...n, isRead: true })) : []
      );
    }
    store.markAllNotificationsRead();

    if (activeWorkspace?.id) {
      try {
        await fetch('/api/marketing/notifications/read-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: activeWorkspace.id }),
        });
      } catch {
        // ignore
      }
    }
    toast.success('All notifications marked as read.');
  };

  const handleNotificationClick = (notif: MarketingNotification) => {
    handleMarkRead(notif);

    if (
      notif.type === 'APPROVAL_REQUIRED' ||
      notif.type === 'approval_submitted' ||
      notif.type === 'CHANGES_REQUESTED'
    ) {
      router.push('/marketing/approvals');
    } else if (notif.related_post_id || notif.targetId) {
      router.push(`/marketing/calendar?post=${notif.related_post_id || notif.targetId}`);
    } else if (notif.type === 'SOCIAL_ACCOUNT_DISCONNECTED') {
      router.push('/marketing/settings?tab=accounts');
    } else {
      router.push('/marketing/calendar');
    }
  };

  const getNotifIcon = (type: MarketingNotificationType, severity?: string) => {
    if (severity === 'ERROR' || type === 'PUBLISHING_FAILED' || type === 'MEDIA_MISSING' || type === 'POST_MISSED') {
      return <XCircle className="h-4 w-4 text-rose-500" />;
    }
    if (severity === 'WARNING' || type === 'APPROVAL_REQUIRED' || type === 'CHANGES_REQUESTED') {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    if (type === 'POST_READY' || type === 'PUBLISHING_SUCCESS' || type === 'post_published') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (type === 'POSTING_TODAY' || type === 'POST_UPCOMING') {
      return <Clock className="h-4 w-4 text-primary" />;
    }
    return <Bell className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Notifications"
        description="Real-time operational alerts for scheduled posts, approvals, publishing status, and creative readiness."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!activeWorkspace?.id) return;
                try {
                  const res = await fetch('/api/marketing/notifications/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      workspace_id: activeWorkspace.id,
                      type: 'POSTING_TODAY',
                      title: "Today's Posting",
                      message: "You have scheduled content for today.",
                    }),
                  });
                  if (res.ok) {
                    toast.success('Test notification sent successfully!');
                    fetchNotifications();
                  }
                } catch {
                  toast.error('Failed to trigger test notification');
                }
              }}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-2xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Test Alert
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!activeWorkspace?.id) return;
                try {
                  const res = await fetch('/api/marketing/notifications/job-run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspace_id: activeWorkspace.id }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    toast.success(`Job executed: ${data.notificationsCreated} created, ${data.notificationsSkipped} skipped.`);
                    fetchNotifications();
                  }
                } catch {
                  toast.error('Failed to run notification sweep job');
                }
              }}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-2xs text-muted-foreground hover:text-foreground"
            >
              <Clock className="h-3.5 w-3.5 text-primary" /> Run Job Now
            </Button>

            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllRead}
                className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-2xs"
              >
                <CheckCheck className="h-4 w-4" /> Mark All as Read
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'reminders', label: 'Posting Reminders' },
            { key: 'approvals', label: 'Approvals' },
            { key: 'publishing', label: 'Published' },
            { key: 'errors', label: 'Attention & Errors' },
          ] as const
        ).map((tab) => {
          let count = 0;
          if (tab.key === 'all') count = allNotifications.length;
          else if (tab.key === 'unread') count = unreadCount;
          else if (tab.key === 'reminders') count = allNotifications.filter((n) => n.type === 'POSTING_TODAY' || n.type === 'POST_UPCOMING' || n.type === 'POST_MISSED').length;
          else if (tab.key === 'approvals') count = allNotifications.filter((n) => n.type.includes('approval') || n.type.includes('APPROVAL') || n.type === 'CHANGES_REQUESTED' || n.type === 'POST_READY').length;
          else if (tab.key === 'publishing') count = allNotifications.filter((n) => n.type === 'PUBLISHING_SUCCESS' || n.type === 'post_published').length;
          else if (tab.key === 'errors') count = allNotifications.filter((n) => n.severity === 'ERROR' || n.type === 'PUBLISHING_FAILED' || n.type === 'MEDIA_MISSING' || n.type === 'POST_MISSED').length;

          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer',
                filter === tab.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-md text-[10px] font-black',
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {hasError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground rounded-3xl border border-dashed border-rose-500/30 bg-rose-500/5">
          <AlertCircle className="h-10 w-10 text-rose-500 mb-2 opacity-80" />
          <p className="text-sm font-bold text-foreground">Unable to load notifications</p>
          <p className="text-xs mt-1 text-muted-foreground">Please check your network connection or try again.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchNotifications}
            className="mt-4 rounded-xl text-xs font-bold cursor-pointer"
          >
            Retry
          </Button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40">
          <CheckCheck className="h-10 w-10 text-emerald-500 mb-2 opacity-80" />
          <p className="text-sm font-bold text-foreground">No notifications in this view</p>
          <p className="text-xs mt-1">You're all caught up with your marketing workflow.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-w-3xl">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                'group flex items-start justify-between gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-sm',
                notif.isRead
                  ? 'bg-card border-border hover:border-primary/40'
                  : notif.severity === 'ERROR'
                  ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60'
                  : notif.severity === 'WARNING'
                  ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                  : 'bg-primary/5 border-primary/20 hover:border-primary/40'
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={cn(
                  'mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-background border shrink-0 shadow-xs',
                  notif.severity === 'ERROR'
                    ? 'border-rose-500/30'
                    : notif.severity === 'WARNING'
                    ? 'border-amber-500/30'
                    : 'border-border'
                )}>
                  {getNotifIcon(notif.type, notif.severity)}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        'text-xs font-bold truncate',
                        notif.isRead ? 'text-foreground' : 'text-foreground font-black'
                      )}
                    >
                      {notif.title}
                    </h4>
                    {notif.severity && (
                      <span className={cn(
                        'px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider',
                        notif.severity === 'ERROR'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : notif.severity === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : notif.severity === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-primary/10 text-primary'
                      )}>
                        {notif.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(notif.createdAt || notif.created_at || Date.now()).toLocaleDateString()}
                </span>
                {!notif.isRead ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
