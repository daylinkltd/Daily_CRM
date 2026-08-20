'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/social/status-badge';
import type { BlogPost, PostStatus } from '@/types/calendar';
import {
  BookOpen,
  Plus,
  Calendar,
  User,
  Tag,
  Eye,
  ExternalLink,
  Edit3,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BLOG_TABS: (PostStatus | 'all')[] = ['all', 'draft', 'pending_approval', 'scheduled', 'published'];

export default function MarketingBlogPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<PostStatus | 'all'>('all');
  const [previewBlog, setPreviewBlog] = useState<BlogPost | null>(null);

  if (!store.isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const posts = store.blogPosts.filter((b) => (activeTab === 'all' ? true : b.status === activeTab));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Write, review, optimize SEO, schedule, and publish long-form company articles."
        actions={
          <Link href="/marketing/create">
            <Button size="sm" className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-md">
              <Plus className="h-4 w-4 stroke-[3]" /> New Article
            </Button>
          </Link>
        }
      />

      {/* Tabs: All Posts, Drafts, In Review, Scheduled, Published */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        {BLOG_TABS.map((tab) => {
          const count = tab === 'all'
            ? store.blogPosts.length
            : store.blogPosts.filter((b) => b.status === tab).length;

          const label = tab === 'all' ? 'All Posts' : tab === 'pending_approval' ? 'In Review' : tab.charAt(0).toUpperCase() + tab.slice(1);

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shrink-0',
                activeTab === tab
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{label}</span>
              <span className={cn('px-1.5 py-0.2 rounded-md text-[10px] font-black', activeTab === tab ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Blog Cards Grid */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-2">
          <BookOpen className="h-10 w-10 opacity-40 text-purple-500" />
          <p className="text-base font-bold text-foreground">No blog posts yet</p>
          <p className="text-xs text-muted-foreground max-w-sm">Create your first AI-assisted blog to drive SEO organic traffic and leads.</p>
          <Link href="/marketing/create" className="pt-2">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl">
              Create Blog
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm flex flex-col justify-between hover:border-purple-500/40 hover:shadow-md transition-all group"
            >
              <div>
                {/* Featured image */}
                <div className="relative aspect-video w-full bg-muted overflow-hidden">
                  {post.featuredImage ? (
                    <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-500">
                      <BookOpen className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-background/90 backdrop-blur-xs text-foreground border border-border">
                      {post.postCategory || 'Productivity'}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={post.status} size="sm" />
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-black text-foreground line-clamp-2 leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {post.excerpt || post.summary}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {(post.tags || []).map((t) => (
                      <span key={t} className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 pt-0 border-t border-border/40 mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
                  <User className="h-3 w-3 text-purple-500" />
                  <span>{post.authorName}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className="h-3 w-3" />
                  <span>{post.date || 'Draft'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
