'use client';

import React, { useState } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { PostHistoryDrawer } from '@/components/social/post-history-drawer';
import { PlatformIconStack } from '@/components/social/platform-badge';
import type { SocialPost } from '@/types/calendar';
import {
  Heart,
  MessageCircle,
  Share2,
  MousePointer,
  Eye,
  TrendingUp,
  BookOpen,
  Target,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatDate(d?: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MarketingPublishedPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<'social' | 'blog' | 'campaigns'>('social');
  const [historyPost, setHistoryPost] = useState<SocialPost | null>(null);

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const posts = store.publishedPosts;
  const blogPosts = store.blogPosts.filter((b) => b.status === 'published');
  const activeCampaigns = store.campaigns;

  const totalReach = posts.reduce((s, p) => s + (p.analytics?.reach ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.analytics?.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.analytics?.comments ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.analytics?.shares ?? 0), 0);
  const totalClicks = posts.reduce((s, p) => s + (p.analytics?.clicks ?? 0), 0);

  const summaryStats = [
    { label: 'Published Posts', value: posts.length, icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Total Reach', value: formatNum(totalReach), icon: Eye, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Total Likes', value: formatNum(totalLikes), icon: Heart, color: 'text-rose-500 bg-rose-500/10' },
    { label: 'Comments', value: formatNum(totalComments), icon: MessageCircle, color: 'text-violet-500 bg-violet-500/10' },
    { label: 'Shares', value: formatNum(totalShares), icon: Share2, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'Clicks', value: formatNum(totalClicks), icon: MousePointer, color: 'text-sky-500 bg-sky-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Published Content"
        description="Monitor live published marketing content, blog articles, and active campaign reach across channels."
      />

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryStats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-1.5 shadow-sm">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', s.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-black text-foreground">{s.value}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs: Social, Blog, Campaigns */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('social')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all',
            activeTab === 'social'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="h-4 w-4" /> Social Posts ({posts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blog')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all',
            activeTab === 'blog'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <BookOpen className="h-4 w-4" /> Blog Articles ({blogPosts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all',
            activeTab === 'campaigns'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Target className="h-4 w-4" /> Campaigns ({activeCampaigns.length})
        </button>
      </div>

      {/* 1. SOCIAL TAB */}
      {activeTab === 'social' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-1.5">
              <Globe className="h-10 w-10 opacity-40 text-primary" />
              <p className="text-base font-bold text-foreground">Nothing published yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">Published marketing content will appear here along with live reach, clicks, and engagement.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setHistoryPost(post)}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {post.mediaUrl ? (
                    <img src={post.mediaUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                      📷
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{post.title}</h4>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{post.defaultCaption}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <PlatformIconStack platforms={post.channels} size="sm" />
                      <span>Published {formatDate(post.date)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-foreground shrink-0">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatNum(post.analytics?.reach ?? 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    <span className="text-rose-500">{post.analytics?.likes ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-violet-500">{post.analytics?.comments ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MousePointer className="h-3.5 w-3.5 text-sky-500" />
                    <span className="text-sky-500">{post.analytics?.clicks ?? 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. BLOG TAB */}
      {activeTab === 'blog' && (
        <div className="space-y-3">
          {blogPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-1.5">
              <BookOpen className="h-10 w-10 opacity-40 text-purple-500" />
              <p className="text-base font-bold text-foreground">No published blog posts</p>
              <p className="text-xs text-muted-foreground max-w-sm">Approved and published articles will be listed here.</p>
            </div>
          ) : (
            blogPosts.map((blog) => (
              <div
                key={blog.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{blog.title}</h4>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{blog.excerpt || blog.summary}</p>
                    <span className="text-[10px] text-muted-foreground">Published {formatDate(blog.date)} by {blog.authorName}</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                  Live on Blog
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCampaigns.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-1.5">
              <Target className="h-10 w-10 opacity-40 text-blue-500" />
              <p className="text-base font-bold text-foreground">No active campaigns</p>
              <p className="text-xs text-muted-foreground max-w-sm">Live campaigns and their budgets will be shown here.</p>
            </div>
          ) : (
            activeCampaigns.map((camp) => (
              <div key={camp.id} className="rounded-3xl border border-border bg-card p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> {camp.name}
                  </span>
                  <span className={cn('text-[10px] font-black uppercase px-2 py-0.5 rounded-full border', camp.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border')}>
                    {camp.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{camp.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Budget:</span>
                    <strong className="text-foreground">${camp.budget.toLocaleString()} (${(camp.spent || 0).toLocaleString()} spent)</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Timeline:</span>
                    <strong className="text-foreground">{camp.startDate} to {camp.endDate}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <PostHistoryDrawer post={historyPost} onClose={() => setHistoryPost(null)} />
    </div>
  );
}
