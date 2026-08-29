"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarStore } from '@/lib/calendar/store';
import { SocialComposerForm } from '@/components/social/social-composer-form';
import { AIContentAssistant } from '@/components/marketing/ai-content-assistant';
import type { SocialPost, BlogPost, Campaign, ContentIdea, PostStatus, SocialPlatform } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import {
  Share2,
  BookOpen,
  Target,
  Lightbulb,
  Sparkles,
  Calendar,
  Layers,
  Image as ImageIcon,
  Link2,
  Tag,
  Users,
  DollarSign,
  Plus,
  Send,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";

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

export function CreateWorkspaceTabs() {
  const router = useRouter();
  const store = useCalendarStore();
  const [activeTab, setActiveTab] = useState<'social' | 'blog' | 'campaign' | 'idea'>('social');

  // Blog Creation State
  const [blogTitle, setBlogTitle] = useState('');
  const [blogSlug, setBlogSlug] = useState('');
  const [blogExcerpt, setBlogExcerpt] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogCategory, setBlogCategory] = useState('Productivity');
  const [blogFeaturedImage, setBlogFeaturedImage] = useState(
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80'
  );
  const [blogTags, setBlogTags] = useState('SaaS, Growth, Automation');
  const [blogCampaignId, setBlogCampaignId] = useState('');
  const [blogDate, setBlogDate] = useState('2026-08-28');
  const [blogSeoTitle, setBlogSeoTitle] = useState('');
  const [blogSeoDescription, setBlogSeoDescription] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('crm, business os, whatsapp api');

  // Campaign Creation State
  const [campName, setCampName] = useState('');
  const [campDescription, setCampDescription] = useState('');
  const [campObjective, setCampObjective] = useState('');
  const [campStartDate, setCampStartDate] = useState('2026-09-01');
  const [campEndDate, setCampEndDate] = useState('2026-09-30');
  const [campPlatforms, setCampPlatforms] = useState<SocialPlatform[]>(['linkedin', 'x', 'instagram']);
  const [campBudget, setCampBudget] = useState(10000);

  // Content Idea Creation State
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaNotes, setIdeaNotes] = useState('');
  const [ideaPlatforms, setIdeaPlatforms] = useState<SocialPlatform[]>(['linkedin', 'instagram']);
  const [ideaTags, setIdeaTags] = useState('Growth, Tutorial');
  const [ideaCampaignId, setIdeaCampaignId] = useState('');

  // Handle Social Post Save
  const handleSocialSave = (postData: Partial<SocialPost>, action: PostStatus | 'publish_now') => {
    if (action === 'publish_now') {
      const payload = { ...postData, status: 'approved' as PostStatus };
      store.createSocialPost(payload);
      router.push('/marketing/published');
    } else {
      const targetStatus: PostStatus = action;
      store.createSocialPost({ ...postData, status: targetStatus });
      if (targetStatus === 'draft') router.push('/marketing/content');
      else if (targetStatus === 'pending_approval') router.push('/marketing/approvals');
      else if (targetStatus === 'scheduled') router.push('/marketing/calendar');
      else router.push('/marketing/content');
    }
  };

  // Handle Blog Post Save
  const handleBlogSave = (status: PostStatus) => {
    if (!blogTitle.trim()) {
      toast.error('Please enter a blog post title.');
      return;
    }

    const payload: Partial<BlogPost> = {
      title: blogTitle,
      slug: blogSlug || blogTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      excerpt: blogExcerpt,
      content: blogContent,
      summary: blogExcerpt || 'Blog post article summary.',
      featuredImage: blogFeaturedImage,
      postCategory: blogCategory,
      tags: blogTags.split(',').map((t) => t.trim()).filter(Boolean),
      seoTitle: blogSeoTitle || blogTitle,
      seoDescription: blogSeoDescription || blogExcerpt,
      keywords: blogKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      campaignId: blogCampaignId || undefined,
      campaignName: store.campaigns.find((c) => c.id === blogCampaignId)?.name,
      date: blogDate || undefined,
      time: '09:00',
      status,
    };

    store.createBlogPost(payload);
    router.push('/marketing/blog');
  };

  // Handle Campaign Save
  const handleCampaignSave = (status: 'draft' | 'active') => {
    if (!campName.trim()) {
      toast.error('Please enter a campaign name.');
      return;
    }

    const payload: Partial<Campaign> = {
      name: campName,
      description: campDescription,
      objective: campObjective,
      startDate: campStartDate,
      endDate: campEndDate,
      platforms: campPlatforms,
      budget: Number(campBudget) || 5000,
      status,
    };

    store.createCampaign(payload);
    router.push('/marketing/content');
  };

  // Handle Idea Save
  const handleIdeaSave = () => {
    if (!ideaTitle.trim()) {
      toast.error('Please enter a content idea title.');
      return;
    }

    const payload: Partial<ContentIdea> = {
      title: ideaTitle,
      notes: ideaNotes,
      platforms: ideaPlatforms,
      tags: ideaTags.split(',').map((t) => t.trim()).filter(Boolean),
      campaignId: ideaCampaignId || undefined,
      campaignName: store.campaigns.find((c) => c.id === ideaCampaignId)?.name,
    };

    store.createContentIdea(payload);
    router.push('/marketing/content');
  };

  const toggleCampPlatform = (p: SocialPlatform) => {
    if (campPlatforms.includes(p)) {
      if (campPlatforms.length > 1) setCampPlatforms(campPlatforms.filter((x) => x !== p));
    } else {
      setCampPlatforms([...campPlatforms, p]);
    }
  };

  const toggleIdeaPlatform = (p: SocialPlatform) => {
    if (ideaPlatforms.includes(p)) {
      if (ideaPlatforms.length > 1) setIdeaPlatforms(ideaPlatforms.filter((x) => x !== p));
    } else {
      setIdeaPlatforms([...ideaPlatforms, p]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('social')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'social'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Share2 className="h-4 w-4" /> Social Post
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blog')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'blog'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <BookOpen className="h-4 w-4" /> Blog Article
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaign')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'campaign'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Target className="h-4 w-4" /> Campaign
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('idea')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl border transition-all shrink-0',
            activeTab === 'idea'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Lightbulb className="h-4 w-4" /> Content Idea
        </button>
      </div>

      {/* 1. SOCIAL POST COMPOSER TAB */}
      {activeTab === 'social' && (
        <div className="space-y-4">
          <AIContentAssistant
            onApplyCaption={(cap) => {}}
            onApplyHashtags={(hash) => {}}
          />
          <SocialComposerForm
            initialPost={null}
            currentUserRole={store.currentUser.role}
            currentUserId={store.currentUser.id}
            onSave={handleSocialSave}
            onCancel={() => router.push('/marketing/content')}
            isFullPage={true}
          />
        </div>
      )}

      {/* 2. BLOG ARTICLE CREATOR TAB */}
      {activeTab === 'blog' && (
        <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-base font-black text-foreground">Create Blog Article</h2>
            <p className="text-xs text-muted-foreground">Draft SEO-optimized articles published on your company blog.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Article Title *</label>
                <Input
                  placeholder="e.g. 5 Signs Your Business Has Outgrown Spreadsheet Trackers"
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">URL Slug</label>
                <Input
                  placeholder="e.g. 5-signs-outgrown-spreadsheets"
                  value={blogSlug}
                  onChange={(e) => setBlogSlug(e.target.value)}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category</label>
                <NativeSelect
                  value={blogCategory}
                  onChange={(e) => setBlogCategory(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
                >
                  <option value="Productivity">Productivity</option>
                  <option value="CRM & Sales">CRM & Sales</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Case Studies">Case Studies</option>
                  <option value="Announcements">Announcements</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Link Campaign</label>
                <NativeSelect
                  value={blogCampaignId}
                  onChange={(e) => setBlogCampaignId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
                >
                  <option value="">None / Standalone Article</option>
                  {store.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Target Publish Date</label>
                <Input
                  type="date"
                  value={blogDate}
                  onChange={(e) => setBlogDate(e.target.value)}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Featured Image URL</label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={blogFeaturedImage}
                onChange={(e) => setBlogFeaturedImage(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Excerpt (Summary)</label>
              <Textarea
                rows={2}
                placeholder="Short 2-3 sentence overview for blog listings..."
                value={blogExcerpt}
                onChange={(e) => setBlogExcerpt(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Article Content (Markdown supported)</label>
              <Textarea
                rows={8}
                placeholder="Write your article body here..."
                value={blogContent}
                onChange={(e) => setBlogContent(e.target.value)}
                className="rounded-xl text-xs font-mono leading-relaxed"
              />
            </div>

            {/* SEO Section */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">SEO & Metadata</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Meta SEO Title"
                  value={blogSeoTitle}
                  onChange={(e) => setBlogSeoTitle(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
                <Input
                  placeholder="Keywords (comma separated)"
                  value={blogKeywords}
                  onChange={(e) => setBlogKeywords(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <Input
                placeholder="Meta SEO Description"
                value={blogSeoDescription}
                onChange={(e) => setBlogSeoDescription(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleBlogSave('draft')}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleBlogSave('pending_approval')}
              className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold"
            >
              Submit for Approval
            </Button>
            <Button
              type="button"
              onClick={() => handleBlogSave('scheduled')}
              className="h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
            >
              Schedule Publication
            </Button>
          </div>
        </div>
      )}

      {/* 3. CAMPAIGN CREATOR TAB */}
      {activeTab === 'campaign' && (
        <div className="max-w-3xl mx-auto rounded-3xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-base font-black text-foreground">Create Marketing Campaign</h2>
            <p className="text-xs text-muted-foreground">Unify social posts, blog articles, and budget tracking under a single campaign goal.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Campaign Name *</label>
              <Input
                placeholder="e.g. Q4 Global Brand & SaaS Pipeline Sprint"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                className="h-10 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Objective</label>
              <Input
                placeholder="e.g. Drive 250 enterprise conversions and increase social reach by 35%"
                value={campObjective}
                onChange={(e) => setCampObjective(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Description & Strategy</label>
              <Textarea
                rows={3}
                placeholder="Outline the core thesis, target audience, and key deliverables..."
                value={campDescription}
                onChange={(e) => setCampDescription(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Start Date</label>
                <Input
                  type="date"
                  value={campStartDate}
                  onChange={(e) => setCampStartDate(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">End Date</label>
                <Input
                  type="date"
                  value={campEndDate}
                  onChange={(e) => setCampEndDate(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Budget ($)</label>
                <Input
                  type="number"
                  value={campBudget}
                  onChange={(e) => setCampBudget(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* Target Channels */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-foreground block">Target Channels</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => {
                  const meta = SOCIAL_PLATFORM_ICONS[p];
                  const Icon = meta?.icon;
                  const isSelected = campPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleCampPlatform(p)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize',
                        isSelected ? `${meta?.color} border-primary shadow-xs` : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      <span>{meta?.label}</span>
                      {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCampaignSave('draft')}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Save Draft Campaign
            </Button>
            <Button
              type="button"
              onClick={() => handleCampaignSave('active')}
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
            >
              Launch Active Campaign
            </Button>
          </div>
        </div>
      )}

      {/* 4. CONTENT IDEA CREATOR TAB */}
      {activeTab === 'idea' && (
        <div className="max-w-2xl mx-auto rounded-3xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-base font-black text-foreground">Save Content Idea</h2>
            <p className="text-xs text-muted-foreground">Capture inspiration and rough drafts for future marketing content.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Idea Title *</label>
              <Input
                placeholder="e.g. 3 Quick Hacks to Cut CRM Response Times in Half"
                value={ideaTitle}
                onChange={(e) => setIdeaTitle(e.target.value)}
                className="h-10 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Notes & Key Bullet Points</label>
              <Textarea
                rows={4}
                placeholder="Jot down rough copy ideas, hooks, or reference URLs..."
                value={ideaNotes}
                onChange={(e) => setIdeaNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Tags (comma separated)</label>
                <Input
                  placeholder="Tutorial, SaaS, WhatsApp"
                  value={ideaTags}
                  onChange={(e) => setIdeaTags(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Assign Campaign</label>
                <NativeSelect
                  value={ideaCampaignId}
                  onChange={(e) => setIdeaCampaignId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
                >
                  <option value="">None / General</option>
                  {store.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {/* Target Channels */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-foreground block">Target Channels</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => {
                  const meta = SOCIAL_PLATFORM_ICONS[p];
                  const Icon = meta?.icon;
                  const isSelected = ideaPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleIdeaPlatform(p)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize',
                        isSelected ? `${meta?.color} border-primary shadow-xs` : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      <span>{meta?.label}</span>
                      {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              onClick={handleIdeaSave}
              className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              <Lightbulb className="h-4 w-4" /> Save Content Idea
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
