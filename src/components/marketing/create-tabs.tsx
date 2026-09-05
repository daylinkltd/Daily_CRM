"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { SOCIAL_TEMPLATES, BLOG_TEMPLATES } from '@/lib/marketing/template-library';
import { SocialPlatformPreview } from '@/components/social/platform-previews';
import type { SocialPost, BlogPost, PostStatus, SocialPlatform, ToneType, ContentType as SchemaContentType } from '@/types/calendar';
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
  Award,
  Quote,
  Camera,
  TrendingUp,
  MessageSquare,
  Calendar,
  Smile,
  Scale,
  Users,
  Gift,
  Mail,
  Paperclip,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  X,
  PlusCircle,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MediaCreativeSection, type MediaCreativeData } from '@/components/marketing/media-creative-section';
import { evaluateBlogSEO, type SEOReadinessReport } from '@/lib/marketing/seo-evaluator';
import type { ReferenceArticle, GenerationTraceContext, RelevanceValidationResult } from '@/lib/marketing/attachment-processor';
import type { WebResearchSource } from '@/lib/marketing/web-researcher';
import { ReferenceAssetUploader } from '@/components/marketing/reference-asset-uploader';
import type { SelectedAssetReference, BrandAsset } from '@/lib/marketing/brand-asset-selector';


export const CONTENT_TYPES = [
  { id: 'social', label: 'Social Post', icon: Share2, desc: 'Engaging post for multi-channel social feeds' },
  { id: 'blog', label: 'Blog Article', icon: BookOpen, desc: 'Long-form SEO thought leadership and articles' },
  { id: 'promo', label: 'Promotion / Offer', icon: Flame, desc: 'Special discounts, coupons & sales offers' },
  { id: 'product_service', label: 'Product / Feature', icon: Layers, desc: 'Spotlight new releases, products or services' },
  { id: 'announcement', label: 'Announcement', icon: Zap, desc: 'Company milestones, openings & press releases' },
  { id: 'educational', label: 'Educational / How-To', icon: Lightbulb, desc: 'Actionable guides, tutorials & breakdowns' },
  { id: 'case_study', label: 'Case Study / Success Story', icon: Award, desc: 'Customer transformation, proof & ROI results' },
  { id: 'testimonial', label: 'Testimonial & Social Proof', icon: Quote, desc: 'Customer reviews, ratings & feedback' },
  { id: 'behind_the_scenes', label: 'Behind the Scenes', icon: Camera, desc: 'Team culture, workplace & making-of' },
  { id: 'industry_insights', label: 'Industry News & Insights', icon: TrendingUp, desc: 'Market analysis, trends & expert commentary' },
  { id: 'interactive_poll', label: 'Poll / Question / Interactive', icon: MessageSquare, desc: 'High-engagement discussion & questions' },
  { id: 'tips_tricks', label: 'Tips & Tricks / Quick Hack', icon: Sparkles, desc: 'Bite-sized hacks and practical shortcuts' },
  { id: 'event', label: 'Event / Webinar / Launch', icon: Calendar, desc: 'Live event invites, summits & webinar promos' },
  { id: 'meme_humor', label: 'Meme & Humor / Viral', icon: Smile, desc: 'Relatable trending humor & cultural memes' },
  { id: 'comparison', label: 'Product Comparison / Vs', icon: Scale, desc: 'Feature breakdowns vs alternative approaches' },
  { id: 'ugc_spotlight', label: 'User-Generated Content (UGC)', icon: Users, desc: 'Community spotlight, reposts & stories' },
  { id: 'seasonal_holiday', label: 'Holiday & Seasonal Greetings', icon: Gift, desc: 'Festive celebrations & holiday wishes' },
  { id: 'newsletter_digest', label: 'Newsletter / Weekly Digest', icon: Mail, desc: 'Curated weekly roundup & top takeaways' },
];

export const TONE_OPTIONS: Array<{ id: ToneType; label: string; desc: string }> = [
  { id: 'creative', label: 'Premium & Creative', desc: 'Aesthetic, imaginative, and refined' },
  { id: 'engaging', label: 'Engaging & Conversational', desc: 'Friendly, relatable, and interactive' },
  { id: 'professional', label: 'Professional & Authoritative', desc: 'Executive, credible, and industry-leading' },
  { id: 'concise', label: 'Concise & Direct', desc: 'Punchy, clear, and high-impact' },
  { id: 'educational', label: 'Educational & Structured', desc: 'Informative, analytical, and step-by-step' },
  { id: 'bold', label: 'Bold & Visionary', desc: 'Disruptive, ambitious, and fearless' },
  { id: 'witty', label: 'Witty & Humorous', desc: 'Clever, playful, and entertaining' },
  { id: 'empathetic', label: 'Empathetic & Caring', desc: 'Warm, human-centric, and heartfelt' },
  { id: 'urgent', label: 'Urgent & Action-Oriented (FOMO)', desc: 'High-energy, compelling, and limited-time' },
  { id: 'inspirational', label: 'Inspirational & Motivational', desc: 'Uplifting, empowering, and passionate' },
  { id: 'technical', label: 'Technical & Analytical', desc: 'Data-driven, precise, and deep-dive' },
  { id: 'casual', label: 'Casual & Relatable', desc: 'Authentic, laid-back, and modern' },
  { id: 'storytelling', label: 'Storytelling & Narrative', desc: 'Emotive story arc, suspense, and journey' },
  { id: 'luxurious', label: 'Sophisticated & Luxurious', desc: 'High-end, bespoke, and timeless elegance' },
  { id: 'contrarian', label: 'Provocative & Contrarian', desc: 'Challenging conventional norms & debate' },
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
  'Cinematic & Dramatic',
  'Lifestyle & Authentic',
  'Editorial & High-Fashion',
  '3D Render & Isometric',
  'Modern Tech & SaaS UI',
  'Minimalist & Clean',
  'Premium Commercial',
  'Flat Lay & Overhead',
  'Hyper-Realistic Macro',
  'Vector Illustration & Graphic',
  'Vintage & Retro Film',
  'Abstract & Gradient Art',
  'Infographic & Data Visual',
];

