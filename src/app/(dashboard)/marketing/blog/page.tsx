'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCalendarStore } from '@/lib/calendar/store';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/social/status-badge';
import { evaluateBlogSEO, SEOReadinessReport } from '@/lib/marketing/seo-evaluator';
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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Save,
  Send,
  Trash2,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BLOG_TABS: (PostStatus | 'all')[] = ['all', 'draft', 'pending_approval', 'approved', 'scheduled', 'published'];

export default function MarketingBlogPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<PostStatus | 'all'>('all');
  const [previewBlog, setPreviewBlog] = useState<BlogPost | null>(null);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);

  // Quick Generator Modal state
  const [isNewBlogOpen, setIsNewBlogOpen] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Live SEO Evaluation for editing blog
  const currentSeoReport: SEOReadinessReport | null = editingBlog
    ? evaluateBlogSEO({
        title: editingBlog.title,
        seoTitle: editingBlog.seoTitle,
        seoDescription: editingBlog.seoDescription || editingBlog.excerpt,
        slug: editingBlog.slug,
        content: editingBlog.content,
        primaryKeyword: editingBlog.keywords?.[0] || '',
        secondaryKeywords: editingBlog.keywords?.slice(1) || [],
        featuredImage: editingBlog.featuredImage,
        altText: editingBlog.seoTitle || editingBlog.title,
      })
    : null;

  const handleGenerateBlog = async () => {
    if (!topicInput.trim()) {
      toast.error('Please enter a blog topic or title.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicInput.trim(),
          contentType: 'blog',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.blog) {
        throw new Error(data.error || 'Failed to generate blog article');
      }

      const generated = data.blog;
      const newBlog: BlogPost = {
        id: `blog_${Date.now()}`,
        category: 'blog',
        title: generated.title,
        slug: generated.slug,
        excerpt: generated.excerpt,
        summary: generated.excerpt,
        content: generated.content,
        authorName: store.currentUser.name || 'Editorial Team',
        postCategory: generated.category || 'Thought Leadership',
        tags: generated.tags || ['Marketing', 'Strategy'],
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        keywords: [generated.primaryKeyword, ...(generated.secondaryKeywords || [])],
        featuredImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.createBlogPost(newBlog);
      setIsNewBlogOpen(false);
      setTopicInput('');
      setEditingBlog(newBlog);
      toast.success('AI-generated complete blog article ready for editing & review!');
    } catch (err: any) {
      toast.error(err.message || 'Error generating blog.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveBlog = (status?: PostStatus) => {
    if (!editingBlog) return;
    const updated = {
      ...editingBlog,
      status: status || editingBlog.status,
      updatedAt: new Date().toISOString(),
    };
    store.updateBlogPost(updated);
    setEditingBlog(null);
    toast.success(status === 'published' ? 'Blog article published live!' : 'Blog saved successfully!');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this blog post? This action cannot be undone.')) {
      store.deleteBlogPost(id);
      if (previewBlog?.id === id) setPreviewBlog(null);
      if (editingBlog?.id === id) setEditingBlog(null);
    }
  };

  const posts = store.blogPosts.filter((b) => (activeTab === 'all' ? true : b.status === activeTab));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="Blog Articles & Thought Leadership"
        description="Generate, write, optimize for search engines, schedule, and publish long-form company articles."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsNewBlogOpen(true)}
              className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:shadow-lg"
            >
              <Sparkles className="h-4 w-4" /> AI Generate Article
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        {BLOG_TABS.map((tab) => {
          const count = tab === 'all'
            ? store.blogPosts.length
            : store.blogPosts.filter((b) => b.status === tab).length;

          const label = tab === 'all'
            ? 'All Articles'
            : tab === 'pending_approval'
            ? 'In Review'
            : tab.charAt(0).toUpperCase() + tab.slice(1);

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
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
          <BookOpen className="h-10 w-10 opacity-40 text-purple-500" />
          <p className="text-base font-bold text-foreground">No blog articles in this tab</p>
          <p className="text-xs text-muted-foreground max-w-sm">Create your first AI-assisted SEO blog post to drive organic traffic.</p>
          <Button
            size="sm"
            onClick={() => setIsNewBlogOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl gap-1.5 mt-2"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate Blog Article
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => {
            const seo = evaluateBlogSEO({
              title: post.title,
              seoTitle: post.seoTitle,
              seoDescription: post.seoDescription || post.excerpt,
              slug: post.slug,
              content: post.content,
              primaryKeyword: post.keywords?.[0],
              featuredImage: post.featuredImage,
            });

            return (
              <div
                key={post.id}
                className="group relative flex flex-col rounded-3xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-purple-500/40"
              >
                {/* Featured Thumbnail */}
                <div className="relative w-full h-44 bg-muted overflow-hidden">
                  {post.featuredImage ? (
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-600">
                      <BookOpen className="h-10 w-10 opacity-40" />
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    <StatusBadge status={post.status} size="sm" />
                  </div>

                  {/* Real SEO Pill */}
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md shadow-xs flex items-center gap-1',
                      seo.grade === 'Good'
                        ? 'bg-emerald-500/80 text-white border-emerald-400'
                        : 'bg-amber-500/80 text-white border-amber-400'
                    )}>
                      SEO {seo.score}% ({seo.grade})
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                      {post.postCategory || 'Article'}
                    </span>
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {post.excerpt || post.summary || 'No excerpt available.'}
                    </p>
                  </div>

                  {/* Metadata Bar */}
                  <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span>{post.authorName}</span>
                    </div>
                    <span>{seo.wordCount} words (~{seo.readingTimeMinutes} min)</span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewBlog(post)}
                      className="h-7 text-xs px-2 rounded-lg gap-1"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingBlog(post)}
                      className="h-7 text-xs px-2 rounded-lg gap-1 border-purple-500/30 text-purple-600"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(post.id)}
                      className="h-7 text-xs px-2 rounded-lg text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Generate Blog Modal */}
      {isNewBlogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-foreground">AI Generate Full Blog Article</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a core topic or headline. The AI will generate a complete search-optimized article with structured subheadings (H2/H3), introduction, FAQ schema, and meta tags.
            </p>
            <Textarea
              rows={3}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. 5 Strategies to Automate WhatsApp Lead Nurturing for Mid-Market B2B Companies"
              className="text-xs rounded-xl"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewBlogOpen(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isGenerating || !topicInput.trim()}
                onClick={handleGenerateBlog}
                className="h-9 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              >
                {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate Article
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Blog Editor Modal */}
      {editingBlog && currentSeoReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-6xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <h3 className="text-sm font-bold text-foreground">Edit Blog Article & SEO Audit</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBlog(null)}
                  className="h-8 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveBlog('draft')}
                  className="h-8 text-xs rounded-xl gap-1"
                >
                  <Save className="h-3 w-3" /> Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveBlog('pending_approval')}
                  className="h-8 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1"
                >
                  <Send className="h-3 w-3" /> Submit for Approval
                </Button>
                {store.currentUser.role === 'admin' && (
                  <Button
                    size="sm"
                    onClick={() => handleSaveBlog('published')}
                    className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    Publish Now
                  </Button>
                )}
              </div>
            </div>

            {/* Modal Body: Left Editor, Right SEO Audit Checklist */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (8 cols): Editor Fields */}
              <div className="lg:col-span-8 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Article Title</label>
                  <Input
                    value={editingBlog.title}
                    onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                    className="text-sm font-bold rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">URL Slug</label>
                    <Input
                      value={editingBlog.slug}
                      onChange={(e) => setEditingBlog({ ...editingBlog, slug: e.target.value })}
                      className="text-xs font-mono rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Primary Keyword</label>
                    <Input
                      value={editingBlog.keywords?.[0] || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, keywords: [e.target.value, ...(editingBlog.keywords?.slice(1) || [])] })}
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Meta Description (SEO)</label>
                  <Textarea
                    rows={2}
                    value={editingBlog.seoDescription || editingBlog.excerpt || ''}
                    onChange={(e) => setEditingBlog({ ...editingBlog, seoDescription: e.target.value, excerpt: e.target.value })}
                    className="text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Body Content (Markdown)</label>
                  <Textarea
                    rows={16}
                    value={editingBlog.content || ''}
                    onChange={(e) => setEditingBlog({ ...editingBlog, content: e.target.value })}
                    className="text-xs font-mono leading-relaxed rounded-xl"
                  />
                </div>
              </div>

              {/* Right Column (4 cols): Real SEO Indicator & Checklist */}
              <div className="lg:col-span-4 space-y-4">
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SEO Readiness</span>
                    <Badge className={cn(
                      'text-xs font-bold',
                      currentSeoReport.grade === 'Good'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    )}>
                      {currentSeoReport.score}% — {currentSeoReport.grade}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>{currentSeoReport.wordCount} words</span>
                    <span>~{currentSeoReport.readingTimeMinutes} min reading time</span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    {currentSeoReport.checks.map((chk) => (
                      <div key={chk.id} className="p-2 rounded-xl bg-card border border-border/80 text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-[11px]">{chk.label}</span>
                          {chk.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{chk.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blog Preview Drawer */}
      {previewBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-card p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                {previewBlog.postCategory} • Preview
              </span>
              <Button size="sm" variant="outline" onClick={() => setPreviewBlog(null)} className="h-8 text-xs rounded-xl">
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-black text-foreground">{previewBlog.title}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>By {previewBlog.authorName}</span>
                <span>•</span>
                <span>Slug: /{previewBlog.slug}</span>
              </div>
            </div>

            {previewBlog.featuredImage && (
              <img
                src={previewBlog.featuredImage}
                alt={previewBlog.title}
                className="w-full h-64 object-cover rounded-2xl border border-border"
              />
            )}

            <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-line">
              {previewBlog.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
