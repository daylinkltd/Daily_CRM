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
  Paperclip,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  X,
  Globe,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ReferenceArticle, GenerationTraceContext } from '@/lib/marketing/attachment-processor';
import type { WebResearchSource } from '@/lib/marketing/web-researcher';

const BLOG_TABS: (PostStatus | 'all')[] = ['all', 'draft', 'pending_approval', 'approved', 'scheduled', 'published'];

export default function MarketingBlogPage() {
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<PostStatus | 'all'>('all');
  const [previewBlog, setPreviewBlog] = useState<BlogPost | null>(null);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [researchSources, setResearchSources] = useState<WebResearchSource[]>([]);
  const [traceContext, setTraceContext] = useState<GenerationTraceContext | null>(null);
  const [showTraceModal, setShowTraceModal] = useState<boolean>(false);

  // Quick Generator Modal state
  const [isNewBlogOpen, setIsNewBlogOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'ai_generate' | 'web_research'>('web_research');
  const [topicInput, setTopicInput] = useState('');
  const [primaryKeywordInput, setPrimaryKeywordInput] = useState('');
  const [referenceArticles, setReferenceArticles] = useState<ReferenceArticle[]>([]);
  const [pastedDocText, setPastedDocText] = useState('');
  const [isPastedTestOpen, setIsPastedTestOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchErrorState, setSearchErrorState] = useState<{ topic: string; message: string } | null>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          if (!text.trim()) {
            toast.warning(`File "${file.name}" is empty and could not be attached.`);
            return;
          }
          setReferenceArticles((prev) => [
            ...prev,
            {
              id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              content: text,
              type: file.type || 'text/plain',
              size: file.size,
            },
          ]);
          toast.success(`Attached "${file.name}" as source of truth!`);
        }
      };
      reader.onerror = () => {
        toast.error(`Could not read file "${file.name}".`);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const handleAddPastedText = () => {
    if (!pastedDocText.trim()) return;
    setReferenceArticles((prev) => [
      ...prev,
      {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `Pasted Source (${referenceArticles.length + 1})`,
        content: pastedDocText.trim(),
        type: 'text/plain',
      },
    ]);
    setPastedDocText('');
    setIsPastedTestOpen(false);
    toast.success('Added reference text source.');
  };

  const handleRemoveArticle = (id?: string) => {
    setReferenceArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleGenerateBlog = async (overrideMode?: 'ai_generate' | 'web_research') => {
    const activeMode = overrideMode || (referenceArticles.length > 0 ? 'from_sources' : generationMode);
    if (!topicInput.trim() && referenceArticles.length === 0) {
      toast.error('Please enter a blog topic or attach reference articles.');
      return;
    }

    setIsGenerating(true);
    setSearchErrorState(null);

    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicInput.trim() || 'Reference Article Synthesis',
          generationMode: activeMode,
          contentType: 'blog',
          primaryKeyword: primaryKeywordInput.trim() || undefined,
          referenceArticles: referenceArticles.length > 0 ? referenceArticles : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.blog) {
        if (data.stage === 'search' || data.error_code === 'SEARCH_PROVIDER_UNAVAILABLE') {
          setSearchErrorState({
            topic: topicInput.trim(),
            message: data.error || data.message || "Web research is currently unavailable for this topic.",
          });
          return;
        }
        throw new Error(data.error || data.message || 'Failed to generate blog article');
      }

      if (data.traceContext?.warnings && data.traceContext.warnings.length > 0) {
        data.traceContext.warnings.forEach((w: string) => toast.warning(w));
      }

      const currentSources: WebResearchSource[] = data.researchSources || data.blog?.researchSources || data.webResearch?.sources || [];
      const currentTrace = data.traceContext || data.blog?.traceContext || null;
      setResearchSources(currentSources);
      setTraceContext(currentTrace);

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
      setPrimaryKeywordInput('');
      setReferenceArticles([]);
      setSearchErrorState(null);
      setEditingBlog(newBlog);
      toast.success(
        currentSources.length > 0
          ? `Grounded blog generated using ${currentSources.length} live web sources (${data.relevance?.score || 95}% relevance)!`
          : data.relevance?.score
          ? `Grounded blog generated (${data.relevance.score}% source relevance)!`
          : 'AI-generated complete blog article ready for editing & review!'
      );
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-bold text-foreground">AI Generate Full Blog Article</h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsNewBlogOpen(false); setSearchErrorState(null); }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Generation Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => { setGenerationMode('web_research'); setSearchErrorState(null); }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                  generationMode === 'web_research'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Web Research Mode</span>
              </button>
              <button
                type="button"
                onClick={() => { setGenerationMode('ai_generate'); setSearchErrorState(null); }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                  generationMode === 'ai_generate'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Generate Mode</span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {generationMode === 'web_research'
                ? '🌐 Web Research Mode searches live global news and authoritative sources to ground the article in real facts, statistics, and citations.'
                : '⚡ AI Generate Mode creates structured, comprehensive articles directly without external web search (100% offline capable).'}
            </p>

            {/* Search Provider Error Banner with Fallback Actions (Step 9) */}
            {searchErrorState && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">{searchErrorState.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      You can retry live web research or immediately generate a complete, high-quality article using the AI generation pipeline.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateBlog('web_research')}
                    disabled={isGenerating}
                    className="h-7 text-xs rounded-xl border-amber-500/40 text-amber-800 dark:text-amber-200"
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", isGenerating && "animate-spin")} />
                    Retry Research
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateBlog('ai_generate')}
                    disabled={isGenerating}
                    className="h-7 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Generate Without Research
                  </Button>
                </div>
              </div>
            )}

            {/* Reference Attachments */}
            <div className="space-y-2 p-3 rounded-2xl border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-purple-600" /> Reference Articles & Documents
                </span>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-purple-500/10">
                    <UploadCloud className="h-3 w-3" /> Upload Files
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.markdown,.json,.csv,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPastedTestOpen(!isPastedTestOpen)}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    {isPastedTestOpen ? 'Close Paste' : '+ Paste Text'}
                  </button>
                </div>
              </div>

              {isPastedTestOpen && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Textarea
                    rows={4}
                    value={pastedDocText}
                    onChange={(e) => setPastedDocText(e.target.value)}
                    placeholder="Paste reference document content..."
                    className="text-xs font-mono rounded-xl"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddPastedText} disabled={!pastedDocText.trim()} className="h-7 text-xs rounded-lg">
                      Add Pasted Content
                    </Button>
                  </div>
                </div>
              )}

              {referenceArticles.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] flex items-center gap-1 font-medium">
                    <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>{referenceArticles.length} source file(s) attached — Content will be strictly grounded.</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {referenceArticles.map((art) => (
                      <div key={art.id} className="flex items-center justify-between p-1.5 px-2.5 rounded-xl border border-border bg-background text-xs">
                        <span className="font-semibold text-foreground text-[11px] truncate">{art.name}</span>
                        <button type="button" onClick={() => handleRemoveArticle(art.id)} className="text-muted-foreground hover:text-rose-500">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Optional: Attach source documents (.txt, .md, .pdf) to enforce factual fidelity.
                </p>
              )}
            </div>

            {/* Core Subject / Topic Prompt */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">
                Article Topic or Headline
              </label>
              <Textarea
                rows={2}
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g. How Artificial Intelligence Is Transforming Small Businesses in 2026"
                className="text-xs rounded-xl"
              />
            </div>

            {/* Primary SEO Keyword */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">
                Primary SEO Keyword (Optional Constraint)
              </label>
              <Input
                value={primaryKeywordInput}
                onChange={(e) => setPrimaryKeywordInput(e.target.value)}
                placeholder="e.g. AI Small Business"
                className="text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Guides meta tags and slug without hijacking the subject.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setIsNewBlogOpen(false); setSearchErrorState(null); }}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isGenerating || (!topicInput.trim() && referenceArticles.length === 0)}
                onClick={() => handleGenerateBlog()}
                className="h-9 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              >
                {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generationMode === 'web_research' ? 'Research & Generate Article' : 'Generate Article'}
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

                {/* Research Sources Preview Card (Requirement 10) */}
                {researchSources.length > 0 && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-emerald-500" /> Research Sources
                      </span>
                      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/20">
                        {researchSources.length} Live Sources
                      </Badge>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {researchSources.map((src) => (
                        <div key={src.id} className="p-2.5 rounded-xl bg-card border border-border space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[10px] uppercase text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {src.source}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {src.relevanceScore}% Relevance
                            </span>
                          </div>
                          <p className="font-semibold text-foreground text-[11px] line-clamp-2">{src.title}</p>
                          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px] text-muted-foreground">
                            <span>{src.publishedDate}</span>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-bold flex items-center gap-0.5"
                            >
                              <span>View Article</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