const VIDEO_STYLES = [
  'Cinematic & Moody',
  'Product Showcase & Demo',
  'UGC / Creator-style',
  'Storytelling & Mini-Doc',
  'Fast-Paced Social / TikTok / Reel',
  'Minimalist & Luxury Commercial',
  'Explainer & Motion Graphic',
  'Behind the Scenes & Vlog',
  '3D Product Animation',
  'Customer Testimonial & Interview',
  'Dynamic Kinetic Typography',
  'Tutorial & Screen Walkthrough',
];

const OBJECTIVES = [
  'Promotion & Sales',
  'Brand Awareness & Reach',
  'Product / Feature Launch',
  'Lead Generation & Signups',
  'Customer Education & Trust',
  'Community Engagement & Virality',
  'Website Traffic & Link Clicks',
  'Event & Webinar Registrations',
  'Customer Retention & Loyalty',
  'Employer Branding & Recruitment',
];

const QUICK_INSPIRATIONS = [
  { label: '🕯️ Vanilla Scented Candle', prompt: 'Create an Instagram post promoting our handmade vanilla scented candle for home decor and fragrance lovers. Make it cozy, premium, and warm.' },
  { label: '🍕 Artisan Pizza Opening', prompt: 'Create an announcement post for a new wood-fired artisanal pizza restaurant opening in Belgaum with authentic flavors and fresh ingredients.' },
  { label: '🏢 Luxury Apartments', prompt: 'Promote our new luxury residential apartments with panoramic views, modern architecture, and prime location for homebuyers.' },
  { label: '👗 Summer Linen Collection', prompt: 'Create an Instagram reel and photo ad for our new summer linen clothing collection for women aged 20–35. Effortless and chic.' },
  { label: '🤖 AI Automation Services', prompt: 'Create a LinkedIn post highlighting our AI workflow automation services for modern growing businesses looking to eliminate manual tasks.' },
];

const AUTOSAVE_KEY = 'dailybuz_universal_marketing_draft_v4';

