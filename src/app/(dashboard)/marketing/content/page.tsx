'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { PostCard } from '@/components/social/post-card';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import { SocialComposerModal } from '@/components/calendar/social-composer-modal';
import { StatusBadge, STATUS_CONFIG } from '@/components/social/status-badge';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SocialPost, PostStatus, SocialPlatform } from '@/types/calendar';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  Layers,
  Calendar,
  User,
  Target,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";

const STATUS_TABS: (PostStatus | 'all')[] = [
  'all',
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'published',
  'failed',
  'changes_requested',
  'rejected',
];

const ALL_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
];

export default function MarketingContentPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<PostStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [gridView, setGridView] = useState(true);

  const [historyPost, setHistoryPost] = useState<SocialPost | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.socialPosts.filter((p) => {
      if (activeTab !== 'all' && p.status !== activeTab) return false;
      if (platformFilter !== 'all' && !p.channels.includes(platformFilter)) return false;
      if (campaignFilter !== 'all' && p.campaignId !== campaignFilter && p.tagsCampaign !== campaignFilter) return false;
      if (creatorFilter !== 'all' && p.creatorId !== creatorFilter) return false;
      if (contentTypeFilter !== 'all') {
        if (contentTypeFilter === 'video') {
          const isVideo = p.contentType === 'video' || p.contentType === 'reel' || p.contentType === 'short' || p.mediaUrl?.includes('.mp4') || Boolean(p.video_prompt);
          if (!isVideo) return false;
        } else if (contentTypeFilter === 'image') {
          const isImage = p.mediaUrl?.match(/\.(jpeg|jpg|png|webp|gif)/i) || Boolean(p.image_prompt);
          if (!isImage) return false;
        } else if (contentTypeFilter === 'carousel') {
          if (p.contentType !== 'carousel' && (!p.mediaUrls || p.mediaUrls.length <= 1)) return false;
        }
      }
      if (q) {
        const tMatch = p.title.toLowerCase().includes(q);
        const cMatch = p.defaultCaption.toLowerCase().includes(q);
        const crMatch = p.creatorName.toLowerCase().includes(q);
        if (!tMatch && !cMatch && !crMatch) return false;
      }
      return true;
    });
  }, [store.socialPosts, activeTab, platformFilter, contentTypeFilter, campaignFilter, creatorFilter, search]);

  const handleDelete = (postId: string) => {
    if (confirm('Delete this post? This action cannot be undone.')) {
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
        title="Content Library"
        description="Unified visual library for all marketing assets, drafts, approvals, and scheduled posts."
        actions={
          <Link href="/marketing/create">
            <Button size="sm" className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-md">
              <Plus className="h-4 w-4 stroke-[3]" /> Create Content
            </Button>
          </Link>
        }
      />

      {/* Tabs Header: All, Drafts, In Review, Approved, Scheduled, Published, Rejected */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = tab === 'all'
            ? store.socialPosts.length
            : store.socialPosts.filter((p) => p.status === tab).length;

          const label = tab === 'all'
            ? 'All Content'
            : tab === 'pending_approval'
            ? 'In Review'
            : tab === 'changes_requested'
            ? 'Changes Requested'
            : STATUS_CONFIG[tab]?.label || tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shrink-0',
                activeTab === tab
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{label}</span>
              <span className={cn(
                'px-1.5 py-0.2 rounded-md text-[10px] font-black',
                activeTab === tab ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Multi-Filters Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, caption, hashtags, or creator..."
            className="pl-9 h-10 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filter */}
          <NativeSelect
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | 'all')}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Channels</option>
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </NativeSelect>

          {/* Media/Content Type Filter */}
          <NativeSelect
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="video">🎬 Video & Reels</option>
            <option value="image">🖼️ Images</option>
            <option value="carousel">📚 Carousels</option>
          </NativeSelect>

          {/* Campaign Filter */}
          <NativeSelect
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="all">All Campaigns</option>
            {store.campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>

          {/* Layout Toggle */}
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
      </div>

      <div className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
        <span>Showing {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}</span>
      </div>

      {/* Grid or List View */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-2">
          <Layers className="h-10 w-10 opacity-40 text-primary" />
          <p className="text-base font-bold text-foreground">No content yet</p>
          <p className="text-xs text-muted-foreground max-w-sm">Create your first post or omnichannel campaign using the AI Assistant.</p>
          <Link href="/marketing/create" className="pt-2">
            <Button size="sm" className="bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm">
              Create Content
            </Button>
          </Link>
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
                <img src={post.mediaUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center text-base shrink-0">
                  📷
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{post.title}</h4>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{post.defaultCaption}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">By {post.creatorName}</span>
                  <span>·</span>
                  <span>{post.date ? `${post.date} @ ${post.time || '12:00'}` : 'Unscheduled'}</span>
                  {post.tagsCampaign && (
                    <>
                      <span>·</span>
                      <span className="text-primary font-bold">{post.tagsCampaign}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={post.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Composer Modal */}
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

      {/* Detail Drawer */}
      <PostHistoryDrawer post={historyPost} onClose={() => setHistoryPost(null)} />
    </div>
  );
}
