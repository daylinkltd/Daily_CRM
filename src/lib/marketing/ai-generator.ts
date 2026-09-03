import { evaluateBlogSEO } from './seo-evaluator';

export interface BrandContext {
  businessName?: string;
  brandDescription?: string;
  website?: string;
  productsOrServices?: string;
  targetAudience?: string;
  brandVoice?: string;
  brandColors?: string;
  brandPositioning?: string;
  campaign?: string;
}

export interface StructuredIntent {
  rawInput: string;
  detectedTopic: string;
  detectedIntent: 'promotion' | 'announcement' | 'educational' | 'testimonial' | 'lead_gen' | 'general';
  detectedProduct?: string;
  detectedAudience?: string;
  detectedPlatforms?: string[];
  detectedTone?: 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';
  detectedGoal?: string;
  detectedObjective?: string;
}

export interface GenerateContentRequest {
  topic: string;
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  tone?: 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';
  objective?: string;
  campaignName?: string;
  productOrService?: string;
  websiteUrl?: string;
  preferredLanguage?: string;
  templateId?: string;
  brandVoice?: string;
  imageStyle?: string;
  videoStyle?: string;
  visualStyle?: string; // Backwards compatibility alias for imageStyle
  brandContext?: BrandContext;
  additionalCreativeInstructions?: string;
  regenTarget?: 'all' | 'hashtags_only' | 'caption_only' | 'image_prompt_only' | 'video_prompt_only' | 'blog_body_only' | 'creative_only';
  existingCaption?: string;
  existingTitle?: string;
  existingImagePrompt?: string;
  existingVideoPrompt?: string;
  existingHashtags?: string[];
  existingKeywords?: string[];
  existingCta?: string;
  imagePromptVersion?: number;
  videoPromptVersion?: number;
  uploadedMediaUrl?: string;
}

export interface PlatformSpecificContent {
  caption: string;
  hashtags: string[];
  cta: string;
  characterCount: number;
  formatNote: string;
  recommendedImageRatio: string;
  recommendedVideoRatio: string;
}

export interface GeneratedSocialPost {
  generation_id: string;
  title: string;
  hook: string;
  caption: string;
  short_description: string;
  shortCaption: string;
  body: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
  image_prompt: string;
  video_prompt: string;
  image_prompt_version: number;
  video_prompt_version: number;
  platform: string;
  content_type: string;
  target_audience: string;
  campaign: string;
  objective: string;
  suggestedPlatforms: string[];
  targetAudience: string;
  contentObjective: string;
  suggestedPostingTime: {
    time: string;
    dayOfWeek: string;
    reason: string;
  };
  contentCategory: string;
  image_concept: string;
  image_alt_text: string;
  image_url?: string;
  creativeSuggestion: {
    description: string;
    imageStyle: string;
    videoStyle: string;
    visualStyle: string;
    aspectRatio: string;
    suggestedColorPalette: string[];
  };
  trendingAngle: {
    headline: string;
    context: string;
    isLiveDataSource: boolean;
  };
  platform_specific: Record<string, PlatformSpecificContent>;
  platformNotes: Record<string, string>;
}

export interface GeneratedBlogPost {
  generation_id: string;
  title: string;
  slug: string;
  excerpt: string;
  headings: Array<{ level: number; text: string }>;
  content: string;
  faqSchema: Array<{ question: string; answer: string }>;
  seoTitle: string;
  seoDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  category: string;
  tags: string[];
  imageAltText: string;
  image_concept: string;
  image_prompt: string;
  video_prompt: string;
  image_prompt_version: number;
  video_prompt_version: number;
  image_url?: string;
  socialSharingTitle: string;
  socialSharingDescription: string;
  estimatedReadTime: number;
  seoReadiness: ReturnType<typeof evaluateBlogSEO>;
}

export interface ContentGenerationResult {
  success: boolean;
  generation_id: string;
  mode: 'social' | 'blog';
  structured_intent: StructuredIntent;
  social?: GeneratedSocialPost;
  blog?: GeneratedBlogPost;
  enrichment: {
    topicKeywords: string[];
    industryKeywords: string[];
    trendingAngle: string;
    brandKeywords: string[];
  };
  providerUsed: string;
}

