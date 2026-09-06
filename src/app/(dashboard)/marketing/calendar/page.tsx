'use client';

import React from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { CalendarHeader } from '@/components/calendar/calendar-header';
import { MonthView } from '@/components/calendar/month-view';
import { WeekView } from '@/components/calendar/week-view';
import { ListView } from '@/components/calendar/list-view';
import { SocialComposerModal } from '@/components/calendar/social-composer-modal';
import { CRMActivityModal } from '@/components/calendar/crm-activity-modal';
import { ApprovalReviewDrawer } from '@/components/calendar/approval-review-drawer';
import { NoDateSidebar } from '@/components/calendar/no-date-sidebar';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import type { CalendarEvent, SocialPost, CRMActivity } from '@/types/calendar';

export default function MarketingCalendarPage() {
  const store = useCalendarStore();

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

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar & Filters */}
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

      {/* Main View Area (Month / Week / List) */}
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

      {/* Modals & Drawers */}
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
