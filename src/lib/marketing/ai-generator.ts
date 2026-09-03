import { evaluateBlogSEO } from './seo-evaluator';
import { SOCIAL_TEMPLATES, BLOG_TEMPLATES } from './template-library';

export interface StructuredIntent {
  rawInput: string;
  detectedTopic: string;
  detectedIntent: 'promotion' | 'announcement' | 'educational' | 'testimonial' | 'lead_gen' | 'general';
  detectedProduct?: string;
  detectedAudience?: string;
  detectedPlatforms?: string[];
  detectedTone?: 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';
  detectedGoal?: string;
}

export interface GenerateContentRequest {
  topic: string;
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  tone?: 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';
  campaignName?: string;
  productOrService?: string;
  websiteUrl?: string;
  preferredLanguage?: string;
  templateId?: string;
  brandVoice?: string;
  visualStyle?: string;
  additionalCreativeInstructions?: string;
  regenTarget?: 'all' | 'hashtags_only' | 'caption_only' | 'blog_body_only' | 'creative_only';
  existingCaption?: string;
  existingTitle?: string;
  uploadedMediaUrl?: string;
}

export interface PlatformSpecificContent {
  caption: string;
  hashtags: string[];
  cta: string;
  characterCount: number;
  formatNote: string;
}

export interface GeneratedSocialPost {
  generation_id: string;
  title: string;
  hook: string;
  caption: string;
  body: string;
  shortCaption: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
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
  image_prompt: string;
  image_alt_text: string;
  image_url?: string;
  creativeSuggestion: {
    description: string;
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

  // Detect Intent
  let detectedIntent: StructuredIntent['detectedIntent'] = 'general';
  if (lower.includes('promot') || lower.includes('offer') || lower.includes('discount') || lower.includes('launch') || lower.includes('feature')) {
    detectedIntent = 'promotion';
  } else if (lower.includes('announce') || lower.includes('update') || lower.includes('release') || lower.includes('new')) {
    detectedIntent = 'announcement';
  } else if (lower.includes('how to') || lower.includes('guide') || lower.includes('tutorial') || lower.includes('tips') || lower.includes('learn')) {
    detectedIntent = 'educational';
  } else if (lower.includes('lead') || lower.includes('book a demo') || lower.includes('sign up') || lower.includes('trial')) {
    detectedIntent = 'lead_gen';
  }

  // Detect Audience
  let detectedAudience = 'Business owners, founders, and modern growth teams';
  if (lower.includes('small business') || lower.includes('smb') || lower.includes('retail')) {
    detectedAudience = 'Small business owners, retailers, and entrepreneurs';
  } else if (lower.includes('hr') || lower.includes('recruiter') || lower.includes('people ops')) {
    detectedAudience = 'HR managers, People Operations, and talent leaders';
  } else if (lower.includes('sales') || lower.includes('pipeline') || lower.includes('account executive')) {
    detectedAudience = 'Sales leaders, account executives, and B2B growth managers';
  } else if (lower.includes('finance') || lower.includes('accountant') || lower.includes('cfo')) {
    detectedAudience = 'Finance teams, accountants, and CFOs';
  }

  // Detect Product/Service
  let detectedProduct = 'DailyBuz Business Workspace';
  if (lower.includes('crm') || lower.includes('customer management')) {
    detectedProduct = 'DailyBuz CRM';
  } else if (lower.includes('attendance') || lower.includes('payroll') || lower.includes('timesheet')) {
    detectedProduct = 'DailyBuz HR & Attendance Engine';
  } else if (lower.includes('invoice') || lower.includes('gst') || lower.includes('billing')) {
    detectedProduct = 'DailyBuz Automated Invoicing & GST';
  } else if (lower.includes('whatsapp') || lower.includes('broadcast') || lower.includes('chat')) {
    detectedProduct = 'DailyBuz WhatsApp Hub';
  }

  // Detect Tone
  let detectedTone: StructuredIntent['detectedTone'] = 'engaging';
  if (lower.includes('professional') || lower.includes('formal') || lower.includes('executive')) {
    detectedTone = 'professional';
  } else if (lower.includes('short') || lower.includes('concise') || lower.includes('quick')) {
    detectedTone = 'concise';
  } else if (lower.includes('educational') || lower.includes('informative')) {
    detectedTone = 'educational';
  }

  return {
    rawInput: text,
    detectedTopic: text,
    detectedIntent,
    detectedProduct,
    detectedAudience,
    detectedPlatforms: detectedPlatforms.length > 0 ? detectedPlatforms : undefined,
    detectedTone,
    detectedGoal: detectedIntent === 'lead_gen' ? 'Generate qualified inbound demo requests' : 'Drive brand awareness & product adoption',
  };
}

// Extraction & Contextual Synthesizer
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
  if (t.includes('crm') || t.includes('lead') || t.includes('pipeline') || t.includes('sales')) {
    return {
      domain: 'Sales & Customer Relationship Management',
      keywords: ['sales pipeline', 'lead conversion', 'omnichannel messaging', 'deal closure', 'crm automation', 'customer retention'],
      hashtags: ['#DailyBuzCRM', '#SalesGrowth', '#CRMSoftware', '#LeadGen', '#B2BSales', '#CustomerSuccess'],
    };
  }
  if (t.includes('hr') || t.includes('attendance') || t.includes('payroll') || t.includes('employee')) {
    return {
      domain: 'Human Resources & Workforce Management',
      keywords: ['payroll automation', 'attendance tracking', 'employee engagement', 'talent retention', 'hrtech'],
      hashtags: ['#DailyBuzHR', '#HRTech', '#WorkforceManagement', '#PayrollSolutions', '#FutureOfWork'],
    };
  }
  if (t.includes('invoice') || t.includes('gst') || t.includes('finance') || t.includes('tax') || t.includes('accounting')) {
    return {
      domain: 'Accounting, Billing & GST Compliance',
      keywords: ['e-invoicing', 'gst compliance', 'cash flow management', 'automated billing', 'reconciliation'],
      hashtags: ['#GSTCompliance', '#AccountingSoftware', '#BusinessFinance', '#SmartBilling', '#CashFlow'],
    };
  }
  if (t.includes('whatsapp') || t.includes('chat') || t.includes('broadcast') || t.includes('support')) {
    return {
      domain: 'Omnichannel & WhatsApp Commerce',
      keywords: ['whatsapp marketing', 'broadcast automation', 'customer support', 'instant messaging', 'chatbot'],
      hashtags: ['#WhatsAppMarketing', '#CustomerEngagement', '#Omnichannel', '#ChatCommerce', '#SupportTech'],
    };
  }