// 1. Natural Language Intent Parser
export function parseNaturalLanguageIntent(input: string): StructuredIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Detect platforms mentioned in natural language
  const detectedPlatforms: string[] = [];
  if (lower.includes('instagram') || lower.includes('insta')) detectedPlatforms.push('instagram');
  if (lower.includes('linkedin')) detectedPlatforms.push('linkedin');
  if (lower.includes('twitter') || lower.includes(' x ') || lower.endsWith(' x') || lower.startsWith('x ')) detectedPlatforms.push('x');
  if (lower.includes('facebook') || lower.includes('fb')) detectedPlatforms.push('facebook');
  if (lower.includes('tiktok')) detectedPlatforms.push('tiktok');
  if (lower.includes('youtube')) detectedPlatforms.push('youtube');
  if (lower.includes('threads')) detectedPlatforms.push('threads');

  // Detect Intent & Objective
  let detectedIntent: StructuredIntent['detectedIntent'] = 'general';
  let detectedObjective = 'Brand awareness & product adoption';

  if (lower.includes('lead') || lower.includes('demo') || lower.includes('inbound') || lower.includes('trial') || lower.includes('sign up')) {
    detectedIntent = 'lead_gen';
    detectedObjective = 'Lead generation';
  } else if (lower.includes('promot') || lower.includes('offer') || lower.includes('discount') || lower.includes('sale') || lower.includes('launch')) {
    detectedIntent = 'promotion';
    detectedObjective = 'Promotion & sales conversion';
  } else if (lower.includes('announce') || lower.includes('update') || lower.includes('release') || lower.includes('new feature')) {
    detectedIntent = 'announcement';
    detectedObjective = 'Product update & feature announcement';
  } else if (lower.includes('how to') || lower.includes('guide') || lower.includes('tutorial') || lower.includes('tips') || lower.includes('learn')) {
    detectedIntent = 'educational';
    detectedObjective = 'Customer education & thought leadership';
  } else if (lower.includes('story') || lower.includes('customer') || lower.includes('testimonial') || lower.includes('case study')) {
    detectedIntent = 'testimonial';
    detectedObjective = 'Social proof & customer success storytelling';
  }

  // Detect Audience
  let detectedAudience = 'Business owners, founders, and modern growth teams';
  if (lower.includes('small business') || lower.includes('smb') || lower.includes('retail') || lower.includes('shop')) {
    detectedAudience = 'Small business owners, retailers, and entrepreneurs';
  } else if (lower.includes('hr') || lower.includes('recruiter') || lower.includes('people ops') || lower.includes('talent')) {
    detectedAudience = 'HR managers, People Operations, and talent leaders';
  } else if (lower.includes('sales') || lower.includes('pipeline') || lower.includes('account executive') || lower.includes('b2b')) {
    detectedAudience = 'Sales leaders, account executives, and B2B growth managers';
  } else if (lower.includes('finance') || lower.includes('accountant') || lower.includes('cfo') || lower.includes('billing')) {
    detectedAudience = 'Finance teams, accountants, and CFOs';
  }

  // Detect Product/Service
  let detectedProduct = 'DailyBuz Business Workspace';
  if (lower.includes('crm') || lower.includes('customer conversation') || lower.includes('pipeline')) {
    detectedProduct = 'DailyBuz CRM';
  } else if (lower.includes('attendance') || lower.includes('payroll') || lower.includes('timesheet')) {
    detectedProduct = 'DailyBuz HR & Attendance Engine';
  } else if (lower.includes('invoice') || lower.includes('gst') || lower.includes('billing') || lower.includes('tax')) {
    detectedProduct = 'DailyBuz Automated Invoicing & GST';
  } else if (lower.includes('whatsapp') || lower.includes('broadcast') || lower.includes('chat') || lower.includes('omnichannel')) {
    detectedProduct = 'DailyBuz WhatsApp Hub';
  }

  // Detect Tone
  let detectedTone: StructuredIntent['detectedTone'] = 'engaging';
  if (lower.includes('professional') || lower.includes('formal') || lower.includes('executive') || lower.includes('corporate')) {
    detectedTone = 'professional';
  } else if (lower.includes('short') || lower.includes('concise') || lower.includes('quick')) {
    detectedTone = 'concise';
  } else if (lower.includes('educational') || lower.includes('informative')) {
    detectedTone = 'educational';
  } else if (lower.includes('creative') || lower.includes('inspiring') || lower.includes('story')) {
    detectedTone = 'creative';
  }

  return {
    rawInput: text,
    detectedTopic: text,
    detectedIntent,
    detectedProduct,
    detectedAudience,
    detectedPlatforms: detectedPlatforms.length > 0 ? detectedPlatforms : undefined,
    detectedTone,
    detectedGoal: detectedObjective,
    detectedObjective,
  };
}

// Key term extraction
function extractKeyTerms(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'our', 'your', 'about', 'want', 'post', 'create', 'make',
    'promoting', 'promote', 'write', 'generate', 'dailybuz', 'dailycrm',
  ]);

  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  return Array.from(new Set(words));
}

function detectIndustryDomain(topic: string): { domain: string; keywords: string[]; hashtags: string[] } {
  const t = topic.toLowerCase();
  if (t.includes('crm') || t.includes('lead') || t.includes('pipeline') || t.includes('sales') || t.includes('customer conversation')) {
    return {
      domain: 'Customer Relationship Management & Sales Acceleration',
      keywords: ['customer conversations', 'sales pipeline', 'lead conversion', 'omnichannel messaging', 'deal velocity', 'crm automation', 'customer retention'],
      hashtags: ['#CRMSoftware', '#SalesGrowth', '#LeadGen', '#B2BSales', '#CustomerSuccess', '#SalesPipeline'],
    };
  }
  if (t.includes('hr') || t.includes('attendance') || t.includes('payroll') || t.includes('employee')) {
    return {
      domain: 'Human Resources & Workforce Management',
      keywords: ['payroll automation', 'attendance tracking', 'employee engagement', 'talent retention', 'hrtech', 'biometric sync'],
      hashtags: ['#HRTech', '#WorkforceManagement', '#PayrollSolutions', '#EmployeeEngagement', '#FutureOfWork'],
    };
  }
  if (t.includes('invoice') || t.includes('gst') || t.includes('finance') || t.includes('tax') || t.includes('accounting') || t.includes('billing')) {
    return {
      domain: 'Accounting, Billing & GST Compliance',
      keywords: ['e-invoicing', 'gst compliance', 'cash flow management', 'automated billing', 'reconciliation', 'tax filing'],
      hashtags: ['#GSTCompliance', '#AccountingSoftware', '#BusinessFinance', '#SmartBilling', '#CashFlow'],
    };
  }
  if (t.includes('whatsapp') || t.includes('chat') || t.includes('broadcast') || t.includes('support')) {
    return {
      domain: 'Omnichannel Messaging & WhatsApp Commerce',
      keywords: ['whatsapp marketing', 'broadcast automation', 'customer support', 'instant messaging', 'chat commerce', 'lead nurturing'],
      hashtags: ['#WhatsAppMarketing', '#CustomerEngagement', '#Omnichannel', '#ChatCommerce', '#SupportTech'],
    };
  }

  return {
    domain: 'Business Productivity & SaaS Operations',
    keywords: ['business automation', 'workflow optimization', 'digital transformation', 'team efficiency', 'growth strategy', 'unified workspace'],
    hashtags: ['#BusinessAutomation', '#ProductivityHacks', '#SMBGrowth', '#OperationsExcellence', '#SaaSGrowth'],
  };
}

