'use client';

import React, { useState, useMemo } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { PostCard } from '@/components/social/post-card';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import { STATUS_CONFIG } from '@/components/social/status-badge';
import { SocialComposerModal } from '@/components/calendar/social-composer-modal';
import { Input } from '@/components/ui/input';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import type { SocialPost, PostStatus, SocialPlatform } from '@/types/calendar';
import { Search, History, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_STATUSES: PostStatus[] = ['draft', 'pending_approval', 'changes_requested', 'approved', 'scheduled', 'published', 'rejected'];
const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'threads', 'pinterest'];

export default function MarketingPostHistoryPage() {
  const store = useCalendarStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [gridView, setGridView] = useState(true);
  const [historyPost, setHistoryPost] = useState<SocialPost | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...store.socialPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (platformFilter !== 'all' && !p.channels.includes(platformFilter)) return false;
        if (campaignFilter !== 'all' && p.campaignId !== campaignFilter && p.tagsCampaign !== campaignFilter) return false;
        if (q && !p.title.toLowerCase().includes(q) && !p.defaultCaption.toLowerCase().includes(q) && !p.creatorName.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [store.socialPosts, search, statusFilter, platformFilter, campaignFilter]);

  const handleDelete = (postId: string) => {
    if (confirm('Delete this post? This cannot be undone.')) {
      store.deleteSocialPost(postId);
    }
  };

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Post History"
        description="Chronological audit record of every post created, reviewed, scheduled, and published."
      />

      {/* Search & Layout */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, caption, or creator..."
            className="pl-9 h-10 text-xs rounded-xl"
          />
        </div>

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground focus:outline-none"
        >
          <option value="all">All Campaigns</option>
          {store.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 border border-border bg-card rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setGridView(true)}
            className={cn('p-1.5 rounded-lg transition-colors', gridView ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setGridView(false)}
            className={cn('p-1.5 rounded-lg transition-colors', !gridView ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn('px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors', statusFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
        >
          All ({store.socialPosts.length})
        </button>
        {ALL_STATUSES.map((s) => {
          const count = store.socialPosts.filter((p) => p.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={cn('px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
            >
              {STATUS_CONFIG[s]?.label || s} ({count})
            </button>
          );
        })}
      </div>

      {/* Platform filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setPlatformFilter('all')}
          className={cn('px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors', platformFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
        >
          All Platforms
        </button>
        {ALL_PLATFORMS.map((p) => {
          const meta = SOCIAL_PLATFORM_ICONS[p];
          const Icon = meta?.icon;
          return (
            <button
              key={p}
              onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl border transition-colors', platformFilter === p ? `${meta?.color} border-transparent shadow-xs` : 'border-border bg-card text-muted-foreground hover:text-foreground')}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {meta?.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40">
          <History className="h-10 w-10 mb-2 opacity-40 text-primary" />
          <p className="text-sm font-bold text-foreground">No posts match your filters</p>
        </div>
      ) : gridView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onView={(p) => setHistoryPost(p)}
              onEdit={(p) => { setEditingPost(p); setComposerOpen(true); }}
              onDuplicate={store.duplicatePost}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((post) => (
            <div
              key={post.id}
              onClick={() => setHistoryPost(post)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3.5 hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer"
            >
              {post.mediaUrl ? (
                <img src={post.mediaUrl} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-base shrink-0">
                  📷
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{post.title}</h4>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{post.defaultCaption}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>By {post.creatorName}</span>
                  <span>·</span>
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg border border-border bg-muted/40">
                  {post.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composer Modal for Editing */}
      <SocialComposerModal
        isOpen={composerOpen}
        onClose={() => { setComposerOpen(false); setEditingPost(null); }}
        initialPost={editingPost}
        onSave={(data) => {
          if (editingPost) store.updateSocialPost({ ...editingPost, ...data });
          setComposerOpen(false);
          setEditingPost(null);
        }}
      />

      {/* Individual Post History Activity Timeline */}
      <PostHistoryDrawer post={historyPost} onClose={() => setHistoryPost(null)} />
    </div>
  );
}
