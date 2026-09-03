"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { SOCIAL_TEMPLATES, BLOG_TEMPLATES } from '@/lib/marketing/template-library';
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
  Video as VideoIcon,
  Tag,
  Hash,
  Clock,
  Layers,
  Flame,
  Lightbulb,
  Edit3,
  Calendar as CalendarIcon,
  SlidersHorizontal,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Check,
  Zap,
  Target,
  FileText,
  Paperclip,
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

const IMAGE_STYLES = [
  'Minimal SaaS',
  'Product Photography',
  'Cinematic',
  '3D',
  'Editorial',
  'Lifestyle',
  'Illustration',
  'Premium Commercial',
  'Abstract',
];

const VIDEO_STYLES = [
  'SaaS Commercial',
  'Cinematic',
  'Product Demo',
  'UGC-style',
  'Storytelling',
  'Explainer',
  'Fast-paced Social',
  'Minimal Premium',
];

const OBJECTIVES = [
  'Lead generation',
  'Brand awareness',
  'Product launch',
  'Customer education',
  'Event promotion',
  'Community engagement',
];

const AUTOSAVE_KEY = 'dailybuz_marketing_draft_creation_v3';

export function CreateWorkspaceTabs() {
  const router = useRouter();
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();

  // Core Inputs
  const [contentType, setContentType] = useState<string>('social');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram', 'linkedin', 'x']);
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [objective, setObjective] = useState<string>('Lead generation');

  // Advanced Collapsible Options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [tone, setTone] = useState<'engaging' | 'professional' | 'concise' | 'creative' | 'educational'>('engaging');
  const [campaignName, setCampaignName] = useState<string>('');
  const [productOrService, setProductOrService] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [imageStyle, setImageStyle] = useState<string>('Minimal SaaS');
  const [videoStyle, setVideoStyle] = useState<string>('SaaS Commercial');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [mediaCreative, setMediaCreative] = useState<MediaCreativeData | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('10:30');

  // Generation & Regeneration Loading States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRegeneratingImagePrompt, setIsRegeneratingImagePrompt] = useState<boolean>(false);
  const [isRegeneratingVideoPrompt, setIsRegeneratingVideoPrompt] = useState<boolean>(false);
  const [isRegeneratingHashtags, setIsRegeneratingHashtags] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Generated Content Fields (Independently editable)
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [generatedShortDesc, setGeneratedShortDesc] = useState<string>('');
  const [generatedCta, setGeneratedCta] = useState<string>('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [imagePromptVersion, setImagePromptVersion] = useState<number>(1);
  const [videoPromptVersion, setVideoPromptVersion] = useState<number>(1);
  const [newHashtagInput, setNewHashtagInput] = useState<string>('');
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');

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

  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatform>('instagram');
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
        if (data.objective) setObjective(data.objective);
        if (data.generatedTitle) setGeneratedTitle(data.generatedTitle);
        if (data.generatedCaption) setGeneratedCaption(data.generatedCaption);
        if (data.generatedShortDesc) setGeneratedShortDesc(data.generatedShortDesc);
        if (data.generatedCta) setGeneratedCta(data.generatedCta);
        if (data.generatedHashtags) setGeneratedHashtags(data.generatedHashtags);
        if (data.generatedKeywords) setGeneratedKeywords(data.generatedKeywords);
        if (data.imagePrompt) setImagePrompt(data.imagePrompt);
        if (data.videoPrompt) setVideoPrompt(data.videoPrompt);
        if (data.imagePromptVersion) setImagePromptVersion(data.imagePromptVersion);
        if (data.videoPromptVersion) setVideoPromptVersion(data.videoPromptVersion);
        if (data.mediaCreative) setMediaCreative(data.mediaCreative);
        if (data.isGenerated) setIsGenerated(true);
      }
    } catch {}
  }, []);

  // Autosave to localStorage on changes
  useEffect(() => {
    if (topicPrompt || generatedCaption || imagePrompt) {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            topicPrompt,
            contentType,
            selectedPlatforms,
            objective,
            generatedTitle,
            generatedCaption,
            generatedShortDesc,
            generatedCta,
            generatedHashtags,
            generatedKeywords,
            imagePrompt,
            videoPrompt,
            imagePromptVersion,
            videoPromptVersion,
            mediaCreative,
            isGenerated,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    }
  }, [
    topicPrompt,
    contentType,
    selectedPlatforms,
    objective,
    generatedTitle,
    generatedCaption,
    generatedShortDesc,
    generatedCta,
    generatedHashtags,
    generatedKeywords,
    imagePrompt,
    videoPrompt,
    imagePromptVersion,
    videoPromptVersion,
    mediaCreative,
    isGenerated,
  ]);

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
          objective,
          campaignName,
          productOrService,
          websiteUrl,
          preferredLanguage,
          imageStyle,
          videoStyle,
          additionalCreativeInstructions: additionalInstructions,
          templateId: selectedTemplateId,
          workspaceId: activeWorkspace?.id,
          uploadedMediaUrl: mediaCreative?.source === 'uploaded' ? mediaCreative.url : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Content generation failed. Please try again.');
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
        setImagePrompt(data.blog.image_prompt || '');
        setVideoPrompt(data.blog.video_prompt || '');
        setImagePromptVersion(data.blog.image_prompt_version || 1);
        setVideoPromptVersion(data.blog.video_prompt_version || 1);
      } else if (data.social) {
        setGeneratedTitle(data.social.title);
        setGeneratedCaption(data.social.caption);
        setGeneratedShortDesc(data.social.short_description || data.social.shortCaption || '');
        setGeneratedCta(data.social.cta);
        setGeneratedHashtags(data.social.hashtags);
        setGeneratedKeywords(data.social.keywords);
        setImagePrompt(data.social.image_prompt || '');
        setVideoPrompt(data.social.video_prompt || '');
        setImagePromptVersion(data.social.image_prompt_version || 1);
        setVideoPromptVersion(data.social.video_prompt_version || 1);
        setTrendingAngle(data.social.trendingAngle);
        setCreativeSuggestion(data.social.creativeSuggestion);
        setSuggestedTime(data.social.suggestedPostingTime);
      }

      setIsGenerated(true);
      setEditingMode(false);
      toast.success('✨ Marketing content and production-ready creative prompts generated!');
    } catch (err: any) {
      toast.error(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Independent Regeneration: Image Prompt ONLY
  const handleRegenerateImagePromptOnly = async () => {
    setIsRegeneratingImagePrompt(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || generatedTitle,
          contentType,
          platforms: selectedPlatforms,
          targetAudience,
          objective,
          imageStyle,
          additionalCreativeInstructions: additionalInstructions,
          regenTarget: 'image_prompt_only',
          existingCaption: generatedCaption,
          existingTitle: generatedTitle,
          existingVideoPrompt: videoPrompt,
          existingHashtags: generatedHashtags,
          existingKeywords: generatedKeywords,
          existingCta: generatedCta,
          imagePromptVersion,
          workspaceId: activeWorkspace?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image prompt regeneration failed');

      const newPrompt = data.mode === 'blog' ? data.blog?.image_prompt : data.social?.image_prompt;
      const newVersion = data.mode === 'blog' ? data.blog?.image_prompt_version : data.social?.image_prompt_version;

      if (newPrompt) {
        setImagePrompt(newPrompt);
        setImagePromptVersion(newVersion || imagePromptVersion + 1);
        toast.success(`Image prompt regenerated (${imageStyle} style)! Caption & other fields preserved.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Image prompt generation failed. Please try again.');
    } finally {
      setIsRegeneratingImagePrompt(false);
    }
  };

  // Independent Regeneration: Video Prompt ONLY
  const handleRegenerateVideoPromptOnly = async () => {
    setIsRegeneratingVideoPrompt(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || generatedTitle,
          contentType,
          platforms: selectedPlatforms,
          targetAudience,
          objective,
          videoStyle,
          additionalCreativeInstructions: additionalInstructions,
          regenTarget: 'video_prompt_only',
          existingCaption: generatedCaption,
          existingTitle: generatedTitle,
          existingImagePrompt: imagePrompt,
          existingHashtags: generatedHashtags,
          existingKeywords: generatedKeywords,
          existingCta: generatedCta,
          videoPromptVersion,
          workspaceId: activeWorkspace?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video prompt regeneration failed');

      const newPrompt = data.mode === 'blog' ? data.blog?.video_prompt : data.social?.video_prompt;
      const newVersion = data.mode === 'blog' ? data.blog?.video_prompt_version : data.social?.video_prompt_version;

      if (newPrompt) {
        setVideoPrompt(newPrompt);
        setVideoPromptVersion(newVersion || videoPromptVersion + 1);
        toast.success(`Video prompt regenerated (${videoStyle} style)! Caption & other fields preserved.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Video prompt generation failed. Please try again.');
    } finally {
      setIsRegeneratingVideoPrompt(false);
    }
  };

  // Independent Regeneration: Hashtags & Keywords ONLY
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
          existingImagePrompt: imagePrompt,
          existingVideoPrompt: videoPrompt,
          workspaceId: activeWorkspace?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.social) {
        setGeneratedHashtags(data.social.hashtags);
        setGeneratedKeywords(data.social.keywords);
        if (data.social.trendingAngle) setTrendingAngle(data.social.trendingAngle);
        toast.success('Regenerated hashtags & keywords! Caption and creative prompts remained intact.');
      }
    } catch {
      toast.error('Could not refresh hashtags.');
    } finally {
      setIsRegeneratingHashtags(false);
    }
  };

  // Clipboard Copy Handlers
  const handleCopyImagePrompt = async () => {
    if (!imagePrompt) {
      toast.error('No image prompt to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(imagePrompt);
      toast.success('Copied image prompt to clipboard! Paste it into OpenAI DALL-E 3 or your image generator.');
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const handleCopyVideoPrompt = async () => {
    if (!videoPrompt) {
      toast.error('No video prompt to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(videoPrompt);
      toast.success('Copied video prompt to clipboard! Paste it into OpenAI Sora or your video generator.');
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  // Tag Management
  const handleRemoveHashtag = (index: number) => {
    setGeneratedHashtags(generatedHashtags.filter((_, i) => i !== index));
  };

  const handleAddHashtag = () => {
    if (!newHashtagInput.trim()) return;
    const cleanTag = newHashtagInput.trim().startsWith('#') ? newHashtagInput.trim() : `#${newHashtagInput.trim()}`;
    if (!generatedHashtags.includes(cleanTag)) {
      setGeneratedHashtags([...generatedHashtags, cleanTag]);
    }
    setNewHashtagInput('');
  };

  const handleRemoveKeyword = (index: number) => {
    setGeneratedKeywords(generatedKeywords.filter((_, i) => i !== index));
  };

  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const cleanKw = newKeywordInput.trim();
    if (!generatedKeywords.includes(cleanKw)) {
      setGeneratedKeywords([...generatedKeywords, cleanKw]);
    }
    setNewKeywordInput('');
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
    const finalMediaUrl = mediaCreative?.url || undefined;

    try {
      if (contentType === 'blog') {
        const blogPayload: Partial<BlogPost> = {
          title: finalTitle,
          slug: blogSlug || finalTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          content: blogContent,
          excerpt: blogSeoDescription || generatedShortDesc || finalCaption.slice(0, 150),
          summary: blogSeoDescription || generatedShortDesc || finalCaption.slice(0, 150),
          seoTitle: blogSeoTitle || finalTitle,
          seoDescription: blogSeoDescription || finalCaption.slice(0, 150),
          keywords: generatedKeywords,
          tags: generatedKeywords,
          featuredImage: finalMediaUrl,
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
          shortCaption: generatedShortDesc,
          cta: generatedCta,
          channels: selectedPlatforms,
          hashtags: generatedHashtags,
          keywords: generatedKeywords,
          image_prompt: imagePrompt,
          video_prompt: videoPrompt,
          image_prompt_version: imagePromptVersion,
          video_prompt_version: videoPromptVersion,
          objective,
          mediaUrl: finalMediaUrl,
          mediaType: mediaCreative?.type || 'image',
          mediaSource: mediaCreative?.source === 'uploaded' ? 'UPLOADED' : undefined,
          status: targetStatus,
          date: scheduleDate || undefined,
          time: scheduleTime || undefined,
          altText: mediaCreative?.altText || undefined,
        };

        store.createSocialPost(postPayload);

        // Also persist to API if workspace is active
        if (activeWorkspace?.id) {
          try {
            await fetch('/api/marketing/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workspaceId: activeWorkspace.id,
                title: finalTitle,
                contentType: 'post',
                channels: selectedPlatforms,
                defaultCaption: finalCaption,
                shortCaption: generatedShortDesc,
                cta: generatedCta,
                hashtags: generatedHashtags,
                keywords: generatedKeywords,
                imagePrompt,
                videoPrompt,
                imagePromptVersion,
                videoPromptVersion,
                objective,
                mediaUrl: finalMediaUrl,
                mediaType: mediaCreative?.type || 'image',
                status: targetStatus,
                scheduledAt: scheduleDate ? `${scheduleDate}T${scheduleTime || '10:30'}:00Z` : undefined,
              }),
            });
          } catch (apiErr) {
            console.warn('[CreateTabs] Non-blocking post creation API error:', apiErr);
          }
        }

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

  // Preview Post Object
  const previewPostObject: SocialPost = {
    id: 'preview_draft',
    category: 'social',
    title: generatedTitle || topicPrompt || 'Post Preview',
    channels: selectedPlatforms,
    defaultCaption: generatedCaption
      ? `${generatedCaption}\n\n${generatedHashtags.join(' ')}`
      : 'Your AI generated caption and hashtags will appear here...',
    mediaUrl: mediaCreative?.url || undefined,
    mediaType: mediaCreative?.type || 'image',
    altText: mediaCreative?.altText || undefined,
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

          {/* Step 3: Primary Topic & Objective Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> 3. What do you want to create?
              </label>
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

            <Textarea
              rows={3}
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              placeholder={
                contentType === 'blog'
                  ? 'e.g. How to automate customer conversations, follow-ups, and sales pipelines for small businesses'
                  : 'e.g. DailyBuz CRM helps small businesses manage customer conversations from a single unified workspace'
              }
              className="w-full rounded-2xl border-border bg-background/80 focus:bg-background text-sm p-4 resize-none transition-all focus:ring-2 focus:ring-primary/20"
            />

            {/* Marketing Objective Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Target className="h-3.5 w-3.5 text-primary" /> Marketing Objective:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => setObjective(obj)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                      objective === obj
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div className="border border-border/80 rounded-2xl bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Advanced Options (Audience, Tone, Campaign, Creative Styles, Schedule)
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-card/50">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Target Audience</label>
                  <Input
                    placeholder="e.g. Small business owners, retailers, B2B growth teams"
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
                    placeholder="e.g. DailyBuz CRM"
                    value={productOrService}
                    onChange={(e) => setProductOrService(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Target Website URL</label>
                  <Input
                    placeholder="https://dailybuz.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Image Prompt Style</label>
                  <NativeSelect
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  >
                    {IMAGE_STYLES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Video Prompt Style</label>
                  <NativeSelect
                    value={videoStyle}
                    onChange={(e) => setVideoStyle(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  >
                    {VIDEO_STYLES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </NativeSelect>
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
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Additional Creative Instructions</label>
                  <Input
                    placeholder="e.g. Modern blue aesthetic, focus on multi-channel conversation tabs, no competitor logos"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
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
                  <span>Synthesizing Post & Prompts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>GENERATE CONTENT & PROMPTS</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Generated Content & Creative Prompts Section */}
      {isGenerated && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-foreground">Generated Marketing Package</h2>
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
                {editingMode ? 'Done Editing' : 'Edit All Fields'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Content Details & Creative Prompts */}
            <div className="lg:col-span-7 space-y-6">
              {/* ==================================================== */}
              {/* 1. GENERATED CONTENT SECTION */}
              {/* ==================================================== */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Generated Content
                  </span>
                </div>

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
                      {contentType === 'blog' ? 'Blog Article Content' : 'Caption / Description'}
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

                {/* CTA */}
                {generatedCta && (
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Call to Action (CTA)</label>
                    {editingMode ? (
                      <Input
                        value={generatedCta}
                        onChange={(e) => setGeneratedCta(e.target.value)}
                        className="text-xs rounded-xl font-medium"
                      />
                    ) : (
                      <p className="text-xs font-bold text-primary">{generatedCta}</p>
                    )}
                  </div>
                )}

                {/* Hashtags & Keywords Grid */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                  {/* Hashtags */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-primary" /> Hashtags
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isRegeneratingHashtags}
                        onClick={handleRegenerateHashtagsOnly}
                        className="h-7 px-2 text-[11px] font-bold text-primary gap-1"
                      >
                        <RefreshCw className={cn('h-3 w-3', isRegeneratingHashtags && 'animate-spin')} />
                        Regenerate Hashtags
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {generatedHashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20"
                        >
                          {tag}
                          {editingMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveHashtag(i)}
                              className="text-primary hover:text-rose-500 ml-1 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {editingMode && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder="Add custom hashtag..."
                          value={newHashtagInput}
                          onChange={(e) => setNewHashtagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHashtag())}
                          className="h-8 text-xs rounded-xl"
                        />
                        <Button type="button" size="sm" onClick={handleAddHashtag} className="h-8 text-xs rounded-xl">
                          Add
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Keywords
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[11px] font-medium text-foreground"
                        >
                          {kw}
                          {editingMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(i)}
                              className="text-muted-foreground hover:text-rose-500 ml-1 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {editingMode && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder="Add keyword..."
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                          className="h-8 text-xs rounded-xl"
                        />
                        <Button type="button" size="sm" onClick={handleAddKeyword} className="h-8 text-xs rounded-xl">
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* 2. CREATIVE PROMPTS SECTION (IMAGE & VIDEO) */}
              {/* ==================================================== */}
              <div className="space-y-5 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Creative Prompts for External AI Models
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Copy these detailed prompts and paste them into OpenAI DALL-E 3 or Sora to generate your assets.
                    </p>
                  </div>
                </div>

                {/* IMAGE GENERATION PROMPT */}
                <div className="rounded-3xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-3.5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Image Generation Prompt
                        </h4>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Version {imagePromptVersion} · {imageStyle} Style
                        </span>
                      </div>
                    </div>

                    {/* Image Style Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-medium">Style:</span>
                      <NativeSelect
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="h-8 text-xs py-0 pl-2 pr-7 rounded-lg border-border bg-background"
                      >
                        {IMAGE_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <Textarea
                    rows={6}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Detailed prompt for OpenAI DALL-E 3 / Midjourney..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-sky-500/20"
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRegeneratingImagePrompt}
                      onClick={handleRegenerateImagePromptOnly}
                      className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isRegeneratingImagePrompt && 'animate-spin')} />
                      Regenerate Image Prompt
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyImagePrompt}
                      className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Image Prompt
                    </Button>
                  </div>
                </div>

                {/* VIDEO GENERATION PROMPT */}
                <div className="rounded-3xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-3.5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                        <VideoIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Video Generation Prompt
                        </h4>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Version {videoPromptVersion} · {videoStyle} Style
                        </span>
                      </div>
                    </div>

                    {/* Video Style Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-medium">Style:</span>
                      <NativeSelect
                        value={videoStyle}
                        onChange={(e) => setVideoStyle(e.target.value)}
                        className="h-8 text-xs py-0 pl-2 pr-7 rounded-lg border-border bg-background"
                      >
                        {VIDEO_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <Textarea
                    rows={7}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Action and time breakdown for OpenAI Sora / Runway..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-purple-500/20"
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRegeneratingVideoPrompt}
                      onClick={handleRegenerateVideoPromptOnly}
                      className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isRegeneratingVideoPrompt && 'animate-spin')} />
                      Regenerate Video Prompt
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyVideoPrompt}
                      className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Video Prompt
                    </Button>
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* 3. ATTACHED MEDIA SECTION */}
              {/* ==================================================== */}
              <MediaCreativeSection
                media={mediaCreative}
                postTopic={topicPrompt || generatedTitle}
                targetPlatforms={selectedPlatforms}
                targetAudience={targetAudience}
                onChange={setMediaCreative}
              />
            </div>

            {/* Right Column (5 cols): Live Platform Preview & Submission */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 sticky top-6">
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
                  <SocialPlatformPreview
                    post={previewPostObject}
                    selectedPlatform={activePreviewPlatform}
                    onPlatformChange={setActivePreviewPlatform}
                  />
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