// Helper to determine platform-specific aspect ratio guidelines
function getPlatformAspectGuidelines(platform: string): {
  imageRatio: string;
  videoRatio: string;
  imageRecommendation: string;
  videoRecommendation: string;
} {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return {
        imageRatio: '1:1 (Square) or 4:5 (Vertical Portrait)',
        videoRatio: '9:16 (Vertical Reels/Stories)',
        imageRecommendation: 'Square 1:1 or 4:5 vertical composition optimized for Instagram mobile feed, strong visual focal point, uncluttered borders for thumb-stopping clarity',
        videoRecommendation: 'Vertical 9:16 full-screen framing for Instagram Reels, high-impact motion hook in first 2 seconds, safe zone margins top and bottom',
      };
    case 'linkedin':
      return {
        imageRatio: '1.91:1 (Landscape) or 16:9',
        videoRatio: '16:9 (Landscape) or 1:1',
        imageRecommendation: 'Landscape 1.91:1 or 16:9 composition tailored for LinkedIn professional desktop and mobile feeds, authoritative corporate visual hierarchy',
        videoRecommendation: 'Landscape 16:9 or 1:1 format optimized for professional timeline feeds with crisp text clarity and steady executive pacing',
      };
    case 'facebook':
      return {
        imageRatio: '1.91:1 (Landscape) or 1:1 (Square)',
        videoRatio: '16:9 or 9:16',
        imageRecommendation: 'Feed-friendly 1.91:1 or 1:1 composition with clear product value demonstration and balanced visual breathing room',
        videoRecommendation: 'Dynamic social video formatted for Facebook feed or Reels with immediate visual clarity and readable value proposition',
      };
    case 'x':
      return {
        imageRatio: '16:9 (Landscape)',
        videoRatio: '16:9 or 1:1',
        imageRecommendation: 'Landscape 16:9 high-contrast visual with a strong single conceptual subject, minimal background clutter, and instant timeline readability',
        videoRecommendation: 'Fast-paced 16:9 or 1:1 video with snappy visual cuts and clear messaging designed for rapid X timeline scrolling',
      };
    case 'tiktok':
      return {
        imageRatio: '9:16 (Vertical)',
        videoRatio: '9:16 (Vertical Fullscreen)',
        imageRecommendation: 'Vertical 9:16 full-screen composition with bold mobile-first framing and vibrant subject placement',
        videoRecommendation: 'Vertical 9:16 mobile-native framing, high-energy opening sequence, dynamic motion transitions, perfectly centered action safe from UI overlays',
      };
    case 'youtube':
      return {
        imageRatio: '16:9 (Thumbnail / Community Post)',
        videoRatio: '16:9 (Standard) or 9:16 (Shorts)',
        imageRecommendation: 'Landscape 16:9 high-impact composition with dramatic lighting, bold contrast, and crisp focal hierarchy',
        videoRecommendation: 'Widescreen 16:9 cinematic framing (or 9:16 for YouTube Shorts) with smooth professional camera movement, high production value, and engaging pacing',
      };
    case 'threads':
      return {
        imageRatio: '1:1 (Square) or 4:5',
        videoRatio: '9:16 or 1:1',
        imageRecommendation: 'Clean conversational 1:1 or 4:5 composition, mobile-first design with modern typography-friendly negative space',
        videoRecommendation: 'Mobile-friendly 9:16 or 1:1 video with clean visual storytelling and seamless looping potential',
      };
    default:
      return {
        imageRatio: '1:1 (Square) or 16:9',
        videoRatio: '16:9 or 9:16',
        imageRecommendation: 'Balanced modern composition with clean visual hierarchy and generous negative space',
        videoRecommendation: 'High-definition video with clean motion dynamics and structured sequential progression',
      };
  }
}