  return {
    domain: 'Business Productivity & Enterprise Operations',
    keywords: ['business automation', 'workflow optimization', 'digital transformation', 'team efficiency', 'growth strategy'],
    hashtags: ['#DailyBuz', '#BusinessAutomation', '#ProductivityHacks', '#SMBGrowth', '#OperationsExcellence'],
  };
}

export function buildImagePrompt(params: {
  topic: string;
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  visualStyle?: string;
  additionalInstructions?: string;
}): string {
  const { topic, contentType = 'social', platforms = ['linkedin'], targetAudience = 'Business owners & professionals', visualStyle = 'Modern', additionalInstructions } = params;
  const platform = platforms[0] || 'linkedin';
  const domainInfo = detectIndustryDomain(topic);

  let styleDesc = 'clean modern minimalism, sleek tech aesthetic with subtle geometric gradients and high contrast';
  if (visualStyle?.toLowerCase() === 'professional') {
    styleDesc = 'executive corporate photography style, high-end clean desk setup, elegant lighting, muted premium tones';
  } else if (visualStyle?.toLowerCase() === 'minimal') {
    styleDesc = 'ultra-clean minimalism, ample negative space, sharp typography focal point, elegant neutral palette';
  } else if (visualStyle?.toLowerCase() === 'product-focused') {
    styleDesc = 'polished 3D software dashboard interface floating on a sleek gradient pedestal, vibrant interactive glow';
  } else if (visualStyle?.toLowerCase() === 'promotional') {
    styleDesc = 'dynamic high-energy commercial marketing graphic, bold badge accents, vibrant gradients and striking typography';
  } else if (visualStyle?.toLowerCase() === 'educational') {
    styleDesc = 'clear structured step-by-step visual infographic layout, crisp icons, modern data chart cards';
  } else if (visualStyle?.toLowerCase() === 'lifestyle') {
    styleDesc = 'authentic modern entrepreneur in a sunlit collaborative workspace holding a tablet with a business dashboard';
  }

  const promptParts = [
    `A captivating ${visualStyle} commercial visual asset for ${platform.toUpperCase()}`,
    `Subject: Conceptual representation of "${topic}" in the domain of ${domainInfo.domain}`,
    `Target Audience: ${targetAudience}`,
    `Style & Lighting: ${styleDesc}, 8k resolution, photorealistic studio lighting, crisp UI accents`,
    `Branding Elements: Subtle blue/indigo tech accents, clean DailyBuz aesthetic`,
  ];

  if (additionalInstructions && additionalInstructions.trim()) {
    promptParts.push(`Special Instructions: ${additionalInstructions.trim()}`);
  }

  return promptParts.join('. ');
}

