'use client';

import React, { useState } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { ApprovalCard } from '@/components/social/approval-card';
import { ApprovalReviewDrawer } from '@/components/calendar/approval-review-drawer';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import { CheckCheck, ClipboardCheck, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { SocialPost } from '@/types/calendar';

export default function MarketingApprovalsPage() {
  const store = useCalendarStore();
  const [reviewPost, setReviewPost] = useState<SocialPost | null>(null);
  const [historyPost, setHistoryPost] = useState<SocialPost | null>(null);

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const pending = store.pendingApprovalPosts;

  const handleApprove = (postId: string) => {
    store.approvePost(postId);
    toast.success('Post approved and ready to schedule!', { icon: '✅' });
  };

  const handleRequestChanges = (postId: string, comment: string) => {
    store.requestChanges(postId, comment);
    toast.warning('Change request sent to creator.', { icon: '🔄' });
  };

  const handleReject = (postId: string, comment?: string) => {
    store.rejectPost(postId, comment);
    toast.error('Post rejected.', { icon: '❌' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review submitted content, preview simulated platform appearances, and approve or request changes."
        badge={
          pending.length > 0 ? (
            <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-2.5 py-0.5 shadow-xs">
              <AlertCircle className="h-3 w-3" /> {pending.length} Pending
            </span>
          ) : undefined
        }
      />

      {/* Role info banner */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">
            Reviewing as <span className="text-primary">{store.currentUser.name}</span>
            <span className="ml-1.5 text-muted-foreground font-normal">({store.currentUser.roleTitle})</span>
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {store.currentUser.role === 'creator'
              ? 'Creators submit content for review. Approvers or Admins can approve or request changes.'
              : store.currentUser.role === 'approver'
              ? 'As an approver, you can review live platform previews, approve, request changes, or reject posts.'
              : 'As admin, you have full approval authority, workflow override, and approver reassignment.'}
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-1.5 border border-border rounded-xl px-2.5 py-1.5 bg-background shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground">Perspective:</span>
          {[
            { key: 'alex' as const, label: 'Creator' },
            { key: 'vivian' as const, label: 'Approver' },
            { key: 'admin' as const, label: 'Admin' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => store.switchRole(key)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                (key === 'alex' && store.currentUser.role === 'creator') ||
                (key === 'vivian' && store.currentUser.role === 'approver') ||
                (key === 'admin' && store.currentUser.role === 'admin')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-1.5">
          <CheckCheck className="h-10 w-10 text-emerald-500 mb-1 opacity-80" />
          <p className="text-base font-bold text-foreground">No pending approvals</p>
          <p className="text-xs text-muted-foreground max-w-sm">You&apos;re all caught up! No content is currently waiting for approval.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pending.map((post) => (
            <ApprovalCard
              key={post.id}
              post={post}
              currentUserId={store.currentUser.id}
              currentUserRole={store.currentUser.role}
              onReview={(p) => setReviewPost(p)}
            />
          ))}
        </div>
      )}

      {/* Review Drawer / Modal with Left Live Preview & Right Info */}
      <ApprovalReviewDrawer
        post={reviewPost}
        currentUserRole={store.currentUser.role}
        currentUserId={store.currentUser.id}
        onClose={() => setReviewPost(null)}
        onApprove={handleApprove}
        onRequestChanges={handleRequestChanges}
        onReject={handleReject}
        onReassign={store.reassignApprover}
      />

      <PostHistoryDrawer post={historyPost} onClose={() => setHistoryPost(null)} />
    </div>
  );
}