type ResultTab = 'content' | 'image_prompt' | 'video_prompt' | 'preview' | 'sources';

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

  // Attachment-First Context Grounding & Live Web Research State
  const [referenceArticles, setReferenceArticles] = useState<ReferenceArticle[]>([]);
  const [researchSources, setResearchSources] = useState<WebResearchSource[]>([]);
  const [primaryKeyword, setPrimaryKeyword] = useState<string>('');
  const [traceContext, setTraceContext] = useState<GenerationTraceContext | null>(null);
  const [relevanceResult, setRelevanceResult] = useState<RelevanceValidationResult | null>(null);
  const [showTraceModal, setShowTraceModal] = useState<boolean>(false);
  const [showAddTextModal, setShowAddTextModal] = useState<boolean>(false);
  const [pastedDocTitle, setPastedDocTitle] = useState<string>('');
  const [pastedDocContent, setPastedDocContent] = useState<string>('');

  // UI State
  const [generationMode, setGenerationMode] = useState<'web_research' | 'ai_generate'>('web_research');
  const [searchErrorState, setSearchErrorState] = useState<{ topic: string; message: string } | null>(null);
  const [selectedBrandAssets, setSelectedBrandAssets] = useState<SelectedAssetReference[]>([]);
  const [activeBrandReferences, setActiveBrandReferences] = useState<BrandAsset[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('content');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatform>('instagram');
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<GenerationHistoryItem[]>([]);

  // AI Video Generation State
  const [videoGenState, setVideoGenState] = useState<'IDLE' | 'VALIDATING' | 'SUBMITTING' | 'GENERATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [videoGenProgress, setVideoGenProgress] = useState<number>(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s' | '15s' | '30s'>('10s');
  const [generatedVideo, setGeneratedVideo] = useState<{
    id: string;
    video_url: string;
    thumbnail_url: string;
    title: string;
    duration: string;
    aspectRatio: string;
  } | null>(null);
  const [videoGenError, setVideoGenError] = useState<{
    message: string;
    code: string;
    suggestedAction: string;
  } | null>(null);

  // AI Image Generation State
  const [imageGenState, setImageGenState] = useState<'IDLE' | 'GENERATING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [generatedImage, setGeneratedImage] = useState<{
    id: string;
    url: string;
    title: string;
    style: string;
    prompt: string;
  } | null>(null);
  const [imageGenError, setImageGenError] = useState<{
    message: string;
    code: string;
    suggestedAction: string;
  } | null>(null);

  // File Upload and Text Paste Handlers for Reference Articles
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          if (!text.trim()) {
            toast.warning(`File "${file.name}" is empty and could not be processed for grounding.`);
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
          toast.success(`Attached "${file.name}" as primary source of truth!`);
        }
      };
      reader.onerror = () => {
        toast.error(`Could not read file "${file.name}". Please ensure it is a text-based document.`);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const handleAddPastedArticle = () => {
    if (!pastedDocContent.trim()) {
      toast.error('Please paste document or article text.');
      return;
    }
    const docName = pastedDocTitle.trim() || `Pasted Source (${referenceArticles.length + 1})`;
    setReferenceArticles((prev) => [
      ...prev,
      {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: docName,
        content: pastedDocContent.trim(),
        type: 'text/plain',
      },
    ]);
    setPastedDocTitle('');
    setPastedDocContent('');
    setShowAddTextModal(false);
    toast.success(`Added reference source "${docName}".`);
  };

  const handleRemoveArticle = (id?: string) => {
    setReferenceArticles((prev) => prev.filter((a) => a.id !== id));
    toast.info('Removed reference attachment.');
  };

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
  // --------------------------------------------------------------------------
  // MAIN AI GENERATION (Triggers only on click)
  // --------------------------------------------------------------------------
  const handleGenerateContent = async (overrideMode?: 'web_research' | 'ai_generate') => {
    if (!topicPrompt.trim() && referenceArticles.length === 0) {
      toast.error('Please enter what you want to create.');
      return;
    }

    const activeMode = overrideMode || (referenceArticles.length > 0 ? 'from_sources' : generationMode);
    setIsGenerating(true);
    setSearchErrorState(null);

    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || 'Reference Content',
          generationMode: activeMode,
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
          brandAssets: activeBrandReferences.length > 0 ? activeBrandReferences : undefined,
          uploadedMediaUrl: mediaCreative?.source === 'uploaded' ? mediaCreative.url : undefined,
          referenceArticles: referenceArticles.length > 0 ? referenceArticles : undefined,
          primaryKeyword: primaryKeyword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.stage === 'search' || data.error_code === 'SEARCH_PROVIDER_UNAVAILABLE') {
          setSearchErrorState({
            topic: topicPrompt.trim(),
            message: data.error || data.message || "Web research is currently unavailable for this topic.",
          });
          return;
        }
        throw new Error(data.error || data.message || 'Content generation failed. Please try again.');
      }

      // Capture Trace Context & Relevance & Web Research Sources
      const currentTrace = data.traceContext || data.blog?.traceContext || data.social?.traceContext || null;
      const currentRelevance = data.relevance || data.blog?.relevance || data.social?.relevance || null;
      const currentSources: WebResearchSource[] = data.researchSources || data.blog?.researchSources || data.social?.researchSources || data.webResearch?.sources || [];
      setTraceContext(currentTrace);
      setRelevanceResult(currentRelevance);
      setResearchSources(currentSources);
      setSearchErrorState(null);

      if (currentTrace?.warnings && currentTrace.warnings.length > 0) {
        currentTrace.warnings.forEach((w: string) => toast.warning(w));
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
        setSelectedBrandAssets(data.blog.selected_assets || []);
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
        setSelectedBrandAssets(data.social.selected_assets || []);
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
          brandAssets: activeBrandReferences.length > 0 ? activeBrandReferences : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image prompt regeneration failed');

      const newPrompt = data.mode === 'blog' ? data.blog?.image_prompt : data.social?.image_prompt;
      const newVersion = data.mode === 'blog' ? data.blog?.image_prompt_version : data.social?.image_prompt_version;
      const newSelectedAssets = data.mode === 'blog' ? data.blog?.selected_assets : data.social?.selected_assets;

      if (newPrompt) {
        setImagePrompt(newPrompt);
        setImagePromptVersion(newVersion || imagePromptVersion + 1);
        if (newSelectedAssets) setSelectedBrandAssets(newSelectedAssets);
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
          brandAssets: activeBrandReferences.length > 0 ? activeBrandReferences : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video prompt regeneration failed');

      const newPrompt = data.mode === 'blog' ? data.blog?.video_prompt : data.social?.video_prompt;
      const newVersion = data.mode === 'blog' ? data.blog?.video_prompt_version : data.social?.video_prompt_version;
      const newSelectedAssets = data.mode === 'blog' ? data.blog?.selected_assets : data.social?.selected_assets;

      if (newPrompt) {
        setVideoPrompt(newPrompt);
        setVideoPromptVersion(newVersion || videoPromptVersion + 1);
        if (newSelectedAssets) setSelectedBrandAssets(newSelectedAssets);
        toast.success(`Video prompt regenerated (${videoStyle} style)! Other fields preserved.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Video prompt generation failed.';
      toast.error(msg);
    } finally {
      setIsRegeneratingVideoPrompt(false);
    }
  };

  const handleGenerateAIVideo = async () => {
    if (!videoPrompt || videoPrompt.trim().length < 5) {
      toast.error('Please enter a descriptive video prompt (at least 5 characters).');
      return;
    }

    setVideoGenError(null);
    setVideoGenState('VALIDATING');
    setVideoGenProgress(15);

    try {
      setVideoGenState('SUBMITTING');
      setVideoGenProgress(30);

      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt.trim(),
          title: generatedTitle || topicPrompt || 'AI Video Creative',
          style: videoStyle,
          aspectRatio: videoAspectRatio,
          duration: videoDuration,
        }),
      });

      setVideoGenState('GENERATING');
      setVideoGenProgress(65);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setVideoGenState('FAILED');
        setVideoGenError({
          message: data.message || "Video generation couldn't be completed.",
          code: data.code || 'PROVIDER_REJECTED',
          suggestedAction: data.suggestedAction || 'edit_prompt',
        });
        toast.error(data.message || 'Video generation failed.');
        return;
      }

      setVideoGenState('PROCESSING');
      setVideoGenProgress(90);

      setGeneratedVideo({
        id: data.id,
        video_url: data.video_url,
        thumbnail_url: data.thumbnail_url,
        title: data.title,
        duration: data.duration,
        aspectRatio: data.aspectRatio,
      });

      setVideoGenState('COMPLETED');
      setVideoGenProgress(100);
      toast.success('AI Video generated successfully!');
    } catch (err: any) {
      setVideoGenState('FAILED');
      setVideoGenError({
        message: 'Connection to the video generation service failed.',
        code: 'NETWORK_ERROR',
        suggestedAction: 'try_again',
      });
      toast.error('Connection to the video generation service failed.');
    }
  };

  const handleSaveVideoToContentLibrary = () => {
    if (!generatedVideo) return;
    store.createSocialPost({
      title: generatedVideo.title || generatedTitle || 'AI Video Post',
      defaultCaption: generatedCaption || `Watch: ${topicPrompt || 'New Video Feature'}`,
      contentType: 'video',
      channels: selectedPlatforms && selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'tiktok', 'youtube'],
      status: 'draft',
      mediaUrl: generatedVideo.video_url,
      mediaType: 'video',
      mediaSource: 'AI_GENERATED',
      video_prompt: videoPrompt,
      video_prompt_version: videoPromptVersion,
      objective: objective,
    });
    toast.success('Saved video to Marketing Content Library!');
  };

  const handleGenerateAIImage = async () => {
    if (!imagePrompt || imagePrompt.trim().length < 5) {
      toast.error('Please enter a descriptive image prompt (at least 5 characters).');
      return;
    }

    setImageGenError(null);
    setImageGenState('GENERATING');

    try {
      const res = await fetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          title: generatedTitle || topicPrompt || 'AI Image Creative',
          style: imageStyle,
          platform: selectedPlatforms[0] || 'instagram',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setImageGenState('FAILED');
        setImageGenError({
          message: data.message || "Image generation couldn't be completed.",
          code: data.code || 'PROVIDER_REJECTED',
          suggestedAction: data.suggestedAction || 'edit_prompt',
        });
        toast.error(data.message || 'Image generation failed.');
        return;
      }

      setImageGenState('COMPLETED');
      setGeneratedImage({
        id: data.image?.id || `img_${Date.now()}`,
        url: data.media?.url || data.image?.url,
        title: data.image?.title || generatedTitle || 'AI Image Asset',
        style: data.media?.visualStyle || imageStyle,
        prompt: imagePrompt,
      });

      toast.success('AI Image generated successfully!');
    } catch (err: any) {
      setImageGenState('FAILED');
      setImageGenError({
        message: 'Connection to the image generation service failed.',
        code: 'NETWORK_ERROR',
        suggestedAction: 'try_again',
      });
      toast.error('Connection to the image generation service failed.');
    }
  };

  const handleSaveImageToContentLibrary = () => {
    if (!generatedImage) return;
    store.createSocialPost({
      title: generatedImage.title || generatedTitle || 'AI Image Post',
      defaultCaption: generatedCaption || `Highlight: ${topicPrompt || 'New Featured Creative'}`,
      contentType: 'announcement',
      channels: selectedPlatforms && selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'linkedin'],
      status: 'draft',
      mediaUrl: generatedImage.url,
      mediaType: 'image',
      mediaSource: 'AI_GENERATED',
      image_prompt: imagePrompt,
      image_prompt_version: imagePromptVersion,
      objective: objective,
    });
    toast.success('Saved image to Marketing Content Library!');
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

  // Live SEO Evaluation for generated blog article
  const liveSeoReport: SEOReadinessReport | null = (contentType === 'blog' && (generatedTitle || blogContent || generatedCaption))
    ? evaluateBlogSEO({
        title: generatedTitle,
        seoTitle: blogSeoTitle || generatedTitle,
        seoDescription: blogSeoDescription || generatedCaption.slice(0, 160),
        slug: blogSlug || generatedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: blogContent || generatedCaption,
        primaryKeyword: primaryKeyword.trim() || (generatedKeywords?.[0] || ''),
        secondaryKeywords: generatedKeywords?.slice(1) || [],
        featuredImage: mediaCreative?.url || undefined,
        altText: blogSeoTitle || generatedTitle,
      })
    : null;

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

            {/* Mode Selector for Blog Content */}
            {contentType === 'blog' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-2xl border border-border">
                  <button
                    type="button"
                    onClick={() => { setGenerationMode('web_research'); setSearchErrorState(null); }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-bold transition-all',
                      generationMode === 'web_research'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Web Research</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGenerationMode('ai_generate'); setSearchErrorState(null); }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-bold transition-all',
                      generationMode === 'ai_generate'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Generate</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  {generationMode === 'web_research'
                    ? '🌐 Searches live global news & authoritative sources for real-time citations.'
                    : '⚡ Fast direct generation from domain intelligence (100% offline capable).'}
                </p>
              </div>
            )}

            {/* Search Provider Error Banner with Fallback Actions (Step 9) */}
            {searchErrorState && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">{searchErrorState.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      You can retry live web research or immediately generate the article using AI Generate mode.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateContent('web_research')}
                    disabled={isGenerating}
                    className="h-7 text-xs rounded-xl border-amber-500/40 text-amber-800 dark:text-amber-200"
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", isGenerating && "animate-spin")} />
                    Retry Research
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateContent('ai_generate')}
                    disabled={isGenerating}
                    className="h-7 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Generate Without Research
                  </Button>
                </div>
              </div>
            )}

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

            {/* Reference Articles / Attachments (Attachment-First Grounding) */}
            <div className="space-y-2.5 pt-2 border-t border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  <label className="text-xs font-bold text-foreground">
                    Reference Articles / Attachments
                  </label>
                  {referenceArticles.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary font-bold">
                      {referenceArticles.length} attached
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="cursor-pointer text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-primary/10 transition-colors">
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
                    onClick={() => setShowAddTextModal(true)}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <PlusCircle className="h-3 w-3" /> Paste Text
                  </button>
                </div>
              </div>

              {referenceArticles.length === 0 ? (
                <div className="p-3 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    Attach source articles or notes to ground AI generation strictly in facts, entities & data.
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    Supports .txt, .md, .doc, .docx, .pdf, or pasted text
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Attachment-First Active: Content will strictly reflect source facts & prevent topic drift.</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                    {referenceArticles.map((art) => (
                      <div
                        key={art.id}
                        className="flex items-center justify-between p-2 rounded-xl border border-border bg-card text-xs group hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="truncate">
                            <p className="font-semibold text-foreground text-[11px] truncate">{art.name}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {art.content.length} chars • ~{art.content.split(/\s+/).filter(Boolean).length} words
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveArticle(art.id)}
                          className="text-muted-foreground hover:text-rose-500 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Remove attachment"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reference Brand & Product Images (Drag & Drop Uploader) */}
            <div className="space-y-2.5 pt-2 border-t border-border/70">
              <ReferenceAssetUploader
                workspaceId={activeWorkspace?.id || ''}
                references={activeBrandReferences}
                onChange={setActiveBrandReferences}
              />
            </div>

            {/* Primary SEO Keyword (Keyword as constraint, NOT topic) */}
            <div className="space-y-1.5 pt-2 border-t border-border/70">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" /> Primary SEO Keyword (Optional)
                </label>
                <span className="text-[10px] text-muted-foreground">SEO Constraint</span>
              </div>
              <Input
                placeholder="e.g. Nepal Disaster Response, Organic Lavender Candle, Cloud CRM"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Guides SEO title, slug, and meta optimization without hijacking the attachment’s factual subject.
              </p>
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
                <Select value={contentType} onValueChange={(val) => { if (val) setContentType(val); }}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border">
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent searchable={true} searchPlaceholder="Search content types...">
                    {CONTENT_TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2 py-0.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-medium text-foreground text-xs">{t.label}</span>
                              <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Tone of Voice</label>
                <Select value={tone} onValueChange={(val) => { if (val) setTone(val as ToneType); }}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent searchable={true} searchPlaceholder="Search tones...">
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex flex-col text-left py-0.5">
                          <span className="font-medium text-foreground text-xs">{t.label}</span>
                          <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground block mb-1">Marketing Objective</label>
                <Select value={objective} onValueChange={(val) => { if (val) setObjective(val); }}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border">
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent searchable={true} searchPlaceholder="Search objectives...">
                    {OBJECTIVES.map((obj) => (
                      <SelectItem key={obj} value={obj}>
                        <span className="text-xs">{obj}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <Select
                      value={selectedTemplateId || 'custom'}
                      onValueChange={(val) => { handleTemplateSelect(val === 'custom' ? '' : (val || '')); }}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-border">
                        <SelectValue placeholder="Custom Concept" />
                      </SelectTrigger>
                      <SelectContent searchable={true} searchPlaceholder="Search blueprints...">
                        <SelectItem value="custom">Custom Concept</SelectItem>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">Social Templates</SelectLabel>
                          {SOCIAL_TEMPLATES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="text-xs">{t.name}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">Blog Templates</SelectLabel>
                          {BLOG_TEMPLATES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="text-xs">{t.name}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
                      <Select value={imageStyle} onValueChange={(val) => { if (val) setImageStyle(val); }}>
                        <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-border">
                          <SelectValue placeholder="Select image style" />
                        </SelectTrigger>
                        <SelectContent searchable={true} searchPlaceholder="Search styles...">
                          {IMAGE_STYLES.map((st) => (
                            <SelectItem key={st} value={st}>
                              <span className="text-xs">{st}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Video Prompt Style</label>
                      <Select value={videoStyle} onValueChange={(val) => { if (val) setVideoStyle(val); }}>
                        <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-border">
                          <SelectValue placeholder="Select video style" />
                        </SelectTrigger>
                        <SelectContent searchable={true} searchPlaceholder="Search video styles...">
                          {VIDEO_STYLES.map((st) => (
                            <SelectItem key={st} value={st}>
                              <span className="text-xs">{st}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              onClick={() => handleGenerateContent()}
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

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {relevanceResult && (
                    <Badge
                      className={cn(
                        'text-xs font-bold gap-1 px-2.5 py-1',
                        relevanceResult.score >= 70
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{relevanceResult.score}% Grounded</span>
                    </Badge>
                  )}

                  {traceContext && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTraceModal(true)}
                      className="h-8 text-xs font-semibold rounded-xl gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      <span>Trace (Dev)</span>
                    </Button>
                  )}

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

                {researchSources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('sources')}
                    className={cn(
                      'flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all',
                      activeResultTab === 'sources'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Research Sources ({researchSources.length})</span>
                  </button>
                )}
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

                  {/* Real-time SEO Readiness Checklist & Audit (Blog Mode) */}
                    {contentType === 'blog' && liveSeoReport && (
                      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-purple-600" />
                            <div>
                              <h4 className="text-xs font-bold text-foreground">Live SEO Readiness Audit</h4>
                              <p className="text-[10px] text-muted-foreground">Evaluating final generated article against SEO standards</p>
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              'text-xs font-bold px-2.5 py-0.5',
                              liveSeoReport.grade === 'Good'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 text-white'
                            )}
                          >
                            {liveSeoReport.score}% — {liveSeoReport.grade}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] p-2 rounded-xl bg-muted/40">
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Word Count</span>
                            <span className="font-semibold text-foreground">{liveSeoReport.wordCount} words</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Reading Time</span>
                            <span className="font-semibold text-foreground">~{liveSeoReport.readingTimeMinutes} mins</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Keyword Used</span>
                            <span className="font-semibold text-foreground truncate block">{primaryKeyword || generatedKeywords[0] || 'Auto-detected'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">URL Slug</span>
                            <span className="font-semibold text-foreground truncate block">/{blogSlug || 'article-slug'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {liveSeoReport.checks.map((chk) => (
                            <div key={chk.id} className="p-2.5 rounded-xl border border-border/70 bg-background text-xs space-y-0.5">
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
                    )}
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 2: IMAGE GENERATION PROMPT & AI GENERATOR             */}
              {/* ========================================================== */}
              {activeResultTab === 'image_prompt' && (
                <div className="rounded-3xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          Image Generation Prompt & Engine
                          <span className="text-[10px] text-sky-600 font-black bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                            v{imagePromptVersion}
                          </span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Direct generation or copy into OpenAI DALL-E 3 or Midjourney
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0">Style:</span>
                      <Select value={imageStyle} onValueChange={(val) => { if (val) setImageStyle(val); }}>
                        <SelectTrigger className="h-7 text-xs rounded-lg border-border bg-background min-w-[140px]">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent searchable={true} searchPlaceholder="Search styles...">
                          {IMAGE_STYLES.map((st) => (
                            <SelectItem key={st} value={st}>
                              <span className="text-xs">{st}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Textarea
                    id="marketing-image-prompt-input"
                    rows={8}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Detailed prompt for OpenAI DALL-E 3 / Midjourney..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-sky-500/20"
                  />

                  {/* Generation Progress State Card */}
                  {imageGenState === 'GENERATING' && (
                    <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 space-y-2.5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-2 text-sky-700 dark:text-sky-300">
                          <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
                          Synthesizing image visual assets...
                        </span>
                        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-500/20 px-2 py-0.5 rounded-md">
                          GENERATING
                        </span>
                      </div>
                      <div className="w-full bg-sky-200/60 dark:bg-sky-950 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-sky-500 to-indigo-600 h-2 rounded-full w-2/3 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* Error / Guardrails Refusal Card */}
                  {imageGenState === 'FAILED' && imageGenError && (
                    <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                            Image generation couldn't be completed.
                          </h5>
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {imageGenError.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          type="button"
                          onClick={handleGenerateAIImage}
                          className="h-8 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          Try Again
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const el = document.getElementById('marketing-image-prompt-input');
                            el?.focus();
                          }}
                          className="h-8 text-xs font-bold rounded-xl border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                        >
                          Edit Prompt
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Completed Image Player Preview */}
                  {imageGenState === 'COMPLETED' && generatedImage && (
                    <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Image ready
                        </span>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {generatedImage.style}
                        </span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-border bg-black/20 max-h-[300px] flex items-center justify-center">
                        <img
                          src={generatedImage.url}
                          alt={generatedImage.title}
                          className="w-full h-auto max-h-[300px] object-contain rounded-lg"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {generatedImage.title}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={handleGenerateAIImage}
                            className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                          >
                            Regenerate Image
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleSaveImageToContentLibrary}
                            className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                          >
                            <Save className="h-3.5 w-3.5" /> Save to Content Library
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* REFERENCED BRAND ASSETS GALLERY */}
                  {selectedBrandAssets.length > 0 && (
                    <div className="pt-3 border-t border-sky-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-sky-500" /> Referenced Brand Assets ({selectedBrandAssets.length})
                        </h5>
                        <span className="text-[10px] text-muted-foreground">Embedded as public references in prompt</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedBrandAssets.map((asset) => (
                          <div key={asset.id} className="flex items-start gap-2.5 p-2 rounded-xl border border-sky-500/20 bg-background/80 group">
                            <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              <img src={asset.public_url} alt={asset.name} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-foreground truncate">{asset.name}</span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">{asset.category}</Badge>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(asset.public_url);
                                      toast.success(`Copied public URL for ${asset.name}!`);
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10 transition-colors"
                                    title="Copy Public Asset URL"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-sky-600 dark:text-sky-400 font-medium line-clamp-1">{asset.usageInstruction}</p>
                              <p className="text-[9px] text-muted-foreground truncate font-mono">{asset.public_url}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Info className="h-3.5 w-3.5 text-sky-500" />
                      <span>Optimized for {selectedPlatforms[0] || 'Instagram'} aspect ratios</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const el = document.getElementById('marketing-image-prompt-input');
                          el?.focus();
                        }}
                        className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-border text-foreground hover:bg-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit Prompt
                      </Button>

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
                        className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Image Prompt
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 3: VIDEO GENERATION PROMPT & AI GENERATOR             */}
              {/* ========================================================== */}
              {activeResultTab === 'video_prompt' && (
                <div className="rounded-3xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                        <VideoIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          Video Generation Prompt & Engine
                          <span className="text-[10px] text-purple-600 font-black bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                            v{videoPromptVersion}
                          </span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Direct generation or copy into OpenAI Sora, Runway Gen-3, or Kling
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Video Style */}
                      <Select value={videoStyle} onValueChange={(val) => { if (val) setVideoStyle(val); }}>
                        <SelectTrigger className="h-7 text-xs rounded-lg border-border bg-background min-w-[130px]">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent searchable={true} searchPlaceholder="Search styles...">
                          {VIDEO_STYLES.map((st) => (
                            <SelectItem key={st} value={st}>
                              <span className="text-xs">{st}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Aspect Ratio */}
                      <Select value={videoAspectRatio} onValueChange={(val: any) => { if (val) setVideoAspectRatio(val); }}>
                        <SelectTrigger className="h-7 text-xs rounded-lg border-border bg-background min-w-[120px]">
                          <SelectValue placeholder="Ratio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 Landscape</SelectItem>
                          <SelectItem value="9:16">9:16 Reel / TikTok</SelectItem>
                          <SelectItem value="1:1">1:1 Square</SelectItem>
                          <SelectItem value="4:5">4:5 Portrait</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Duration */}
                      <Select value={videoDuration} onValueChange={(val: any) => { if (val) setVideoDuration(val); }}>
                        <SelectTrigger className="h-7 text-xs rounded-lg border-border bg-background min-w-[80px]">
                          <SelectValue placeholder="Duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5s">5s</SelectItem>
                          <SelectItem value="10s">10s</SelectItem>
                          <SelectItem value="15s">15s</SelectItem>
                          <SelectItem value="30s">30s</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Textarea
                    id="marketing-video-prompt-input"
                    rows={8}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Chronological action and time breakdown for video models..."
                    className="text-xs leading-relaxed rounded-2xl bg-background border-border font-mono p-3.5 resize-y focus:ring-2 focus:ring-purple-500/20"
                  />

                  {/* Generation Progress State Card */}
                  {['VALIDATING', 'SUBMITTING', 'GENERATING', 'PROCESSING'].includes(videoGenState) && (
                    <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 space-y-2.5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-2 text-purple-700 dark:text-purple-300">
                          <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
                          Generating your video... This may take a little while.
                        </span>
                        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-500/20 px-2 py-0.5 rounded-md">
                          {videoGenState}
                        </span>
                      </div>
                      <div className="w-full bg-purple-200/60 dark:bg-purple-950 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${videoGenProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Synthesizing prompt physics, motion trajectories, and visual lighting...
                      </p>
                    </div>
                  )}

                  {/* Error / Refusal Card */}
                  {videoGenState === 'FAILED' && videoGenError && (
                    <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                            Video generation couldn't be completed.
                          </h5>
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {videoGenError.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          type="button"
                          onClick={handleGenerateAIVideo}
                          className="h-8 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          Try Again
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const el = document.getElementById('marketing-video-prompt-input');
                            el?.focus();
                          }}
                          className="h-8 text-xs font-bold rounded-xl border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                        >
                          Edit Prompt
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Completed Video Player Preview */}
                  {videoGenState === 'COMPLETED' && generatedVideo && (
                    <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Video ready
                        </span>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {generatedVideo.duration} • {generatedVideo.aspectRatio}
                        </span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video max-h-[300px] flex items-center justify-center">
                        <video
                          src={generatedVideo.video_url}
                          poster={generatedVideo.thumbnail_url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {generatedVideo.title}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={handleGenerateAIVideo}
                            className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                          >
                            Regenerate Video
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleSaveVideoToContentLibrary}
                            className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                          >
                            <Save className="h-3.5 w-3.5" /> Save to Content Library
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* REFERENCED BRAND ASSETS GALLERY */}
                  {selectedBrandAssets.length > 0 && (
                    <div className="pt-3 border-t border-purple-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Referenced Brand Assets ({selectedBrandAssets.length})
                        </h5>
                        <span className="text-[10px] text-muted-foreground">Embedded as public references in prompt</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedBrandAssets.map((asset) => (
                          <div key={asset.id} className="flex items-start gap-2.5 p-2 rounded-xl border border-purple-500/20 bg-background/80 group">
                            <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              <img src={asset.public_url} alt={asset.name} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-foreground truncate">{asset.name}</span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">{asset.category}</Badge>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(asset.public_url);
                                      toast.success(`Copied public URL for ${asset.name}!`);
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10 transition-colors"
                                    title="Copy Public Asset URL"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium line-clamp-1">{asset.usageInstruction}</p>
                              <p className="text-[9px] text-muted-foreground truncate font-mono">{asset.public_url}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-purple-500" />
                      <span>Chronological 0–{videoDuration} sequence with hook, action & CTA</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const el = document.getElementById('marketing-video-prompt-input');
                          el?.focus();
                        }}
                        className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-border text-foreground hover:bg-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit Prompt
                      </Button>

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
                        className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
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

              {/* ========================================================== */}
              {/* TAB 5: RESEARCH SOURCES                                   */}
              {/* ========================================================== */}
              {activeResultTab === 'sources' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4 text-emerald-500" /> Real Web Research Sources
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Live authoritative publications and wire dispatches used to ground this content in real-time facts.
                      </p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold">
                      {researchSources.length} Verified Sources
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {researchSources.map((src) => (
                      <div
                        key={src.id}
                        className="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-xs flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-foreground uppercase tracking-wider bg-muted/60 px-2 py-0.5 rounded-md">
                              {src.source}
                            </span>
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              {src.relevanceScore}% Relevance
                            </Badge>
                          </div>
                          <h5 className="text-xs font-bold text-foreground line-clamp-2">{src.title}</h5>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{src.snippet}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-muted-foreground">
                          <span>{src.publishedDate}</span>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-bold flex items-center gap-1"
                          >
                            <span>View Article</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Add Pasted Text Attachment Modal */}
      {showAddTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Add Reference Document Text</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTextModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Document / Article Name (Optional)
                </label>
                <Input
                  placeholder="e.g. Nepal Flood Emergency Relief Brief 2026"
                  value={pastedDocTitle}
                  onChange={(e) => setPastedDocTitle(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Source Content / Facts / Notes <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  rows={8}
                  placeholder="Paste article, emergency brief, factsheet, product specs, or research notes..."
                  value={pastedDocContent}
                  onChange={(e) => setPastedDocContent(e.target.value)}
                  className="text-xs font-mono leading-relaxed rounded-xl resize-y"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddTextModal(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddPastedArticle}
                disabled={!pastedDocContent.trim()}
                className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5"
              >
                <FileCheck className="h-3.5 w-3.5" />
                Add Source of Truth
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Trace / Grounding Inspector Modal */}
      {showTraceModal && traceContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-purple-500/40 bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">AI Grounding & Pipeline Trace Inspector</h3>
                  <p className="text-[10px] text-muted-foreground">Development verification for context grounding & semantic relevance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTraceModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Grounding Status Card */}
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Grounding Confidence</span>
                  <span className="text-sm font-bold text-foreground">{traceContext.groundingConfidence}</span>
                </div>
                <Badge className={cn('text-xs font-bold', traceContext.relevancePassed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
                  {traceContext.relevanceScore}% Relevance
                </Badge>
              </div>

              {/* Live Web Research Report (Requirement 19 Debug Panel) */}
              {traceContext.webResearchReport && (
                <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Live Web Research Pipeline Active
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {traceContext.webResearchReport.sourcesSelected} of {traceContext.webResearchReport.sourcesFound} sources used
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground">Search Queries Generated:</span>
                    <div className="flex flex-wrap gap-1">
                      {traceContext.webResearchReport.searchQueries.map((q, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-mono">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground">Top Authoritative Sources Selected:</span>
                    <div className="flex flex-wrap gap-1">
                      {traceContext.webResearchReport.topSources.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Source Documents */}
              <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  {traceContext.hasWebResearch ? 'Live Researched Web Sources' : 'Attached Source Articles'} ({traceContext.attachedArticleNames.length})
                </span>
                {traceContext.attachedArticleNames.length > 0 ? (
                  <ul className="list-disc list-inside text-[11px] text-foreground font-medium space-y-0.5">
                    {traceContext.attachedArticleNames.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">No reference articles attached (Keyword-only fallback mode)</p>
                )}
              </div>

              {/* Extracted Topic & Entities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Extracted Core Subject</span>
                  <p className="font-semibold text-foreground text-[11px]">{traceContext.extractedTopic}</p>
                </div>

                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">SEO Keyword Constraint</span>
                  <p className="font-semibold text-foreground text-[11px]">{traceContext.primaryKeywordUsed || '(None)'}</p>
                </div>
              </div>

              {/* Key Facts Extracted */}
              {traceContext.keyFactsExtracted && traceContext.keyFactsExtracted.length > 0 && (
                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Extracted Numerical Facts & Protocols ({traceContext.keyFactsExtracted.length})</span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {traceContext.keyFactsExtracted.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Entities & Terminology */}
              <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Semantic Overlap Verification</span>
                <div className="flex flex-wrap gap-1">
                  {traceContext.matchedEntities.map((ent, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      ✓ {ent}
                    </span>
                  ))}
                  {traceContext.matchedTerminology.map((term, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-medium">
                      ✓ {term}
                    </span>
                  ))}
                </div>
              </div>

              {/* Regeneration Stats */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Self-Correction Regeneration Loops: <strong className="text-foreground">{traceContext.regenerationAttempts}</strong></span>
                <span>Final Output Title: <strong className="text-foreground">{traceContext.generatedTopic}</strong></span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button size="sm" onClick={() => setShowTraceModal(false)} className="h-8 text-xs rounded-xl">
                Close Trace
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

