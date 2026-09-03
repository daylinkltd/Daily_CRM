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
  SlidersHorizontal,
  Check,
  Zap,
  FileText,
  Eye,
  History,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from '@/components/ui/native-select';
import { MediaCreativeSection, type MediaCreativeData } from '@/components/marketing/media-creative-section';

const CONTENT_TYPES = [
  { id: 'social', label: 'Social Post', icon: Share2, desc: 'Engaging post for social feeds' },
  { id: 'blog', label: 'Blog Article', icon: BookOpen, desc: 'Long-form SEO thought leadership' },
  { id: 'promo', label: 'Promotion / Offer', icon: Flame, desc: 'Direct value proposition & sales' },
  { id: 'product_service', label: 'Product / Feature', icon: Layers, desc: 'Product spotlight or showcase' },
  { id: 'announcement', label: 'Announcement', icon: Zap, desc: 'Milestone, opening, or launch' },
  { id: 'educational', label: 'Educational', icon: Lightbulb, desc: 'Tips, guide, or tutorial' },
];

const PLATFORMS: Array<{ id: SocialPlatform; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'instagram', label: 'Instagram', icon: SOCIAL_PLATFORM_ICONS.instagram.icon },
  { id: 'linkedin', label: 'LinkedIn', icon: SOCIAL_PLATFORM_ICONS.linkedin.icon },
  { id: 'x', label: 'X (Twitter)', icon: SOCIAL_PLATFORM_ICONS.x.icon },
  { id: 'facebook', label: 'Facebook', icon: SOCIAL_PLATFORM_ICONS.facebook.icon },
  { id: 'tiktok', label: 'TikTok', icon: SOCIAL_PLATFORM_ICONS.tiktok.icon },
  { id: 'youtube', label: 'YouTube', icon: SOCIAL_PLATFORM_ICONS.youtube.icon },
  { id: 'threads', label: 'Threads', icon: SOCIAL_PLATFORM_ICONS.threads.icon },
];

const IMAGE_STYLES = [
  'Product Photography',
  'Cinematic',
  'Lifestyle',
  'Editorial',
  '3D',
  'Illustration',
  'Minimalist',
  'Premium Commercial',
  'Modern Tech',
];

const VIDEO_STYLES = [
  'Cinematic',
  'Product Showcase',
  'UGC-style',
  'Storytelling',
  'Fast-paced Social',
  'Minimal Premium',
  'Explainer',
];

const OBJECTIVES = [
  'Promotion & Sales',
  'Brand Awareness',
  'Product Launch',
  'Lead Generation',
  'Customer Education',
  'Community Engagement',
];

const QUICK_INSPIRATIONS = [
  { label: '🕯️ Vanilla Scented Candle', prompt: 'Create an Instagram post promoting our handmade vanilla scented candle for home decor and fragrance lovers. Make it cozy, premium, and warm.' },
  { label: '🍕 Artisan Pizza Opening', prompt: 'Create an announcement post for a new wood-fired artisanal pizza restaurant opening in Belgaum with authentic flavors and fresh ingredients.' },
  { label: '🏢 Luxury Apartments', prompt: 'Promote our new luxury residential apartments with panoramic views, modern architecture, and prime location for homebuyers.' },
  { label: '👗 Summer Linen Collection', prompt: 'Create an Instagram reel and photo ad for our new summer linen clothing collection for women aged 20–35. Effortless and chic.' },
  { label: '🤖 AI Automation Services', prompt: 'Create a LinkedIn post highlighting our AI workflow automation services for modern growing businesses looking to eliminate manual tasks.' },
];

const AUTOSAVE_KEY = 'dailybuz_universal_marketing_draft_v4';

type ResultTab = 'content' | 'image_prompt' | 'video_prompt' | 'preview';
type ToneType = 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';

interface GenerationHistoryItem {
  id: string;
  topic: string;
  title: string;
  timestamp: string;
  caption: string;
  imagePrompt: string;
  videoPrompt: string;
  hashtags: string[];
  keywords: string[];
  cta: string;
  platform: SocialPlatform;
}