// 2. Production-Ready Detailed Image Prompt Builder
export const buildImagePrompt = buildDetailedImagePrompt;
export function buildDetailedImagePrompt(params: {
  topic: string;
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  campaignName?: string;
  productOrService?: string;
  objective?: string;
  imageStyle?: string;
  visualStyle?: string;
  brandContext?: BrandContext;
  additionalInstructions?: string;
}): string {
  const {
    topic,
    platforms = ['instagram'],
    targetAudience = 'Small business owners and growth teams',
    campaignName,
    productOrService,
    objective = 'Lead generation and product adoption',
    imageStyle,
    visualStyle,
    brandContext,
    additionalInstructions,
  } = params;

  const activeStyle = imageStyle || visualStyle || 'Minimal SaaS';
  const primaryPlatform = platforms[0] || 'instagram';
  const platformSpecs = getPlatformAspectGuidelines(primaryPlatform);
  const domainInfo = detectIndustryDomain(topic);

  const brandName = brandContext?.businessName || (productOrService ? productOrService.split(' ')[0] : 'Modern SaaS Brand');
  const brandVoice = brandContext?.brandVoice || 'Clean, premium, modern, and trustworthy';
  const brandColors = brandContext?.brandColors || 'Subtle royal blue, deep slate, and clean white accents';

  // Style-specific photographic/artistic rendering directives
  let styleDetails = '';
  switch (activeStyle) {
    case 'Product Photography':
      styleDetails = 'Commercial product photography style, macro depth of field with razor-sharp subject focus, soft daylight illumination, tactile surfaces, premium matte textures, and subtle reflections';
      break;
    case 'Cinematic':
      styleDetails = 'Cinematic film aesthetic, 35mm anamorphic lens framing, atmospheric depth, soft volumetric rim lighting, subtle color grading with warm highlights and cool shadows, cinematic contrast';
      break;
    case '3D':
      styleDetails = 'Polished 3D isometric CGI rendering, smooth clay and frosted glass materials, soft ambient occlusion, subtle neon backlighting, floating modular UI badges with subsurface scattering';
      break;
    case 'Editorial':
      styleDetails = 'High-end editorial magazine photography style, curated minimalist styling, dramatic elegant lighting with balanced soft shadows, sophisticated composition, premium art direction';
      break;
    case 'Lifestyle':
      styleDetails = 'Authentic commercial lifestyle photography, candid natural posture, modern sunlit collaborative workspace environment, warm organic lighting, real human emotion and relatable engagement';
      break;
    case 'Illustration':
      styleDetails = 'Refined modern vector illustration, sophisticated flat design with subtle grain textures, curated harmonious palette, elegant geometric curves, sleek isometric elements';
      break;
    case 'Premium Commercial':
      styleDetails = 'High-budget commercial advertising visual, ultra-clean studio lighting, polished visual hierarchy, crisp architectural backdrop, bold focal presentation';
      break;
    case 'Abstract':
      styleDetails = 'Sophisticated abstract conceptual visualization, fluid geometric gradient ribbons, glassmorphic refraction layers, dynamic energy flows, high-contrast futuristic tech aesthetic';
      break;
    case 'Minimal SaaS':
    default:
      styleDetails = 'Ultra-clean modern SaaS marketing visual, sleek floating interface cards with glassmorphic layers, organized customer conversation pipelines, crisp typography containers, soft studio lighting';
      break;
  }

  // Construct structured, production-ready image generation prompt
  const promptLines: string[] = [
    `Create a premium ${activeStyle.toLowerCase()} visual asset for ${primaryPlatform.toUpperCase()} promoting "${topic}".`,
    `Subject & Marketing Concept: Visual representation of ${productOrService || brandName} solving customer challenges in ${domainInfo.domain}. The visual must clearly communicate the marketing objective: "${objective}" targeted at ${targetAudience}.`,
    `Scene & Environment: Modern professional setting featuring an organized workspace, clean laptop/screen interface displaying unified conversation streams, customer interaction timelines, and real-time activity indicators.`,
    `Composition & Perspective: ${platformSpecs.imageRecommendation}. Camera positioned at an eye-level three-quarters angle with strong visual hierarchy leading the eye toward the central value proposition.`,
    `Lighting & Palette: ${styleDetails}. Color direction incorporates ${brandColors} reflecting a brand mood that is ${brandVoice}.`,
    `Layout & Negative Space: Generous clean negative space in the upper and lower thirds for optional headline or badge placement without obstructing the core visual subject.`,
    `Negative Prompts (Things to avoid): No visible competitor logos, no distorted or unreadable text, no misspelled words, no messy or cluttered backgrounds, no watermarks, no unnatural extra limbs or artifacts, no oversaturated color clipping.`,
  ];

  if (campaignName && campaignName.trim()) {
    promptLines.push(`Campaign Theme: Aligned with the "${campaignName.trim()}" initiative.`);
  }

  if (additionalInstructions && additionalInstructions.trim()) {
    promptLines.push(`Custom Creative Directives: ${additionalInstructions.trim()}`);
  }

  return promptLines.join(' ');
}

// 3. Production-Ready Detailed Video Prompt Builder
export function buildDetailedVideoPrompt(params: {
  topic: string;
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  campaignName?: string;
  productOrService?: string;
  objective?: string;
  videoStyle?: string;
  brandContext?: BrandContext;
  additionalInstructions?: string;
}): string {
  const {
    topic,
    platforms = ['instagram'],
    targetAudience = 'Small business owners and growth teams',
    campaignName,
    productOrService,
    objective = 'Lead generation and product adoption',
    videoStyle = 'SaaS Commercial',
    brandContext,
    additionalInstructions,
  } = params;

  const primaryPlatform = platforms[0] || 'instagram';
  const platformSpecs = getPlatformAspectGuidelines(primaryPlatform);
  const domainInfo = detectIndustryDomain(topic);

  const brandName = brandContext?.businessName || (productOrService ? productOrService.split(' ')[0] : 'Modern SaaS Platform');
  const brandColors = brandContext?.brandColors || 'Subtle royal blue, modern slate, and white accents';

  // Style descriptions for video motion
  let motionStyleDesc = 'Smooth dynamic camera push-in, fast-paced modern SaaS motion graphics, polished UI component reveals, and high-energy transitions';
  switch (videoStyle) {
    case 'Cinematic':
      motionStyleDesc = 'Cinematic 24fps film motion, smooth gimbal tracking shots, shallow depth of field, atmospheric soft lighting, elegant slow-motion micro-interactions';
      break;
    case 'Product Demo':
      motionStyleDesc = 'Crisp UI workflow walkthrough, seamless zoom-ins on key features, responsive click animations, fluid data card transitions, and clean screen recordings';
      break;
    case 'UGC-style':
      motionStyleDesc = 'Authentic mobile handheld camera feel, relatable direct-to-camera creator framing, dynamic jump cuts, realistic lighting, and organic everyday business setting';
      break;
    case 'Storytelling':
      motionStyleDesc = 'Narrative-driven visual arc showing a business owner transition from frustration to total clarity and success, character-centered framing with emotional contrast';
      break;
    case 'Explainer':
      motionStyleDesc = 'Clear animated infographic motion, 2.5D isometric diagrams assembling themselves, clean icon pop-ins, and structured step-by-step visual logic';
      break;
    case 'Fast-paced Social':
      motionStyleDesc = 'Punchy 0.5s rhythmic cuts, kinetic typography pulses, high-contrast dynamic zoom transitions, and thumb-stopping visual momentum';
      break;
    case 'Minimal Premium':
      motionStyleDesc = 'Sophisticated minimal movement, slow continuous floating camera drift, elegant lighting passes, pristine negative space, and refined luxury tech aesthetic';
      break;
  }

  // Construct structured, production-ready video generation prompt with chronological action sequence
  const videoLines: string[] = [
    `Create a 10-second ${videoStyle.toLowerCase()} marketing video for ${primaryPlatform.toUpperCase()} (${platformSpecs.videoRatio}).`,
    `Concept & Objective: Communicate how "${topic}" delivers "${objective}" for ${targetAudience} using ${productOrService || brandName}.`,
    `Visual Arc & Chronological Action Sequence:`,
    `• 0–2 sec [Opening Hook]: Start on a fast visual hook showing the relatable core problem — a busy business owner overwhelmed by fragmented tabs, scattered spreadsheets, and missed messages.`,
    `• 2–5 sec [Scene & Main Action]: Dynamic camera pushes smoothly forward as the chaotic screen transforms into a clean, unified workspace with organized customer conversation pipelines and automated workflows.`,
    `• 5–8 sec [Product / Value Demonstration]: Feature in action — interaction cards smoothly organize, messages dispatch automatically, and key pipeline metrics light up showing real-time growth and clarity.`,
    `• 8–10 sec [Ending / CTA Visual]: Camera pulls back to reveal the peaceful, high-throughput workspace. Clean visual focal point with ${brandName} branding and generous clean space for the CTA banner.`,
    `Camera Movement & Transitions: ${motionStyleDesc}. Smooth match-cuts and seamless interface component animations.`,
    `Lighting, Environment & Palette: Bright modern professional office environment, soft cinematic key lighting, incorporating ${brandColors}.`,
    `Negative Prompts (Things to avoid): Avoid competitor branding, distorted or illegible UI text, jerky unnatural camera shaking, abrupt jump cuts, watermarks, flickering frames, and visual clutter.`,
  ];

  if (campaignName && campaignName.trim()) {
    videoLines.push(`Campaign Context: Aligned with "${campaignName.trim()}".`);
  }

  if (additionalInstructions && additionalInstructions.trim()) {
    videoLines.push(`Custom Directives: ${additionalInstructions.trim()}`);
  }

  return videoLines.join(' ');
}

