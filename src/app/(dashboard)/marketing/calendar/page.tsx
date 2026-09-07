'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { CalendarHeader } from '@/components/calendar/calendar-header';
import { MonthView } from '@/components/calendar/month-view';
import { WeekView } from '@/components/calendar/week-view';
import { ListView } from '@/components/calendar/list-view';
import { SocialComposerModal } from '@/components/calendar/social-composer-modal';
import { CRMActivityModal } from '@/components/calendar/crm-activity-modal';
import { ApprovalReviewDrawer } from '@/components/calendar/approval-review-drawer';
import { NoDateSidebar } from '@/components/calendar/no-date-sidebar';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import { TodayPostingSummary } from '@/components/calendar/today-posting-summary';
import { NextUpCard } from '@/components/calendar/next-up-card';
import { getTodaysPostingSummary } from '@/lib/marketing/calendar-notifications';
import type { CalendarEvent, SocialPost, CRMActivity, TodaysPostingSummary as TodaysSummaryType } from '@/types/calendar';

export default function MarketingCalendarPage() {
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();
  const [serverSummary, setServerSummary] = useState<TodaysSummaryType | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Compute authoritative summary from active store posts & timezone
  const effectiveTimezone = store.marketingSettings?.defaultTimezone || 'Asia/Kolkata';

  const clientSummary = useMemo(() => {
    return getTodaysPostingSummary(
      store.socialPosts || [],
      effectiveTimezone,
      new Date()
    );
  }, [store.socialPosts, effectiveTimezone]);

  // Optionally fetch from API for freshest backend state if workspace exists
  useEffect(() => {
    if (!activeWorkspace?.id) return;

    let isMounted = true;
    async function fetchToday() {
      try {
        setIsSummaryLoading(true);
        const res = await fetch(`/api/marketing/calendar/today?workspace_id=${activeWorkspace?.id}&timezone=${effectiveTimezone}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.summary && isMounted) {
            setServerSummary(json.summary);
          }
        }
      } catch {
        // Fallback to clientSummary
      } finally {
        if (isMounted) setIsSummaryLoading(false);
      }
    }

    fetchToday();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id, effectiveTimezone]);

  // Derive authoritative summary: clientSummary reactively tracks store.socialPosts (which updates on drag/drop/reschedule),
  // while serverSummary provides initial or background sync.
  const activeSummary = useMemo(() => {
    if (store.socialPosts && store.socialPosts.length > 0) {
      return clientSummary;
    }
    return serverSummary || clientSummary;
  }, [clientSummary, serverSummary, store.socialPosts]);

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleSelectEvent = (evt: CalendarEvent) => {
    if (evt.category === 'social') {
      const post = evt as SocialPost;
      if (post.status === 'pending_approval') {
        store.setReviewingPost(post);
      } else {
        store.setEditingPost(post);
        store.setIsComposerOpen(true);
      }
    } else if (evt.category === 'crm') {
      store.setEditingCRMActivity(evt as CRMActivity);
      store.setIsCRMModalOpen(true);
    }
  };

  const handleSelectPostById = (postId: string) => {
    const post = store.socialPosts.find((p) => p.id === postId);
    if (!post) return;
    if (post.status === 'pending_approval') {
      store.setReviewingPost(post);
    } else {
      store.setEditingPost(post);
      store.setIsComposerOpen(true);
    }
  };

  const handleFilterToday = () => {
    store.setViewMode('list');
    store.setFilters({
      ...store.filters,
      primary: 'social',
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Today's Posting & Next Up Operational Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TodayPostingSummary
            summary={activeSummary}
            isLoading={isSummaryLoading && !serverSummary}
            onSelectPost={handleSelectPostById}
            onFilterToday={handleFilterToday}
          />
        </div>
        <div className="lg:col-span-1">
          <NextUpCard
            nextPost={activeSummary.nextPost}
            isLoading={isSummaryLoading && !serverSummary}
            onViewPost={handleSelectPostById}
          />
        </div>
      </div>

      {/* 2. Header Toolbar & Filters */}
      <CalendarHeader
        currentDate={store.currentDate}
        viewMode={store.viewMode}
        onViewModeChange={store.setViewMode}
        onNavigate={store.navigateMonth}
        filters={store.filters}
        onFilterChange={store.setFilters}
        currentUserRole={store.currentUser.role}
        onRoleSwitch={store.switchRole}
        onNewSocialPost={() => {
          store.setEditingPost(null);
          store.setIsComposerOpen(true);
        }}
        onNewCRMActivity={() => {
          store.setEditingCRMActivity(null);
          store.setIsCRMModalOpen(true);
        }}
        onOpenNoDate={() => store.setIsNoDateOpen(true)}
        noDateCount={store.noDateEvents.length}
      />

      {/* 3. Main View Area (Month / Week / List) */}
      <div className="flex-1 pb-6">
        {store.viewMode === 'month' && (
          <MonthView
            currentDate={store.currentDate}
            events={store.filteredEvents}
            onSelectEvent={handleSelectEvent}
            onMoveEventDate={store.moveEventDate}
            onReviewPost={(post) => store.setReviewingPost(post)}
            onViewHistory={(post) => store.setHistoryPost(post)}
            onViewAnalytics={(post) => store.setAnalyticsPost(post)}
          />
        )}

        {store.viewMode === 'week' && (
          <WeekView
            currentDate={store.currentDate}
            events={store.filteredEvents}
            onSelectEvent={handleSelectEvent}
            onReviewPost={(post) => store.setReviewingPost(post)}
          />
        )}

        {store.viewMode === 'list' && (
          <ListView
            events={store.filteredEvents}
            onSelectEvent={handleSelectEvent}
            onReviewPost={(post) => store.setReviewingPost(post)}
            onViewHistory={(post) => store.setHistoryPost(post)}
            onViewAnalytics={(post) => store.setAnalyticsPost(post)}
          />
        )}
      </div>

      {/* 4. Modals & Drawers */}
      <SocialComposerModal
        isOpen={store.isComposerOpen}
        onClose={() => {
          store.setIsComposerOpen(false);
          store.setEditingPost(null);
        }}
        initialPost={store.editingPost}
        onSave={(data) => {
          if (store.editingPost) {
            store.updateSocialPost({ ...store.editingPost, ...data });
          } else {
            store.createSocialPost(data);
          }
        }}
      />

      <CRMActivityModal
        isOpen={store.isCRMModalOpen}
        onClose={() => {
          store.setIsCRMModalOpen(false);
          store.setEditingCRMActivity(null);
        }}
        initialActivity={store.editingCRMActivity}
        onSave={(data) => {
          if (store.editingCRMActivity) {
            store.updateCRMActivity({ ...store.editingCRMActivity, ...data });
          } else {
            store.createCRMActivity(data);
          }
        }}
      />

      <ApprovalReviewDrawer
        post={store.reviewingPost}
        currentUserRole={store.currentUser.role}
        currentUserId={store.currentUser.id}
        onClose={() => store.setReviewingPost(null)}
        onApprove={store.approvePost}
        onRequestChanges={store.requestChanges}
        onReject={store.rejectPost}
        onReassign={store.reassignApprover}
        onUpdatePost={store.updateSocialPost}
      />

      <NoDateSidebar
        isOpen={store.isNoDateOpen}
        onClose={() => store.setIsNoDateOpen(false)}
        noDateEvents={store.noDateEvents}
        onSelectEvent={handleSelectEvent}
      />

      <PostHistoryDrawer
        post={store.historyPost}
        onClose={() => store.setHistoryPost(null)}
      />
    </div>
  );
}
