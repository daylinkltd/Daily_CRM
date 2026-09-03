"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { SOCIAL_TEMPLATES, BLOG_TEMPLATES, ContentTemplate } from '@/lib/marketing/template-library';
import { evaluateBlogSEO } from '@/lib/marketing/seo-evaluator';
import { SocialPlatformPreview } from '@/components/social/platform-previews';
import type { SocialPost, BlogPost, PostStatus, SocialPlatform } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import {
  Sparkles,
  Share2,
  BookOpen,
  Send,
  Save,
  CheckCircle2,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Tag,
  Hash,
  Clock,
  Layers,
  Flame,
  Lightbulb,
  Edit3,
  Calendar as CalendarIcon,
  Globe,
  SlidersHorizontal,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from '@/components/ui/native-select';
import { MediaCreativeSection, type MediaCreativeData } from '@/components/marketing/media-creative-section';

const CONTENT_TYPES = [
  { id: 'social', label: 'Social Post', icon: Share2, desc: 'Optimized post for social feeds' },
  { id: 'blog', label: 'Blog Article', icon: BookOpen, desc: 'Long-form SEO thought leadership' },
  { id: 'promo', label: 'Promotional Post', icon: Flame, desc: 'Direct value proposition & conversions' },
  { id: 'product_service', label: 'Product / Feature', icon: Layers, desc: 'Feature highlight or product showcase' },
  { id: 'announcement', label: 'Announcement', icon: Zap, desc: 'Company milestone, event, or release' },
  { id: 'educational', label: 'Educational Post', icon: Lightbulb, desc: 'Tutorial, tips, or industry breakdown' },
];

const PLATFORMS: Array<{ id: SocialPlatform; label: string; icon: any }> = [
  { id: 'instagram', label: 'Instagram', icon: SOCIAL_PLATFORM_ICONS.instagram.icon },
  { id: 'linkedin', label: 'LinkedIn', icon: SOCIAL_PLATFORM_ICONS.linkedin.icon },
  { id: 'x', label: 'X (Twitter)', icon: SOCIAL_PLATFORM_ICONS.x.icon },
  { id: 'facebook', label: 'Facebook', icon: SOCIAL_PLATFORM_ICONS.facebook.icon },
  { id: 'tiktok', label: 'TikTok', icon: SOCIAL_PLATFORM_ICONS.tiktok.icon },
  { id: 'youtube', label: 'YouTube', icon: SOCIAL_PLATFORM_ICONS.youtube.icon },
  { id: 'threads', label: 'Threads', icon: SOCIAL_PLATFORM_ICONS.threads.icon },
];

const AUTOSAVE_KEY = 'dailybuz_marketing_draft_creation_v2';

export function CreateWorkspaceTabs() {
  const router = useRouter();
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();

  // Core Inputs
  const [contentType, setContentType] = useState<string>('social');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['linkedin', 'instagram', 'x']);
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Advanced Collapsible Options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [tone, setTone] = useState<'engaging' | 'professional' | 'concise' | 'creative' | 'educational'>('engaging');
  const [campaignName, setCampaignName] = useState<string>('');
  const [productOrService, setProductOrService] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaCreative, setMediaCreative] = useState<MediaCreativeData | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('10:30');

  // Generation & Review State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRegeneratingHashtags, setIsRegeneratingHashtags] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Generated Content Fields (Editable by user/admin)
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [generatedCta, setGeneratedCta] = useState<string>('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);
  const [trendingAngle, setTrendingAngle] = useState<{ headline: string; context: string } | null>(null);
  const [creativeSuggestion, setCreativeSuggestion] = useState<any | null>(null);
  const [suggestedTime, setSuggestedTime] = useState<any | null>(null);

  // Blog Specific Generated Fields
  const [blogSlug, setBlogSlug] = useState<string>('');
  const [blogSeoTitle, setBlogSeoTitle] = useState<string>('');
  const [blogSeoDescription, setBlogSeoDescription] = useState<string>('');
  const [blogPrimaryKw, setBlogPrimaryKw] = useState<string>('');
  const [blogHeadings, setBlogHeadings] = useState<Array<{ level: number; text: string }>>([]);
  const [blogFaq, setBlogFaq] = useState<Array<{ question: string; answer: string }>>([]);
  const [blogContent, setBlogContent] = useState<string>('');

  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatform>('linkedin');
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<boolean>(false);

  // Load Autosaved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.topicPrompt) setTopicPrompt(data.topicPrompt);
        if (data.contentType) setContentType(data.contentType);
        if (data.selectedPlatforms) setSelectedPlatforms(data.selectedPlatforms);
        if (data.generatedTitle) setGeneratedTitle(data.generatedTitle);
        if (data.generatedCaption) setGeneratedCaption(data.generatedCaption);
        if (data.generatedHashtags) setGeneratedHashtags(data.generatedHashtags);
        if (data.generatedKeywords) setGeneratedKeywords(data.generatedKeywords);
        if (data.mediaCreative) setMediaCreative(data.mediaCreative);
        if (data.isGenerated) setIsGenerated(true);
      }
    } catch {}
  }, []);

  // Autosave to localStorage on changes
  useEffect(() => {
    if (topicPrompt || generatedCaption || mediaCreative) {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            topicPrompt,
            contentType,
            selectedPlatforms,
            generatedTitle,
            generatedCaption,
            generatedHashtags,
            generatedKeywords,
            mediaCreative,
            isGenerated,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    }
  }, [topicPrompt, contentType, selectedPlatforms, generatedTitle, generatedCaption, generatedHashtags, generatedKeywords, mediaCreative, isGenerated]);

  const togglePlatform = (p: SocialPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((x) => x !== p));
      } else {
        toast.info('At least one target platform must remain selected.');
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  // Handle Template Selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = [...SOCIAL_TEMPLATES, ...BLOG_TEMPLATES].find((t) => t.id === templateId);
    if (tmpl) {
      setTone(tmpl.defaultTone as any);
      if (!topicPrompt) {
        setTopicPrompt(`Promote our ${tmpl.name.toLowerCase()} with clear problem-solution framing`);
      }
      toast.success(`Applied "${tmpl.name}" blueprint`);
    }
  };

  // Run Full AI Generation
  const handleGenerateContent = async () => {
    if (!topicPrompt.trim()) {
      toast.error('Please enter what you want to post about.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim(),
          contentType,
          platforms: selectedPlatforms,
          targetAudience,
          tone,
          campaignName,
          productOrService,
          websiteUrl,
          preferredLanguage,
          templateId: selectedTemplateId,
          uploadedMediaUrl: mediaCreative?.source === 'uploaded' ? mediaCreative.url : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Content generation failed');
      }

      if (data.mode === 'blog' && data.blog) {
        setGeneratedTitle(data.blog.title);
        setBlogSlug(data.blog.slug);
        setBlogSeoTitle(data.blog.seoTitle);
        setBlogSeoDescription(data.blog.seoDescription);
        setBlogPrimaryKw(data.blog.primaryKeyword);
        setBlogHeadings(data.blog.headings || []);
        setBlogFaq(data.blog.faqSchema || []);
        setBlogContent(data.blog.content);
        setGeneratedKeywords(data.blog.tags || []);
        setGeneratedHashtags(data.blog.tags.map((t: string) => `#${t.replace(/\s+/g, '')}`));

        if (mediaCreative?.source !== 'uploaded' && data.blog.image_url) {
          setMediaCreative({
            url: data.blog.image_url,
            type: 'image',
            source: 'ai_generated',
            prompt: data.blog.image_prompt,
            altText: data.blog.imageAltText,
          });
        }
      } else if (data.social) {
        setGeneratedTitle(data.social.title);
        setGeneratedCaption(data.social.caption);
        setGeneratedCta(data.social.cta);
        setGeneratedHashtags(data.social.hashtags);
        setGeneratedKeywords(data.social.keywords);
        setTrendingAngle(data.social.trendingAngle);
        setCreativeSuggestion(data.social.creativeSuggestion);
        setSuggestedTime(data.social.suggestedPostingTime);

        // If user has NOT uploaded manual media, attach the AI generated image creative:
        if (mediaCreative?.source !== 'uploaded' && data.social.image_url) {
          setMediaCreative({
            url: data.social.image_url,
            type: 'image',
            source: 'ai_generated',
            prompt: data.social.image_prompt,
            altText: data.social.image_alt_text,
            visualStyle: data.social.creativeSuggestion?.visualStyle,
            aspectRatio: data.social.creativeSuggestion?.aspectRatio,
          });
        }
      }

      setIsGenerated(true);
      setEditingMode(false);
      toast.success('Complete marketing post generated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Granular Regeneration: Regenerate ONLY Hashtags & Keywords without overwriting caption
  const handleRegenerateHashtagsOnly = async () => {
    setIsRegeneratingHashtags(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || generatedTitle,
          contentType,
          platforms: selectedPlatforms,
          regenTarget: 'hashtags_only',
          existingCaption: generatedCaption,
          existingTitle: generatedTitle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.social) {
        setGeneratedHashtags(data.social.hashtags);
        setGeneratedKeywords(data.social.keywords);
        if (data.social.trendingAngle) setTrendingAngle(data.social.trendingAngle);
        toast.success('Regenerated hashtags & keywords! Caption remained unchanged.');
      }
    } catch {
      toast.error('Could not refresh hashtags.');
    } finally {
      setIsRegeneratingHashtags(false);
    }
  };

  // Save as Draft or Submit for Approval
  const handleSavePost = async (targetStatus: PostStatus) => {
    if (!generatedTitle && !topicPrompt) {
      toast.error('Please enter a title or topic.');
      return;
    }

    setIsSaving(true);
    const finalTitle = generatedTitle.trim() || topicPrompt.trim();
    const finalCaption = generatedCaption.trim() || topicPrompt.trim();
    const finalMediaUrl = mediaCreative?.url || mediaUrl || undefined;

    try {
      if (contentType === 'blog') {
        const blogPayload: Partial<BlogPost> = {
          title: finalTitle,
          slug: blogSlug || finalTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          content: blogContent,
          excerpt: blogSeoDescription || finalCaption.slice(0, 150),
          summary: blogSeoDescription || finalCaption.slice(0, 150),
          seoTitle: blogSeoTitle || finalTitle,
          seoDescription: blogSeoDescription || finalCaption.slice(0, 150),
          keywords: generatedKeywords,
          tags: generatedKeywords,
          featuredImage: finalMediaUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
          status: targetStatus,
          date: scheduleDate || new Date().toISOString().split('T')[0],
          time: scheduleTime || '10:30',
        };

        store.createBlogPost(blogPayload);
        localStorage.removeItem(AUTOSAVE_KEY);
        toast.success(targetStatus === 'draft' ? 'Blog saved as Draft!' : 'Blog submitted for approval!');
        router.push(targetStatus === 'draft' ? '/marketing/blog' : '/marketing/approvals');
      } else {
        const postPayload: Partial<SocialPost> = {
          title: finalTitle,
          defaultCaption: finalCaption,
          channels: selectedPlatforms,
          hashtags: generatedHashtags,
          keywords: generatedKeywords,
          mediaUrl: finalMediaUrl,
          mediaType: mediaCreative?.type || 'image',
          status: targetStatus,
          date: scheduleDate || undefined,
          time: scheduleTime || undefined,
          altText: mediaCreative?.altText || creativeSuggestion?.description || undefined,
        };

        store.createSocialPost(postPayload);
        localStorage.removeItem(AUTOSAVE_KEY);

        if (targetStatus === 'draft') {
          toast.success('Post saved to Drafts!');
          router.push('/marketing/content');
        } else if (targetStatus === 'pending_approval') {
          toast.success('Post submitted for Admin Approval!');
          router.push('/marketing/approvals');
        } else {
          toast.success('Post saved!');
          router.push('/marketing/content');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving content');
    } finally {
      setIsSaving(false);
    }
  };

  // Construct mock post for live platform preview
  const previewPostObject: SocialPost = {
    id: 'preview_draft',
    category: 'social',
    title: generatedTitle || topicPrompt || 'Post Preview',
    channels: selectedPlatforms,
    defaultCaption: generatedCaption
      ? `${generatedCaption}\n\n${generatedHashtags.join(' ')}`
      : 'Your AI generated caption and hashtags will appear here...',
    mediaUrl: mediaCreative?.url || mediaUrl || undefined,
    mediaType: mediaCreative?.type || 'image',
    altText: mediaCreative?.altText || creativeSuggestion?.description,
    status: 'draft',
    creatorId: store.currentUser.id,
    creatorName: store.currentUser.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditHistory: [],
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Creation Header Card */}
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Step 1: Content Type Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
              <Layers className="h-3.5 w-3.5 text-primary" /> 1. Select Content Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {CONTENT_TYPES.map((type) => {
                const Icon = type.icon;
                const active = contentType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setContentType(type.id)}
                    className={cn(
                      'flex flex-col items-center text-center p-3.5 rounded-2xl border transition-all duration-200',
                      active
                        ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30 font-bold'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 mb-1.5', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Platform Selector (if social post) */}
          {contentType !== 'blog' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Share2 className="h-3.5 w-3.5 text-primary" /> 2. Target Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const Icon = p.icon;
                  const active = selectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all',
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{p.label}</span>
                      {active && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Primary Idea / Topic Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> 3. What do you want to post about?
              </label>
              {/* Template Blueprint Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Blueprint:</span>
                <NativeSelect
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="h-8 text-xs py-0 pl-2 pr-7 rounded-lg border-border"
                >
                  <option value="">Custom Concept</option>
                  <optgroup label="Social Templates">
                    {SOCIAL_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Blog Templates">
                    {BLOG_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                </NativeSelect>
              </div>
            </div>

            <div className="relative">
              <Textarea
                rows={3}
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder={
                  contentType === 'blog'
                    ? 'e.g. How to automate customer WhatsApp support and pipeline tracking in 2026'
                    : 'e.g. Create an engaging post announcing our new instant GST invoicing engine with zero setup time'
                }
                className="w-full rounded-2xl border-border bg-background/80 focus:bg-background text-sm p-4 resize-none transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* DEDICATED MEDIA / CREATIVE SECTION */}
          <MediaCreativeSection
            media={mediaCreative}
            postTopic={topicPrompt}
            targetPlatforms={selectedPlatforms}
            targetAudience={targetAudience}
            onChange={setMediaCreative}
          />

          {/* Advanced Options Accordion */}
          <div className="border border-border/80 rounded-2xl bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Advanced Options (Audience, Tone, Campaign, Media, Schedule)
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-card/50">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Target Audience</label>
                  <Input
                    placeholder="e.g. B2B Founders, Sales Leads, Retail Owners"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Tone of Voice</label>
                  <NativeSelect
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="h-9 text-xs rounded-xl"
                  >
                    <option value="engaging">Engaging & Conversational</option>
                    <option value="professional">Professional & Authoritative</option>
                    <option value="concise">Concise & Direct</option>
                    <option value="creative">Creative & Inspiring</option>
                    <option value="educational">Educational & Structured</option>
                  </NativeSelect>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Campaign Linkage</label>
                  <Input
                    placeholder="e.g. Q3 Growth Sprint"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Product / Service</label>
                  <Input
                    placeholder="e.g. DailyBiz WhatsApp CRM"
                    value={productOrService}
                    onChange={(e) => setProductOrService(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Target Website URL</label>
                  <Input
                    placeholder="https://dailybiz.in/crm"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Media Image URL</label>
                  <Input
                    placeholder="https://... (Image or video link)"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Scheduled Date (Optional)</label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Scheduled Time</label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Language</label>
                  <Input
                    placeholder="English"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button: GENERATE CONTENT */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              size="lg"
              disabled={isGenerating || !topicPrompt.trim()}
              onClick={handleGenerateContent}
              className="h-12 px-6 rounded-2xl bg-gradient-to-r from-primary via-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transition-all gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Post...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>GENERATE CONTENT</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Generated Content Preview & Editor Section */}
      {isGenerated && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-foreground">Generated Content & Preview</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingMode(!editingMode)}
                className="h-8 text-xs font-semibold rounded-xl gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {editingMode ? 'Done Editing' : 'Edit Fields'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRegeneratingHashtags}
                onClick={handleRegenerateHashtagsOnly}
                className="h-8 text-xs font-semibold rounded-xl gap-1.5 text-primary border-primary/30"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRegeneratingHashtags && 'animate-spin')} />
                Regenerate Hashtags
              </Button>
            </div>
          </div>

          {/* Main Grid: Left Editor/Details, Right Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Content Details & Granular Edits */}
            <div className="lg:col-span-7 space-y-5">
              {/* Post Title */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Post Title</label>
                {editingMode ? (
                  <Input
                    value={generatedTitle}
                    onChange={(e) => setGeneratedTitle(e.target.value)}
                    className="text-sm font-semibold rounded-xl"
                  />
                ) : (
                  <p className="text-base font-bold text-foreground">{generatedTitle}</p>
                )}
              </div>

              {/* Caption / Body */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {contentType === 'blog' ? 'Blog Article Content' : 'Main Caption / Description'}
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {generatedCaption.length} chars • {generatedCaption.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                {editingMode || contentType === 'blog' ? (
                  <Textarea
                    rows={contentType === 'blog' ? 14 : 7}
                    value={contentType === 'blog' ? blogContent : generatedCaption}
                    onChange={(e) => contentType === 'blog' ? setBlogContent(e.target.value) : setGeneratedCaption(e.target.value)}
                    className="text-xs leading-relaxed rounded-xl font-mono"
                  />
                ) : (
                  <p className="text-xs leading-relaxed whitespace-pre-line text-foreground/90 font-medium">
                    {generatedCaption}
                  </p>
                )}
              </div>

              {/* CTA & AI Suggestions */}
              {generatedCta && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Call to Action (CTA)</label>
                  {editingMode ? (
                    <Input
                      value={generatedCta}
                      onChange={(e) => setGeneratedCta(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                  ) : (
                    <p className="text-xs font-bold text-primary">{generatedCta}</p>
                  )}
                </div>
              )}

              {/* AI Suggestions Box (Trending Angle, Keywords, Hashtags) */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Suggestions & Contextual Enrichment
                  </span>
                </div>

                {trendingAngle && (
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-muted-foreground">Trending Angle:</span>
                    <p className="text-foreground font-semibold">{trendingAngle.headline}</p>
                    <p className="text-muted-foreground text-[11px]">{trendingAngle.context}</p>
                  </div>
                )}

                {/* Keywords */}
                {generatedKeywords.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground">Keywords:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-medium text-foreground">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {generatedHashtags.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground">Hashtags:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedHashtags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {creativeSuggestion && (
                  <div className="text-xs space-y-1 pt-1 border-t border-primary/10">
                    <span className="font-bold text-muted-foreground">Creative / Visual Suggestion:</span>
                    <p className="text-foreground/90 text-[11px]">{creativeSuggestion.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (5 cols): Live Platform Preview & Submission */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Platform Preview</span>
                  <div className="flex gap-1">
                    {selectedPlatforms.map((p) => {
                      const meta = SOCIAL_PLATFORM_ICONS[p];
                      const Icon = meta?.icon || Share2;
                      return (
                        <button
                          key={p}
                          onClick={() => setActivePreviewPlatform(p)}
                          className={cn(
                            'p-1.5 rounded-lg border transition-all',
                            activePreviewPlatform === p
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-border/80 rounded-2xl overflow-hidden bg-background">
                  <SocialPlatformPreview post={previewPostObject} selectedPlatform={activePreviewPlatform} onPlatformChange={setActivePreviewPlatform} />
                </div>

                {/* Posting Schedule Details */}
                {suggestedTime && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      Recommended Post Time: <strong className="text-foreground">{suggestedTime.dayOfWeek} at {suggestedTime.time}</strong>
                    </span>
                  </div>
                )}

                {/* Action CTA Buttons */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => handleSavePost('draft')}
                      className="h-10 text-xs font-bold rounded-xl gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Draft
                    </Button>
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSavePost('pending_approval')}
                      className="h-10 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 shadow-md hover:shadow-lg"
                    >
                      <Send className="h-3.5 w-3.5" /> Submit for Approval
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