// 4. Main Generation Function
export async function generateMarketingContent(
  req: GenerateContentRequest
): Promise<ContentGenerationResult> {
  const rawInput = req.topic?.trim() || 'Modern Business Automation and Customer Management';
  const intent = parseNaturalLanguageIntent(rawInput);
  const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const topic = rawInput;
  const tone = req.tone || intent.detectedTone || 'engaging';
  const isBlog = req.contentType === 'blog';
  const platformList = req.platforms && req.platforms.length > 0
    ? req.platforms
    : (intent.detectedPlatforms || ['instagram', 'linkedin', 'x']);

  const objective = req.objective || intent.detectedObjective || 'Lead generation and brand awareness';
  const targetAudience = req.targetAudience || intent.detectedAudience || 'Small business owners, founders, and modern growth teams';
  const campaignName = req.campaignName || req.brandContext?.campaign || '';
  const productOrService = req.productOrService || req.brandContext?.productsOrServices || intent.detectedProduct || 'DailyBuz CRM';

  const imageStyle = req.imageStyle || req.visualStyle || 'Minimal SaaS';
  const videoStyle = req.videoStyle || 'SaaS Commercial';

  const topicKeywords = extractKeyTerms(topic);
  const domainInfo = detectIndustryDomain(topic);

  // Brand context integration
  const brandName = req.brandContext?.businessName || (productOrService ? productOrService.split(' ')[0] : 'DailyBuz');

  // Handle regeneration target modes
  const isImagePromptOnly = req.regenTarget === 'image_prompt_only';
  const isVideoPromptOnly = req.regenTarget === 'video_prompt_only';
  const isHashtagsOnly = req.regenTarget === 'hashtags_only';
  const isCaptionOnly = req.regenTarget === 'caption_only';

  const imagePromptVersion = (req.imagePromptVersion || 1) + (isImagePromptOnly ? 1 : 0);
  const videoPromptVersion = (req.videoPromptVersion || 1) + (isVideoPromptOnly ? 1 : 0);

  // Synthesize rich prompts
  const generatedImagePrompt = (isVideoPromptOnly || isHashtagsOnly || isCaptionOnly) && req.existingImagePrompt
    ? req.existingImagePrompt
    : buildDetailedImagePrompt({
        topic,
        contentType: req.contentType,
        platforms: platformList,
        targetAudience,
        campaignName,
        productOrService,
        objective,
        imageStyle,
        visualStyle: req.visualStyle,
        brandContext: req.brandContext,
        additionalInstructions: req.additionalCreativeInstructions,
      });

  const generatedVideoPrompt = (isImagePromptOnly || isHashtagsOnly || isCaptionOnly) && req.existingVideoPrompt
    ? req.existingVideoPrompt
    : buildDetailedVideoPrompt({
        topic,
        contentType: req.contentType,
        platforms: platformList,
        targetAudience,
        campaignName,
        productOrService,
        objective,
        videoStyle,
        brandContext: req.brandContext,
        additionalInstructions: req.additionalCreativeInstructions,
      });

  const imageConcept = `A high-impact ${imageStyle} visual showcasing ${productOrService} solving "${topic}" for ${targetAudience}.`;
  const imageAltText = `${imageStyle} marketing visual for "${topic}" - ${targetAudience} focus`;

  // Keywords & Hashtags synthesis
  const combinedKeywords = req.existingKeywords && isImagePromptOnly
    ? req.existingKeywords
    : Array.from(new Set([...topicKeywords, ...domainInfo.keywords.slice(0, 4)]));

  const brandHashtag = `#${brandName.replace(/[^a-zA-Z0-9]/g, '')}`;
  const combinedHashtags = req.existingHashtags && isImagePromptOnly
    ? req.existingHashtags
    : Array.from(new Set([brandHashtag, ...domainInfo.hashtags, ...topicKeywords.map((k) => `#${k.charAt(0).toUpperCase() + k.slice(1)}`)]));

  const trendingAngleHeadline = `How High-Growth Teams Are Scaling ${topicKeywords[0] || 'Operations'} with ${productOrService}`;
  const trendingContext = `Organizations modernizing customer touchpoints with ${productOrService} report up to 45% faster response times and higher pipeline throughput.`;

  // Only retain user-uploaded media (NO fake AI images)
  const finalUploadedMediaUrl = req.uploadedMediaUrl || undefined;

  // BLOG MODE
  if (isBlog) {
    const primaryKw = combinedKeywords[0] || topic;
    const secKeywords = combinedKeywords.slice(1, 5);
    const blogTitle = req.existingTitle || (
      topic.length < 50
        ? `The Ultimate Guide to ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
        : `How to Streamline ${domainInfo.domain} with ${productOrService}`
    );

    const slug = blogTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);

    const seoTitle = `${blogTitle} | ${brandName} Growth Guide`;
    const seoDescription = `Learn actionable frameworks to master ${primaryKw} with ${productOrService}. Scale your ${domainInfo.domain.toLowerCase()} with proven automation strategies.`;

    const headings = [
      { level: 2, text: `1. Understanding the Core Challenges in ${domainInfo.domain}` },
      { level: 2, text: `2. Strategic Framework: Modernizing Your Operations` },
      { level: 3, text: `Key Operational Bottlenecks & How to Overcome Them` },
      { level: 2, text: `3. Step-by-Step Implementation with ${productOrService}` },
      { level: 3, text: `Phase 1: Centralizing Customer Touchpoints` },
      { level: 3, text: `Phase 2: Automating Follow-Ups & Pipeline Velocity` },
      { level: 2, text: `4. Measurable Business Outcomes & ROI Benchmarks` },
      { level: 2, text: `5. Frequently Asked Questions` },
    ];

    const faqSchema = [
      {
        question: `Why is optimizing ${primaryKw} crucial for growing businesses?`,
        answer: `Centralized operations allow teams to respond to customer inquiries faster, eliminate duplicate data entry, and maintain end-to-end visibility across sales and service funnels.`,
      },
      {
        question: `What is the fastest way to get started with ${domainInfo.domain}?`,
        answer: `Start by auditing existing communication channels and integrating them into a unified workspace with automated triggers and standardized templates.`,
      },
      {
        question: `How does ${productOrService} improve team productivity?`,
        answer: `By unifying conversations, pipeline stages, and invoicing into one interface, teams eliminate context switching and reduce response latency by up to 45%.`,
      },
    ];

    const bodyContent = [
      `In today's competitive landscape, managing **${topic}** requires a strategic approach that blends unified tools with real-time operational execution. Fragmented systems lead to communication drop-offs and lost opportunities.`,
      ``,
      `## 1. Understanding the Core Challenges in ${domainInfo.domain}`,
      `Many organizations still struggle with disconnected data silos. When sales, operations, and support teams work in isolation, customer inquiries sit unanswered and overhead skyrockets. Implementing a cohesive strategy around **${primaryKw}** ensures every touchpoint is tracked and actioned promptly.`,
      ``,
      `## 2. Strategic Framework: Modernizing Your Operations`,
      `To build a scalable operating model, consider these foundational pillars:`,
      `- **Unified Communication**: Bring all incoming messages, leads, and orders into a single collaborative queue.`,
      `- **Automated Pipelines**: Trigger status updates and notification reminders automatically without manual intervention.`,
      `- **Data-Driven Decision Making**: Track conversion velocity and team throughput across clear visual dashboards.`,
      ``,
      `### Key Operational Bottlenecks & How to Overcome Them`,
      `The most common hurdle is tool fatigue. By unifying customer conversations, automated broadcasts, and financial invoicing into one intuitive interface, teams reduce response latency by up to 45%.`,
      ``,
      `## 3. Step-by-Step Implementation with ${productOrService}`,
      `### Phase 1: Centralizing Customer Touchpoints`,
      `Begin by mapping your customer touchpoints. Identify where manual data entry causes friction and connect your primary channels to a shared workspace.`,
      ``,
      `### Phase 2: Automating Follow-Ups & Pipeline Velocity`,
      `Deploy verified templates and automated triggers for high-frequency workflows like follow-up reminders, order confirmations, and status updates.`,
      ``,
      `## 4. Measurable Business Outcomes & ROI Benchmarks`,
      `Organizations adopting unified workflows for **${primaryKw}** consistently report:`,
      `- 35%+ increase in deal closing velocity`,
      `- 50% reduction in time spent on administrative data entry`,
      `- Higher customer satisfaction scores due to instant response times`,
      ``,
      `## 5. Frequently Asked Questions`,
      `**Q: Why is optimizing ${primaryKw} crucial for growing businesses?**`,
      `A: Centralized operations allow teams to respond to customer inquiries faster and maintain end-to-end visibility across sales funnels.`,
      ``,
      `**Q: How does real-time analytics improve performance?**`,
      `A: Real-time analytics provide clear visibility into conversion rates and team capacity so leadership can make data-backed adjustments quickly.`,
      ``,
      `---`,
      `*Ready to elevate your team's workflow? Discover how ${productOrService} simplifies business operations with unified tools.*`,
    ].join('\n');

    const seoReadiness = evaluateBlogSEO({
      title: blogTitle,
      seoTitle,
      seoDescription,
      slug,
      content: bodyContent,
      primaryKeyword: primaryKw,
      secondaryKeywords: secKeywords,
      featuredImage: finalUploadedMediaUrl,
      altText: imageAltText,
      headings,
      faqSchema,
    });

    return {
      success: true,
      generation_id: generationId,
      mode: 'blog',
      structured_intent: intent,
      blog: {
        generation_id: generationId,
        title: blogTitle,
        slug,
        excerpt: seoDescription,
        headings,
        content: bodyContent,
        faqSchema,
        seoTitle,
        seoDescription,
        primaryKeyword: primaryKw,
        secondaryKeywords: secKeywords,
        category: domainInfo.domain.split('&')[0].trim(),
        tags: [primaryKw, ...secKeywords, 'Business Growth', 'Automation'],
        imageAltText,
        image_concept: imageConcept,
        image_prompt: generatedImagePrompt,
        video_prompt: generatedVideoPrompt,
        image_prompt_version: imagePromptVersion,
        video_prompt_version: videoPromptVersion,
        image_url: finalUploadedMediaUrl,
        socialSharingTitle: blogTitle,
        socialSharingDescription: seoDescription,
        estimatedReadTime: Math.ceil(bodyContent.split(/\s+/).length / 200),
        seoReadiness,
      },
      enrichment: {
        topicKeywords,
        industryKeywords: domainInfo.keywords,
        trendingAngle: trendingAngleHeadline,
        brandKeywords: [brandName, 'Business OS', 'Unified Workspace'],
      },
      providerUsed: 'DailyBuz Multi-Tenant Creative Context Engine',
    };
  }

  // SOCIAL MODE
  const postTitle = req.existingTitle || (
    topic.length < 45
      ? topic.charAt(0).toUpperCase() + topic.slice(1)
      : `Mastering ${domainInfo.domain} with ${productOrService}`
  );

  let hook = '';
  let body = '';
  let caption = '';

  if (req.existingCaption && (isImagePromptOnly || isVideoPromptOnly || isHashtagsOnly)) {
    caption = req.existingCaption;
    hook = req.existingCaption.split('\n')[0] || '';
    body = req.existingCaption;
  } else {
    if (tone === 'professional') {
      hook = `Scaling modern ${domainInfo.domain.toLowerCase()} requires eliminating friction across every customer touchpoint.`;
      body = [
        `When managing ${topic}, disconnected point tools create bottlenecks that delay deals and cost valuable time. By centralizing conversations, sales pipelines, and follow-ups into ${productOrService}, high-performing teams accelerate closing velocity and maintain complete operational visibility.`,
        ``,
        `Key operational advantages:`,
        `🔹 Real-time customer conversation history in one workspace`,
        `🔹 Automated follow-up sequences and verified message templates`,
        `🔹 Transparent deal tracking from initial contact to close`,
      ].join('\n');
      caption = [hook, ``, body, ``, `How is your organization streamlining ${domainInfo.domain.toLowerCase()} this quarter?`].join('\n');
    } else if (tone === 'concise') {
      hook = `Stop juggling disconnected tabs for ${topic}. ⚡`;
      body = `Bring your conversations, sales pipelines, and team automations into ${productOrService}. Built for fast-growing teams that value speed and simplicity.`;
      caption = [hook, ``, body, ``, `Start streamlining your workflow today! 🚀`].join('\n');
    } else {
      hook = `Still dealing with communication drop-offs and scattered spreadsheets for ${topic}? 🤯`;
      body = [
        `There is a simpler, faster way to operate! When your customer conversations, automated messaging, and pipeline stages live together in ${productOrService}, your team saves hours every week.`,
        ``,
        `✨ Why modern teams make the switch:`,
        `• Instant multi-channel response tracking`,
        `• Smart automated reminders & follow-ups`,
        `• Complete visibility over every active deal`,
      ].join('\n');
      caption = [hook, ``, body, ``, `👉 Ready to upgrade your customer workflow? Tap the link or drop a comment to get started!`].join('\n');
    }
  }

  const short_description = `Streamline ${topic} and boost team velocity with ${productOrService}.`;
  const shortCaption = `Unify ${topic} with ${productOrService}. Try it free today! 🚀`;
  const cta = req.existingCta || (
    req.websiteUrl || req.brandContext?.website
      ? `Click here to get started: ${req.websiteUrl || req.brandContext?.website}`
      : `Tap the link to start your free trial or book a live walkthrough!`
  );

  // Platform-Specific Copy Variants
  const platform_specific: Record<string, PlatformSpecificContent> = {
    instagram: {
      caption: [
        hook,
        ``,
        `Here is how top teams simplify ${topic}:`,
        `👉 Instant pipeline updates`,
        `👉 Zero manual data entry`,
        `👉 Centralized WhatsApp & customer chats`,
        ``,
        `Tap the link in bio to test ${productOrService} free! ✨`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 8),
      cta: 'Tap link in bio to start your free trial 👆',
      characterCount: 380,
      formatNote: 'Visual-first format with high-contrast graphic slide and engagement CTA.',
      recommendedImageRatio: '1:1 (Square) or 4:5 (Vertical)',
      recommendedVideoRatio: '9:16 (Vertical Reel)',
    },
    linkedin: {
      caption: [
        `Scaling modern business operations requires eliminating friction at every touchpoint.`,
        ``,
        `When managing ${topic}, fragmented point tools create bottlenecks that cost teams valuable hours. By centralizing pipelines, client communications, and team workflows into ${productOrService}, teams consistently accelerate closing velocity.`,
        ``,
        `Key operational advantages:`,
        `🔹 Real-time visibility across customer conversations`,
        `🔹 Automated follow-ups and verified template broadcasts`,
        `🔹 Unified tracking and team accountability`,
        ``,
        `How is your organization streamlining ${domainInfo.domain.toLowerCase()} this quarter?`,
      ].join('\n'),
      hashtags: combinedHashtags.filter((h) => !h.toLowerCase().includes('dailybuz')).slice(0, 5),
      cta: 'Explore the full walkthrough in the comments below.',
      characterCount: 650,
      formatNote: 'Professional long-form copy tailored for B2B founders and decision makers.',
      recommendedImageRatio: '1.91:1 (Landscape) or 16:9',
      recommendedVideoRatio: '16:9 (Landscape)',
    },
    x: {
      caption: `${hook}\n\nStreamline ${topic} with automated pipelines and instant messaging in ${productOrService}.\n\nTry it free today 🚀\n${combinedHashtags.slice(0, 3).join(' ')}`,
      hashtags: combinedHashtags.slice(0, 3),
      cta: 'Learn more at: ' + (req.websiteUrl || 'https://dailybuz.com'),
      characterCount: 240,
      formatNote: 'Concise 280-character post designed for high timeline readability.',
      recommendedImageRatio: '16:9 (Landscape)',
      recommendedVideoRatio: '16:9 or 1:1',
    },
    facebook: {
      caption: [
        `Looking for a smarter way to manage ${topic}?`,
        ``,
        `${productOrService} brings all your customer conversations, automated reminders, and deal pipelines into one easy dashboard.`,
        ``,
        `Ready to take your business to the next level? Try it today!`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 4),
      cta: 'Click the link below to get started free!',
      characterCount: 320,
      formatNote: 'Community-oriented copy with clickable link in post body.',
      recommendedImageRatio: '1.91:1 or 1:1',
      recommendedVideoRatio: '16:9 or 9:16',
    },
    tiktok: {
      caption: `${hook} #fyp #businessgrowth #productivity\n\nLink in bio!`,
      hashtags: ['#fyp', '#businessgrowth', '#productivity', '#smb'],
      cta: 'Check the link in bio!',
      characterCount: 120,
      formatNote: 'Short-form punchy caption with high-velocity hashtags for discovery.',
      recommendedImageRatio: '9:16 (Vertical)',
      recommendedVideoRatio: '9:16 (Vertical)',
    },
    youtube: {
      caption: `${postTitle}\n\n${body}\n\n${cta}`,
      hashtags: combinedHashtags.slice(0, 5),
      cta: 'Subscribe and click the link in the description!',
      characterCount: 450,
      formatNote: 'SEO-optimized description with full topic context and clear link CTA.',
      recommendedImageRatio: '16:9 (Thumbnail)',
      recommendedVideoRatio: '16:9 (Video) or 9:16 (Shorts)',
    },
    threads: {
      caption: `${hook}\n\n${short_description}\n\nDrop a comment if your team is working on this! 👇`,
      hashtags: combinedHashtags.slice(0, 3),
      cta: 'Drop a reply below!',
      characterCount: 220,
      formatNote: 'Conversational social post optimized for quick replies and thread discussions.',
      recommendedImageRatio: '1:1 or 4:5',
      recommendedVideoRatio: '9:16 or 1:1',
    },
  };

  const platformNotes: Record<string, string> = {
    linkedin: 'Optimized with professional formatting, bullet highlights, and strategic industry hashtags.',
    instagram: 'Best paired with a 1:1 clean graphic or 9:16 Reel hook with key takeaway slides.',
    x: 'Keep within 280 characters with a punchy hook and 2-3 focused hashtags.',
    facebook: 'Great for community engagement and direct link placement in the post body.',
    tiktok: 'Ultra-fast visual pacing with focus on the first 2 seconds.',
    youtube: 'Keyword-dense summary suitable for video descriptions and community posts.',
    threads: 'Conversational tone inviting peer comments and shared experiences.',
  };

  const social: GeneratedSocialPost = {
    generation_id: generationId,
    title: postTitle,
    hook,
    body,
    caption,
    short_description,
    shortCaption,
    cta,
    hashtags: combinedHashtags,
    keywords: combinedKeywords,
    image_prompt: generatedImagePrompt,
    video_prompt: generatedVideoPrompt,
    image_prompt_version: imagePromptVersion,
    video_prompt_version: videoPromptVersion,
    platform: platformList[0] || 'instagram',
    content_type: req.contentType || 'post',
    target_audience: targetAudience,
    campaign: campaignName,
    objective,
    suggestedPlatforms: platformList,
    targetAudience,
    contentObjective: objective,
    suggestedPostingTime: {
      time: '10:30 AM',
      dayOfWeek: 'Tuesday',
      reason: 'Peak engagement window for business decision makers and active followers.',
    },
    contentCategory: req.contentType || 'social_post',
    image_concept: imageConcept,
    image_alt_text: imageAltText,
    image_url: finalUploadedMediaUrl,
    creativeSuggestion: {
      description: imageConcept,
      imageStyle,
      videoStyle,
      visualStyle: imageStyle,
      aspectRatio: platformList.includes('instagram') ? '1:1 (Square)' : '1.91:1 (Landscape)',
      suggestedColorPalette: ['#3B82F6', '#6366F1', '#10B981', '#0F172A'],
    },
    trendingAngle: {
      headline: trendingAngleHeadline,
      context: trendingContext,
      isLiveDataSource: false,
    },
    platform_specific,
    platformNotes,
  };

  return {
    success: true,
    generation_id: generationId,
    mode: 'social',
    structured_intent: intent,
    social,
    enrichment: {
      topicKeywords,
      industryKeywords: domainInfo.keywords,
      trendingAngle: trendingAngleHeadline,
      brandKeywords: [brandName, 'Business OS', 'Unified Workspace'],
    },
    providerUsed: 'DailyBuz Multi-Tenant Creative Context Engine',
  };
}