export function CreateWorkspaceTabs() {
  const router = useRouter();
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();

  // Core Composer States
  const [contentType, setContentType] = useState<string>('social');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram', 'linkedin', 'x']);
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [objective, setObjective] = useState<string>('Promotion & Sales');
  const [tone, setTone] = useState<ToneType>('creative');

  // Collapsible Advanced Options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [campaignName, setCampaignName] = useState<string>('');
  const [productOrService, setProductOrService] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [imageStyle, setImageStyle] = useState<string>('Product Photography');
  const [videoStyle, setVideoStyle] = useState<string>('Cinematic');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [mediaCreative, setMediaCreative] = useState<MediaCreativeData | null>(null);

  // Loading States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRegeneratingImagePrompt, setIsRegeneratingImagePrompt] = useState<boolean>(false);
  const [isRegeneratingVideoPrompt, setIsRegeneratingVideoPrompt] = useState<boolean>(false);
  const [isRegeneratingHashtags, setIsRegeneratingHashtags] = useState<boolean>(false);
  const [isRegeneratingCaption, setIsRegeneratingCaption] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Generated Content Fields (Fully Editable)
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

  const [detectedSubject, setDetectedSubject] = useState<string>('');
  const [detectedIndustry, setDetectedIndustry] = useState<string>('');
  const [suggestedTime, setSuggestedTime] = useState<{ dayOfWeek: string; time: string } | null>(null);

  // Blog Specific Generated Fields
  const [blogSlug, setBlogSlug] = useState<string>('');
  const [blogSeoTitle, setBlogSeoTitle] = useState<string>('');
  const [blogSeoDescription, setBlogSeoDescription] = useState<string>('');
  const [blogContent, setBlogContent] = useState<string>('');

  // UI State
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('content');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatform>('instagram');
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<GenerationHistoryItem[]>([]);

  // Load Autosaved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.topicPrompt && typeof data.topicPrompt === 'string') setTopicPrompt(data.topicPrompt);
        if (data.contentType && typeof data.contentType === 'string') setContentType(data.contentType);
        if (data.selectedPlatforms && Array.isArray(data.selectedPlatforms) && data.selectedPlatforms.length > 0) {
          setSelectedPlatforms(data.selectedPlatforms);
        }
        if (data.objective && typeof data.objective === 'string') setObjective(data.objective);
        if (data.tone && typeof data.tone === 'string') setTone(data.tone as ToneType);
        if (data.generatedTitle && typeof data.generatedTitle === 'string') setGeneratedTitle(data.generatedTitle);
        if (data.generatedCaption && typeof data.generatedCaption === 'string') setGeneratedCaption(data.generatedCaption);
        if (data.generatedCta && typeof data.generatedCta === 'string') setGeneratedCta(data.generatedCta);
        if (Array.isArray(data.generatedHashtags)) setGeneratedHashtags(data.generatedHashtags.map((h: unknown) => String(h)));
        if (Array.isArray(data.generatedKeywords)) setGeneratedKeywords(data.generatedKeywords.map((k: unknown) => String(k)));
        if (data.imagePrompt && typeof data.imagePrompt === 'string') setImagePrompt(data.imagePrompt);
        if (data.videoPrompt && typeof data.videoPrompt === 'string') setVideoPrompt(data.videoPrompt);
        if (data.imagePromptVersion) setImagePromptVersion(Number(data.imagePromptVersion) || 1);
        if (data.videoPromptVersion) setVideoPromptVersion(Number(data.videoPromptVersion) || 1);
        if (data.detectedSubject && typeof data.detectedSubject === 'string') setDetectedSubject(data.detectedSubject);
        if (data.detectedIndustry && typeof data.detectedIndustry === 'string') setDetectedIndustry(data.detectedIndustry);
        if (data.isGenerated) setIsGenerated(Boolean(data.isGenerated));
      }
    } catch (e) {
      console.warn('[CreateWorkspace] Autosave parse skipped:', e);
    }
  }, []);

  // Autosave current draft state
  useEffect(() => {
    if (!topicPrompt && !generatedCaption) return;
    try {
      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          topicPrompt,
          contentType,
          selectedPlatforms,
          objective,
          tone,
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
          detectedSubject,
          detectedIndustry,
          isGenerated,
        })
      );
    } catch (err) {
      console.warn('[CreateWorkspace] Autosave write failed:', err);
    }
  }, [
    topicPrompt,
    contentType,
    selectedPlatforms,
    objective,
    tone,
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
    detectedSubject,
    detectedIndustry,
    isGenerated,
  ]);

  const togglePlatform = (p: SocialPlatform) => {
    const current = Array.isArray(selectedPlatforms) ? selectedPlatforms : [];
    if (current.includes(p)) {
      if (current.length > 1) {
        setSelectedPlatforms(current.filter((x) => x !== p));
      } else {
        toast.info('At least one target platform must remain selected.');
      }
    } else {
      setSelectedPlatforms([...current, p]);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = [...SOCIAL_TEMPLATES, ...BLOG_TEMPLATES].find((t) => t.id === templateId);
    if (tmpl) {
      setTone(tmpl.defaultTone as ToneType);
      if (!topicPrompt) {
        setTopicPrompt(`Promote our ${tmpl.name.toLowerCase()} with clear problem-solution framing`);
      }
      toast.success(`Applied "${tmpl.name}" blueprint`);
    }
  };

  const applyInspiration = (item: { label: string; prompt: string }) => {
    setTopicPrompt(item.prompt);
    toast.info(`Loaded prompt: ${item.label}`);
  };

  // --------------------------------------------------------------------------
  // MAIN AI GENERATION (Triggers only on click)
  // --------------------------------------------------------------------------
  const handleGenerateContent = async () => {
    if (!topicPrompt.trim()) {
      toast.error('Please enter what you want to create.');
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
        setBlogContent(data.blog.content);
        setGeneratedCaption(data.blog.content);
        setGeneratedKeywords(data.blog.tags || []);
        setGeneratedHashtags(data.blog.tags.map((t: string) => `#${t.replace(/\s+/g, '')}`));
        setImagePrompt(data.blog.image_prompt || '');
        setVideoPrompt(data.blog.video_prompt || '');
        setImagePromptVersion(data.blog.image_prompt_version || 1);
        setVideoPromptVersion(data.blog.video_prompt_version || 1);
        setDetectedSubject(data.structured_intent?.detectedSubject || topicPrompt);
        setDetectedIndustry(data.structured_intent?.detectedIndustry || 'Article');
      } else if (data.social) {
        setGeneratedTitle(data.social.title);
        setGeneratedCaption(data.social.caption);
        setGeneratedShortDesc(data.social.short_description || data.social.shortCaption || '');
        setGeneratedCta(data.social.cta);
        setGeneratedHashtags(data.social.hashtags || []);
        setGeneratedKeywords(data.social.keywords || []);
        setImagePrompt(data.social.image_prompt || '');
        setVideoPrompt(data.social.video_prompt || '');
        setImagePromptVersion(data.social.image_prompt_version || 1);
        setVideoPromptVersion(data.social.video_prompt_version || 1);
        setDetectedSubject(data.social.detected_subject || data.structured_intent?.detectedSubject || topicPrompt);
        setDetectedIndustry(data.social.detected_industry || data.structured_intent?.detectedIndustry || 'General');
        setSuggestedTime(data.social.suggestedPostingTime || null);

        // Add to session history
        const historyItem: GenerationHistoryItem = {
          id: `hist_${Date.now()}`,
          topic: topicPrompt.trim(),
          title: data.social.title,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          caption: data.social.caption,
          imagePrompt: data.social.image_prompt,
          videoPrompt: data.social.video_prompt,
          hashtags: data.social.hashtags,
          keywords: data.social.keywords,
          cta: data.social.cta,
          platform: selectedPlatforms[0] || 'instagram',
        };
        setSessionHistory((prev) => [historyItem, ...prev.slice(0, 4)]);
      }

      setIsGenerated(true);
      setEditingMode(false);
      setActiveResultTab('content');
      toast.success('✨ Marketing content and creative prompts generated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // --------------------------------------------------------------------------
  // GRANULAR REGENERATION HANDLERS
  // --------------------------------------------------------------------------
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
        toast.success(`Image prompt regenerated (${imageStyle} style)! Other fields preserved.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image prompt generation failed.';
      toast.error(msg);
    } finally {
      setIsRegeneratingImagePrompt(false);
    }
  };

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
        toast.success(`Video prompt regenerated (${videoStyle} style)! Other fields preserved.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Video prompt generation failed.';
      toast.error(msg);
    } finally {
      setIsRegeneratingVideoPrompt(false);
    }
  };

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
        setGeneratedHashtags(data.social.hashtags || []);
        setGeneratedKeywords(data.social.keywords || []);
        toast.success('Regenerated hashtags & keywords! Caption remained intact.');
      }
    } catch {
      toast.error('Could not refresh hashtags.');
    } finally {
      setIsRegeneratingHashtags(false);
    }
  };

  const handleRegenerateCaptionOnly = async () => {
    setIsRegeneratingCaption(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || generatedTitle,
          contentType,
          platforms: selectedPlatforms,
          tone,
          objective,
          regenTarget: 'caption_only',
          existingImagePrompt: imagePrompt,
          existingVideoPrompt: videoPrompt,
          existingHashtags: generatedHashtags,
          existingKeywords: generatedKeywords,
          workspaceId: activeWorkspace?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.social) {
        setGeneratedCaption(data.social.caption);
        setGeneratedCta(data.social.cta);
        toast.success('Regenerated caption! Prompts and tags preserved.');
      }
    } catch {
      toast.error('Could not refresh caption.');
    } finally {
      setIsRegeneratingCaption(false);
    }
  };

  // Restore history item
  const restoreHistoryItem = (item: GenerationHistoryItem) => {
    setTopicPrompt(item.topic);
    setGeneratedTitle(item.title);
    setGeneratedCaption(item.caption);
    setImagePrompt(item.imagePrompt);
    setVideoPrompt(item.videoPrompt);
    setGeneratedHashtags(item.hashtags);
    setGeneratedKeywords(item.keywords);
    setGeneratedCta(item.cta);
    setIsGenerated(true);
    toast.info(`Restored: "${item.title}"`);
  };

  // --------------------------------------------------------------------------
  // COPY & EDIT ACTIONS
  // --------------------------------------------------------------------------
  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      toast.error(`No ${label.toLowerCase()} to copy.`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const handleAddHashtag = () => {
    if (!newHashtagInput.trim()) return;
    const formatted = newHashtagInput.trim().startsWith('#')
      ? newHashtagInput.trim()
      : `#${newHashtagInput.trim().replace(/\s+/g, '')}`;
    if (!generatedHashtags.includes(formatted)) {
      setGeneratedHashtags([...generatedHashtags, formatted]);
    }
    setNewHashtagInput('');
  };

  const handleRemoveHashtag = (index: number) => {
    setGeneratedHashtags(generatedHashtags.filter((_, i) => i !== index));
  };

  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const clean = newKeywordInput.trim();
    if (!generatedKeywords.includes(clean)) {
      setGeneratedKeywords([...generatedKeywords, clean]);
    }
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (index: number) => {
    setGeneratedKeywords(generatedKeywords.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------------------------
  // SAVE / APPROVAL SUBMISSION
  // --------------------------------------------------------------------------
  const handleSavePost = async (targetStatus: PostStatus = 'draft') => {
    setIsSaving(true);
    try {
      const finalTitle = generatedTitle || topicPrompt || 'Untitled Marketing Post';
      const safePlatforms = Array.isArray(selectedPlatforms) && selectedPlatforms.length > 0
        ? selectedPlatforms
        : (['instagram'] as SocialPlatform[]);

      if (contentType === 'blog') {
        const blogRecord: BlogPost = {
          id: `blog_${Date.now()}`,
          category: 'blog',
          title: finalTitle,
          slug: blogSlug || finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          excerpt: blogSeoDescription || generatedCaption.slice(0, 160),
          content: blogContent || generatedCaption,
          summary: blogSeoDescription || generatedCaption.slice(0, 160),
          seoTitle: blogSeoTitle || finalTitle,
          seoDescription: blogSeoDescription || generatedCaption.slice(0, 160),
          keywords: generatedKeywords,
          tags: generatedKeywords,
          status: targetStatus,
          featuredImage: mediaCreative?.url || undefined,
          authorId: store?.currentUser?.id || 'usr_current',
          authorName: store?.currentUser?.name || 'Content Lead',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (store?.createBlogPost) {
          store.createBlogPost(blogRecord);
        }
        localStorage.removeItem(AUTOSAVE_KEY);
        toast.success(targetStatus === 'pending_approval' ? 'Blog submitted for approval!' : 'Blog saved to Drafts!');
        router.push('/marketing/blog');
      } else {
        const postRecord: SocialPost = {
          id: `post_${Date.now()}`,
          category: 'social',
          title: finalTitle,
          channels: safePlatforms,
          defaultCaption: `${generatedCaption}\n\n${generatedHashtags.join(' ')}`,
          mediaUrl: mediaCreative?.url || undefined,
          mediaType: mediaCreative?.type || 'image',
          altText: mediaCreative?.altText || undefined,
          status: targetStatus,
          creatorId: store?.currentUser?.id || 'usr_current',
          creatorName: store?.currentUser?.name || 'Administrator',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          auditHistory: [
            {
              id: `aud_${Date.now()}`,
              action: targetStatus === 'pending_approval' ? 'submitted' : 'created',
              userId: store?.currentUser?.id || 'usr_current',
              userName: store?.currentUser?.name || 'Administrator',
              userRole: store?.currentUser?.role || 'admin',
              timestamp: new Date().toISOString(),
              comment: `Post created via AI Marketing Composer (${targetStatus})`,
            },
          ],
        };

        if (store?.createSocialPost) {
          store.createSocialPost(postRecord);
        }

        if (activeWorkspace?.id) {
          try {
            await fetch('/api/marketing/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                post: postRecord,
                workspaceId: activeWorkspace.id,
              }),
            });
          } catch (apiErr) {
            console.warn('[CreateWorkspace] Non-blocking post creation API error:', apiErr);
          }
        }

        localStorage.removeItem(AUTOSAVE_KEY);

        if (targetStatus === 'pending_approval') {
          toast.success('Post submitted for Admin Approval!');
          router.push('/marketing/approvals');
        } else {
          toast.success('Post saved to Drafts!');
          router.push('/marketing/content');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving content';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview Post Object for Live Preview Box
  const safePlatformsList: SocialPlatform[] = Array.isArray(selectedPlatforms) && selectedPlatforms.length > 0
    ? selectedPlatforms
    : (['instagram'] as SocialPlatform[]);
  const safeHashtagsList = Array.isArray(generatedHashtags) ? generatedHashtags : [];
  const previewPostObject: SocialPost = {
    id: 'preview_draft',
    category: 'social',
    title: generatedTitle || topicPrompt || 'Post Preview',
    channels: safePlatformsList,
    defaultCaption: generatedCaption
      ? `${generatedCaption}\n\n${safeHashtagsList.join(' ')}`
      : 'Your AI generated caption and hashtags will appear here...',
    mediaUrl: mediaCreative?.url || undefined,
    mediaType: mediaCreative?.type || 'image',
    altText: mediaCreative?.altText || undefined,
    status: 'draft',
    creatorId: store?.currentUser?.id || 'usr_current',
    creatorName: store?.currentUser?.name || 'Administrator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditHistory: [],
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 2-Panel Layout: Composer on Left (5 cols), Results on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================================================================ */}
        {/* LEFT PANEL: CREATE WITH AI COMPOSER (5 cols)                    */}
        {/* ================================================================ */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-xs space-y-5 relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                    Create With AI
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Universal Marketing Composer</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
                Multi-Platform
              </span>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  What do you want to create? <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-muted-foreground">{topicPrompt.length} chars</span>
              </div>
              <Textarea
                rows={4}
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Create an Instagram post promoting our new lavender candle collection for women aged 20–35. Make it premium and elegant."
                className="w-full rounded-2xl border-border bg-background/90 text-xs p-3.5 resize-none transition-all focus:ring-2 focus:ring-primary/20 leading-relaxed font-medium"
              />
            </div>

            {/* Quick Inspiration Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-amber-500" /> Quick Starters:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_INSPIRATIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => applyInspiration(item)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Selector */}
            {contentType !== 'blog' && (
              <div className="space-y-2 pt-1 border-t border-border/60">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-primary" /> Target Platforms
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    const active = selectedPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all',
                          active
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{p.label}</span>
                        {active && <Check className="h-3 w-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Configuration Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Content Type</label>
                <NativeSelect
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Tone of Voice</label>
                <NativeSelect
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ToneType)}
                  className="h-9 text-xs rounded-xl"
                >
                  <option value="creative">Premium & Creative</option>
                  <option value="engaging">Engaging & Conversational</option>
                  <option value="professional">Professional & Authoritative</option>
                  <option value="concise">Concise & Direct</option>
                  <option value="educational">Educational & Structured</option>
                </NativeSelect>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground block mb-1">Marketing Objective</label>
                <NativeSelect
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                >
                  {OBJECTIVES.map((obj) => (
                    <option key={obj} value={obj}>{obj}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {/* Collapsible Advanced Options */}
            <div className="border border-border/80 rounded-2xl bg-muted/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  Advanced Options (Audience, Styles, Brand)
                </span>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAdvanced && (
                <div className="p-3.5 pt-2 border-t border-border/60 space-y-3 bg-card/60">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Concept Blueprint (Optional)</label>
                    <NativeSelect
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="h-8 text-xs rounded-xl"
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

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Audience (Optional)</label>
                    <Input
                      placeholder="e.g. Women aged 20-35, home fragrance lovers"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Image Prompt Style</label>
                      <NativeSelect
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="h-8 text-xs rounded-xl"
                      >
                        {IMAGE_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Video Prompt Style</label>
                      <NativeSelect
                        value={videoStyle}
                        onChange={(e) => setVideoStyle(e.target.value)}
                        className="h-8 text-xs rounded-xl"
                      >
                        {VIDEO_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Product / Brand Name</label>
                      <Input
                        placeholder="e.g. Creative Crafter"
                        value={productOrService}
                        onChange={(e) => setProductOrService(e.target.value)}
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Website URL</label>
                      <Input
                        placeholder="https://example.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Campaign Linkage</label>
                    <Input
                      placeholder="e.g. Summer Launch 2026"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Additional Creative Instructions</label>
                    <Input
                      placeholder="e.g. Warm amber glow, dried vanilla pods on wooden table, no watermarks"
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GENERATE BUTTON */}
            <Button
              type="button"
              size="lg"
              disabled={isGenerating || !topicPrompt.trim()}
              onClick={handleGenerateContent}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold shadow-md hover:shadow-lg transition-all gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Copy & Prompts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>GENERATE CONTENT & PROMPTS</span>
                </>
              )}
            </Button>
          </div>

          {/* Session History Tray */}
          {sessionHistory.length > 0 && (
            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" /> Recent Generations
                </span>
                <span className="text-[10px]">{sessionHistory.length} in session</span>
              </div>
              <div className="space-y-1.5">
                {sessionHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => restoreHistoryItem(item)}
                    className="w-full text-left p-2 rounded-xl bg-background hover:bg-muted/60 border border-border/60 transition-all flex items-center justify-between group"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{item.topic}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL: GENERATED RESULTS WORKSPACE (7 cols)               */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* STATE A: EMPTY STATE (Before Generation) */}
          {!isGenerated && !isGenerating && (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card/40 p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[480px] space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-bold text-foreground">
                  Your AI Generated Content Will Appear Here
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Describe any product, service, or campaign on the left and click <strong className="text-foreground font-semibold">Generate Content</strong>. The AI will formulate targeted social copy, hashtags, DALL-E image prompts, and video motion scripts.
                </p>
              </div>

              <div className="pt-3 flex flex-wrap justify-center gap-2 max-w-lg">
                <span className="text-[11px] font-bold text-muted-foreground w-full block mb-1">
                  Works for any business:
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  🕯️ Handmade Products
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  🍕 Restaurants & Cafes
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  🏢 Real Estate
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  👗 Fashion & Retail
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  🤖 AI & SaaS Tools
                </span>
              </div>
            </div>
          )}

          {/* STATE B: LOADING SKELETON */}
          {isGenerating && (
            <div className="rounded-3xl border border-border bg-card p-8 md:p-10 min-h-[480px] flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
                  <Sparkles className="h-6 w-6 animate-spin" />
                </div>
              </div>

              <div className="space-y-2 max-w-sm">
                <h4 className="text-sm font-bold text-foreground">
                  Crafting Marketing Copy & Creative Prompts...
                </h4>
                <p className="text-xs text-muted-foreground">
                  Analyzing industry intent, drafting platform-specific messaging, and generating visual motion concepts.
                </p>
              </div>

              {/* Shimmer skeleton bars */}
              <div className="w-full max-w-md space-y-2.5 pt-2">
                <div className="h-4 bg-muted/80 rounded-lg animate-pulse w-3/4 mx-auto" />
                <div className="h-4 bg-muted/60 rounded-lg animate-pulse w-full" />
                <div className="h-4 bg-muted/60 rounded-lg animate-pulse w-5/6 mx-auto" />
              </div>
            </div>
          )}

          {/* STATE C: GENERATED RESULTS TABS */}
          {isGenerated && !isGenerating && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Header Bar */}
              <div className="rounded-3xl border border-border bg-card p-4 md:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Generated Marketing Package
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {detectedSubject && (
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Subject: <strong className="text-foreground">{detectedSubject}</strong>
                        </span>
                      )}
                      {detectedIndustry && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                          {detectedIndustry}
                        </span>
                      )}
                    </div>
                  </div>
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
                </div>
              </div>

              {/* Results Tab Navigation Bar */}
              <div className="flex p-1 rounded-2xl bg-muted/60 border border-border gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveResultTab('content')}
                  className={cn(
                    'flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                    activeResultTab === 'content'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>Content Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveResultTab('image_prompt')}
                  className={cn(
                    'flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                    activeResultTab === 'image_prompt'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-sky-500" />
                  <span>Image Prompt</span>
                  <span className="text-[9px] bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-full px-1.5">
                    v{imagePromptVersion}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveResultTab('video_prompt')}
                  className={cn(
                    'flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                    activeResultTab === 'video_prompt'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <VideoIcon className="h-3.5 w-3.5 text-purple-500" />
                  <span>Video Prompt</span>
                  <span className="text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full px-1.5">
                    v{videoPromptVersion}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveResultTab('preview')}
                  className={cn(
                    'flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                    activeResultTab === 'preview'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Eye className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Live Preview</span>
                </button>
              </div>

              {/* ========================================================== */}
              {/* TAB 1: CONTENT COPY                                        */}
              {/* ========================================================== */}
              {activeResultTab === 'content' && (
                <div className="space-y-4">
                  {/* Title */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-xs">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Post Title
                    </label>
                    {editingMode ? (
                      <Input
                        value={generatedTitle}
                        onChange={(e) => setGeneratedTitle(e.target.value)}
                        className="text-xs font-semibold rounded-xl"
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground">{generatedTitle}</p>
                    )}
                  </div>

                  {/* Caption & Body */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {contentType === 'blog' ? 'Blog Article Content' : 'Caption / Description'}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {generatedCaption.length} chars • {generatedCaption.split(/\s+/).filter(Boolean).length} words
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isRegeneratingCaption}
                          onClick={handleRegenerateCaptionOnly}
                          className="h-6 px-2 text-[10px] font-bold text-primary gap-1"
                        >
                          <RefreshCw className={cn('h-3 w-3', isRegeneratingCaption && 'animate-spin')} />
                          Regenerate Caption
                        </Button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(generatedCaption, 'Caption')}
                          className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                    </div>

                    {editingMode || contentType === 'blog' ? (
                      <Textarea
                        rows={contentType === 'blog' ? 12 : 7}
                        value={contentType === 'blog' ? blogContent : generatedCaption}
                        onChange={(e) => contentType === 'blog' ? setBlogContent(e.target.value) : setGeneratedCaption(e.target.value)}
                        className="text-xs leading-relaxed rounded-xl font-mono"
                      />
                    ) : (
                      <p className="text-xs leading-relaxed whitespace-pre-line text-foreground/90 font-medium bg-muted/20 p-3 rounded-xl border border-border/40">
                        {generatedCaption}
                      </p>
                    )}
                  </div>

                  {/* Call to Action (CTA) */}
                  {generatedCta && (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          Call to Action (CTA)
                        </label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(generatedCta, 'CTA')}
                          className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
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
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
                    {/* Hashtags */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-primary" /> Hashtags ({generatedHashtags.length})
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isRegeneratingHashtags}
                            onClick={handleRegenerateHashtagsOnly}
                            className="h-6 px-2 text-[10px] font-bold text-primary gap-1"
                          >
                            <RefreshCw className={cn('h-3 w-3', isRegeneratingHashtags && 'animate-spin')} />
                            Regenerate Tags
                          </Button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(generatedHashtags.join(' '), 'Hashtags')}
                            className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" /> Copy All
                          </button>
                        </div>
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
                                className="text-primary hover:text-rose-500 ml-1 text-xs font-extrabold"
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
                    {generatedKeywords.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Keywords
                          </label>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(generatedKeywords.join(', '), 'Keywords')}
                            className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </div>
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
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 2: IMAGE GENERATION PROMPT                             */}
              {/* ========================================================== */}
              {activeResultTab === 'image_prompt' && (
                <div className="rounded-3xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Image Generation Prompt
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Copy and paste into OpenAI DALL-E 3 or Midjourney to create visual assets
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-medium">Style:</span>
                      <NativeSelect
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="h-7 text-xs py-0 pl-2 pr-6 rounded-lg border-border bg-background"
                      >
                        {IMAGE_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <Textarea
                    rows={8}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Detailed prompt for OpenAI DALL-E 3 / Midjourney..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-sky-500/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Info className="h-3.5 w-3.5 text-sky-500" />
                      <span>Optimized for {selectedPlatforms[0] || 'Instagram'} aspect ratios</span>
                    </div>

                    <div className="flex items-center gap-2">
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
                        onClick={() => copyToClipboard(imagePrompt, 'Image Prompt')}
                        className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Image Prompt
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 3: VIDEO GENERATION PROMPT                             */}
              {/* ========================================================== */}
              {activeResultTab === 'video_prompt' && (
                <div className="rounded-3xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                        <VideoIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Video Generation Prompt
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Copy and paste into OpenAI Sora, Runway Gen-3, or Kling
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-medium">Style:</span>
                      <NativeSelect
                        value={videoStyle}
                        onChange={(e) => setVideoStyle(e.target.value)}
                        className="h-7 text-xs py-0 pl-2 pr-6 rounded-lg border-border bg-background"
                      >
                        {VIDEO_STYLES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>

                  <Textarea
                    rows={9}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Chronological action and time breakdown for video models..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-purple-500/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-purple-500" />
                      <span>Chronological 0–10s sequence with hook, action & CTA</span>
                    </div>

                    <div className="flex items-center gap-2">
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
                        onClick={() => copyToClipboard(videoPrompt, 'Video Prompt')}
                        className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Video Prompt
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 4: LIVE SOCIAL PREVIEW                                 */}
              {/* ========================================================== */}
              {activeResultTab === 'preview' && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Platform Preview
                    </span>
                    <div className="flex gap-1">
                      {(Array.isArray(selectedPlatforms) ? selectedPlatforms : []).map((p) => {
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

                  {suggestedTime && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <span>
                        Recommended Post Time: <strong className="text-foreground">{suggestedTime.dayOfWeek} at {suggestedTime.time}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Attached Media Creative Section */}
              <MediaCreativeSection
                media={mediaCreative}
                postTopic={topicPrompt || generatedTitle}
                targetPlatforms={Array.isArray(selectedPlatforms) ? selectedPlatforms : ['instagram']}
                targetAudience={targetAudience}
                onChange={setMediaCreative}
              />

              {/* Bottom Actions Bar (Draft / Submit Approval) */}
              <div className="rounded-3xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Ready to publish or send for peer review?
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => handleSavePost('draft')}
                    className="flex-1 sm:flex-initial h-10 text-xs font-bold rounded-xl gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Draft
                  </Button>
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSavePost('pending_approval')}
                    className="flex-1 sm:flex-initial h-10 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 shadow-md hover:shadow-lg"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit for Approval
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