// Main Generation Function
export async function generateMarketingContent(
  req: GenerateContentRequest
): Promise<ContentGenerationResult> {
  const rawInput = req.topic?.trim() || 'Modern Business Automation and CRM Workflow';
  const intent = parseNaturalLanguageIntent(rawInput);
  const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const topic = rawInput;
  const tone = req.tone || intent.detectedTone || 'engaging';
  const isBlog = req.contentType === 'blog';
  const platformList = req.platforms && req.platforms.length > 0
    ? req.platforms
    : (intent.detectedPlatforms || ['linkedin', 'instagram', 'x']);

  const topicKeywords = extractKeyTerms(topic);
  const domainInfo = detectIndustryDomain(topic);
  const targetAudience = req.targetAudience || intent.detectedAudience || 'Business owners, department heads, and modern growth teams';

  const combinedKeywords = Array.from(
    new Set([...topicKeywords, ...domainInfo.keywords.slice(0, 4)])
  );
  const combinedHashtags = Array.from(
    new Set([...domainInfo.hashtags, ...topicKeywords.map((k) => `#${k.charAt(0).toUpperCase() + k.slice(1)}`)])
  );

  const trendingAngleHeadline = `How Top Teams Are Scaling ${topicKeywords[0] || 'Operations'} with ${intent.detectedProduct || 'DailyBuz'}`;
  const trendingContext = `Companies using ${intent.detectedProduct || 'unified CRM automation'} report a 40% reduction in customer response latency and significantly higher team throughput.`;

  const visualStyle = req.visualStyle || 'Modern';
  const imagePrompt = buildImagePrompt({
    topic,
    contentType: req.contentType,
    platforms: platformList,
    targetAudience,
    visualStyle,
    additionalInstructions: req.additionalCreativeInstructions,
  });

  const imageConcept = `A high-impact ${visualStyle} visual showcasing ${intent.detectedProduct} in action: visual workflow pipelines and analytics dashboards designed for ${targetAudience}.`;
  const imageAltText = `Visual representation of ${topic} for ${targetAudience} - ${visualStyle} style`;

  // Curated high quality context creative visual pool
  let defaultCreativeUrl = 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1080&auto=format&fit=crop&q=80';
  const t = topic.toLowerCase();
  if (t.includes('crm') || t.includes('sales') || t.includes('lead')) {
    defaultCreativeUrl = 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1080&auto=format&fit=crop&q=80';
  } else if (t.includes('attendance') || t.includes('hr') || t.includes('employee')) {
    defaultCreativeUrl = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1080&auto=format&fit=crop&q=80';
  } else if (t.includes('whatsapp') || t.includes('chat') || t.includes('broadcast')) {
    defaultCreativeUrl = 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=1080&auto=format&fit=crop&q=80';
  } else if (t.includes('invoice') || t.includes('gst') || t.includes('finance')) {
    defaultCreativeUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1080&auto=format&fit=crop&q=80';
  }

  const finalImageUrl = req.uploadedMediaUrl || defaultCreativeUrl;

  // BLOG MODE
  if (isBlog) {
    const primaryKw = combinedKeywords[0] || topic;
    const secKeywords = combinedKeywords.slice(1, 5);
    const blogTitle = req.existingTitle || (
      topic.length < 50
        ? `The Ultimate Guide to ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
        : `How to Streamline ${domainInfo.domain} with ${intent.detectedProduct}`
    );

    const slug = blogTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);

    const seoTitle = `${blogTitle} | DailyBuz Growth Hub`;
    const seoDescription = `Learn proven strategies to master ${primaryKw} with ${intent.detectedProduct}. Actionable frameworks, automation tips, and real-world workflows to scale ${domainInfo.domain.toLowerCase()}.`;

    const headings = [
      { level: 2, text: `1. Understanding the Core Challenges in ${domainInfo.domain}` },
      { level: 2, text: `2. Strategic Framework: Modernizing Your Workflow` },
      { level: 3, text: `Key Operational Bottlenecks & How to Overcome Them` },
      { level: 2, text: `3. Step-by-Step Implementation Guide with ${intent.detectedProduct}` },
      { level: 3, text: `Phase 1: Centralizing Data & Removing Silos` },
      { level: 3, text: `Phase 2: Automating Recurring Touchpoints` },
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
        question: `How does ${intent.detectedProduct} improve team productivity?`,
        answer: `By unifying conversations, pipeline stages, and invoicing into one interface, teams eliminate context switching and reduce response latency by up to 45%.`,
      },
    ];

    const bodyContent = [
      `In today's fast-moving business landscape, managing **${topic}** requires a strategic approach that blends unified systems with real-time operational execution. Fragmented tools lead to communication drop-offs and lost revenue.`,
      ``,
      `## 1. Understanding the Core Challenges in ${domainInfo.domain}`,
      `Many organizations still struggle with disconnected data silos. When sales, operations, and support teams work in isolation, customer inquiries sit unanswered and operational overhead skyrockets. Implementing a cohesive strategy around **${primaryKw}** ensures every touchpoint is logged, tracked, and actioned promptly.`,
      ``,
      `## 2. Strategic Framework: Modernizing Your Workflow`,
      `To build a resilient and scalable operating model, consider these foundational pillars:`,
      `- **Unified Communication**: Bring all incoming messages, leads, and orders into a single collaborative queue.`,
      `- **Automated Pipelines**: Trigger status updates and notification reminders automatically without manual intervention.`,
      `- **Data-Driven Decision Making**: Track conversion velocity and team throughput across clear visual dashboards.`,
      ``,
      `### Key Operational Bottlenecks & How to Overcome Them`,
      `The most common hurdle is tool fatigue. By unifying customer conversations, automated broadcasts, and financial invoicing into one intuitive interface, teams reduce response latency by up to 45%.`,
      ``,
      `## 3. Step-by-Step Implementation Guide with ${intent.detectedProduct}`,
      `### Phase 1: Centralizing Data & Removing Silos`,
      `Begin by mapping your customer touchpoints. Identify where manual data entry causes friction and connect your primary channels to a shared workspace.`,
      ``,
      `### Phase 2: Automating Recurring Touchpoints`,
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
      `*Ready to elevate your team's workflow? Discover how ${intent.detectedProduct} simplifies business operations with unified tools.*`,
    ].join('\n');

    const seoReadiness = evaluateBlogSEO({
      title: blogTitle,
      seoTitle,
      seoDescription,
      slug,
      content: bodyContent,
      primaryKeyword: primaryKw,
      secondaryKeywords: secKeywords,
      featuredImage: finalImageUrl,
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
        image_prompt: imagePrompt,
        image_url: finalImageUrl,
        socialSharingTitle: blogTitle,
        socialSharingDescription: seoDescription,
        estimatedReadTime: Math.ceil(bodyContent.split(/\s+/).length / 200),
        seoReadiness,
      },
      enrichment: {
        topicKeywords,
        industryKeywords: domainInfo.keywords,
        trendingAngle: trendingAngleHeadline,
        brandKeywords: ['DailyBuz', 'Business OS', 'Omnichannel Hub'],
      },
      providerUsed: 'DailyBuz Semantic Context Generator',
    };
  }

  // SOCIAL MODE
  const postTitle = req.existingTitle || (
    topic.length < 45
      ? topic.charAt(0).toUpperCase() + topic.slice(1)
      : `Mastering ${domainInfo.domain} with ${intent.detectedProduct}`
  );

  let hook = '';
  let body = '';
  let caption = '';

  if (req.existingCaption && (req.regenTarget === 'hashtags_only' || req.regenTarget === 'creative_only')) {
    caption = req.existingCaption;
    hook = req.existingCaption.split('\n')[0] || '';
    body = req.existingCaption;
  } else {
    if (tone === 'professional') {
      hook = `Scaling modern ${domainInfo.domain.toLowerCase()} requires eliminating friction at every customer touchpoint.`;
      body = [
        `When managing ${topic}, fragmented point tools create bottlenecks. By centralizing pipelines, client communications, and team workflows into one unified workspace, high-performing teams accelerate deal velocity and ensure zero dropped opportunities.`,
        ``,
        `Key operational advantages of ${intent.detectedProduct}:`,
        `🔹 Real-time visibility across customer conversations`,
        `🔹 Automated follow-ups and verified template broadcasts`,
        `🔹 Unified financial tracking and compliant billing`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Explore how ${intent.detectedProduct} transforms team execution.`].join('\n');
    } else if (tone === 'concise') {
      hook = `Stop juggling 5 disconnected tabs for ${topic}. ⚡`;
      body = `Bring your conversations, sales pipelines, and team automations into ${intent.detectedProduct}. Built for fast-growing businesses that value velocity.`;
      caption = [hook, ``, body, ``, `Try it free today! 🚀`].join('\n');
    } else {
      hook = `Still dealing with communication drop-offs and scattered spreadsheets for ${topic}? 🤯`;
      body = [
        `It is time for a simpler, faster way to operate! When your customer conversations, automated messaging, and pipeline stages live together in ${intent.detectedProduct}, your team gets hours back every week.`,
        ``,
        `✨ Why modern teams make the switch:`,
        `• Instant multi-channel response tracking`,
        `• Smart automated reminders & follow-ups`,
        `• Complete visibility over every active deal`,
      ].join('\n');
      caption = [hook, ``, body, ``, `👉 Ready to supercharge your business workflow? Drop a comment or tap the link in bio to get started!`].join('\n');
    }
  }

  const shortCaption = `Unify ${topic} with ${intent.detectedProduct}. Try it free today! 🚀`;
  const cta = req.websiteUrl
    ? `Click here to learn more: ${req.websiteUrl}`
    : `Start your 14-day free trial or visit the link in bio to get started!`;

  // 2. Platform-Specific Copy Variants
  const platform_specific: Record<string, PlatformSpecificContent> = {
    instagram: {
      caption: [
        hook,
        ``,
        `Here is how modern teams simplify ${topic}:`,
        `👉 Instant pipeline updates`,
        `👉 Zero manual data entry`,
        `👉 Centralized WhatsApp & omnichannel chats`,
        ``,
        `Link in bio to test ${intent.detectedProduct} free! ✨`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 8),
      cta: 'Tap link in bio to start your free trial 👆',
      characterCount: 380,
      formatNote: 'Visual-first format with high-contrast graphic slide and engagement CTA.',
    },
    linkedin: {
      caption: [
        `Scaling modern business operations requires eliminating friction at every touchpoint.`,
        ``,
        `When managing ${topic}, fragmented point tools create bottlenecks that cost teams valuable hours. By centralizing pipelines, client communications, and team workflows into ${intent.detectedProduct}, teams consistently accelerate closing velocity.`,
        ``,
        `Key operational advantages:`,
        `🔹 Real-time visibility across customer conversations`,
        `🔹 Automated follow-ups and verified template broadcasts`,
        `🔹 Unified financial tracking and compliant billing`,
        ``,
        `How is your organization streamlining ${domainInfo.domain.toLowerCase()} this quarter?`,
      ].join('\n'),
      hashtags: combinedHashtags.filter((h) => !h.includes('DailyBuz')).slice(0, 4),
      cta: 'Explore the full walkthrough in the comments below.',
      characterCount: 650,
      formatNote: 'Professional long-form copy tailored for B2B founders and decision makers.',
    },
    x: {
      caption: `${hook}\n\nStreamline ${topic} with automated pipelines and instant messaging in ${intent.detectedProduct}.\n\nTry it free today 🚀\n${combinedHashtags.slice(0, 3).join(' ')}`,
      hashtags: combinedHashtags.slice(0, 3),
      cta: 'Try it free: https://dailybuz.com',
      characterCount: 240,
      formatNote: 'Concise 280-character post designed for high timeline readability.',
    },
    facebook: {
      caption: [
        `Looking for a smarter way to manage ${topic}?`,
        ``,
        `${intent.detectedProduct} brings all your customer conversations, automated reminders, and deal pipelines into one easy dashboard.`,
        ``,
        `Ready to take your business to the next level? Try it today!`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 4),
      cta: 'Click the link below to get started free!',
      characterCount: 320,
      formatNote: 'Community-oriented copy with clickable link in post body.',
    },
  };

  const platformNotes: Record<string, string> = {
    linkedin: 'Optimized with professional formatting, bullet highlights, and strategic industry hashtags.',
    instagram: 'Best paired with a 1:1 clean graphic card or carousel with key takeaway slides.',
    x: 'Keep within 280 characters with punchy hook and 2-3 focused hashtags.',
    facebook: 'Great for community engagement and direct link placement in the post body.',
  };

  const social: GeneratedSocialPost = {
    generation_id: generationId,
    title: postTitle,
    hook,
    body,
    caption,
    shortCaption,
    cta,
    hashtags: combinedHashtags,
    keywords: combinedKeywords,
    suggestedPlatforms: platformList,
    targetAudience,
    contentObjective: intent.detectedGoal || 'Drive engagement and conversion',
    suggestedPostingTime: {
      time: '10:30 AM',
      dayOfWeek: 'Tuesday',
      reason: 'Peak engagement window for business professionals and decision makers.',
    },
    contentCategory: req.contentType || 'social_post',
    image_concept: imageConcept,
    image_prompt: imagePrompt,
    image_alt_text: imageAltText,
    image_url: finalImageUrl,
    creativeSuggestion: {
      description: imageConcept,
      visualStyle: `${visualStyle} aesthetic, high-contrast gradient, bold typography`,
      aspectRatio: platformList.includes('instagram') ? '1:1 (Square)' : '1.91:1 (Landscape)',
      suggestedColorPalette: ['#6366F1', '#8B5CF6', '#10B981', '#0F172A'],
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
      brandKeywords: ['DailyBuz', 'Business OS', 'Omnichannel Hub'],
    },
    providerUsed: 'DailyBuz Contextual AI Engine',
  };
}
