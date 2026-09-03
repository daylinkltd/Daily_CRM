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
  detectedSubject: string;
  detectedIndustry: string;
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
  detected_subject: string;
  detected_industry: string;
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

// --------------------------------------------------------------------------
// 1. Universal Subject, Entity & Keyword Extractor
// --------------------------------------------------------------------------
export function extractSubjectAndEntity(input: string): {
  cleanSubject: string;
  extractedBrand: string | null;
  coreEntity: string;
} {
  let text = input.trim();

  // Strip leading command phrases
  const commandPrefixes = [
    /^(?:create|make|generate|write|compose|design)\s+(?:an?|the)?\s*(?:instagram|linkedin|twitter|x|facebook|tiktok|social|blog)?\s*(?:post|ad|article|caption|content|reel|update)?\s*(?:for|about|promoting|to promote|introducing|highlighting|showcasing)?\s*/i,
    /^(?:promote|announcing|announce|showcase|introduce|launch)\s+(?:our|a|an|the|new)?\s*/i,
    /^(?:post|ad|article|caption)\s+(?:about|for|on)\s*/i,
  ];

  for (const prefix of commandPrefixes) {
    text = text.replace(prefix, '').trim();
  }

  // Check for brand naming patterns like "called X", "named X", "brand X", "by X"
  let extractedBrand: string | null = null;
  const brandMatch = text.match(/(?:called|named|brand\s+called|brand\s+named)\s+["']?([A-Za-z0-9&'\s]+?)(?:["']|\s+(?:for|in|with|to|at|\.|\,)|$)/i);
  if (brandMatch && brandMatch[1]) {
    extractedBrand = brandMatch[1].trim();
  } else {
    // Check if input mentions specific products like "DailyBuz CRM", "DailyBuz HR", "Acme Hub", etc.
    const specificBrandMatch = text.match(/\b([A-Za-z0-9&']+(?:\s+[A-Za-z0-9&']+)*\s+(?:CRM|HR|Hub|Engine|Software|App|Platform|Studio))\b/i);
    if (specificBrandMatch && specificBrandMatch[1]) {
      extractedBrand = specificBrandMatch[1].trim();
    }
  }

  // Clean subject
  const cleanSubject = text.length > 0 ? text : input;

  // Isolate coreEntity (truncate at prepositions if present like 'for small businesses')
  const entityCutMatch = cleanSubject.match(/^(.*?)(?:\s+(?:for|in|with|target|targeting|aimed\s+at)\s+)/i);
  const coreEntity = (entityCutMatch && entityCutMatch[1]?.trim()) || cleanSubject.split(/\s+/).slice(0, 4).join(' ');

  return { cleanSubject, extractedBrand, coreEntity };
}

export function extractKeyTerms(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'our', 'your', 'about', 'want', 'post', 'create', 'make',
    'promoting', 'promote', 'write', 'generate', 'called', 'named', 'showcase',
    'instagram', 'linkedin', 'facebook', 'twitter', 'tiktok', 'youtube', 'threads',
  ]);

  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  return Array.from(new Set(words));
}

// --------------------------------------------------------------------------
// 2. Universal Industry & Domain Detector (Works for ANY business)
// --------------------------------------------------------------------------
export interface IndustryDomainInfo {
  domain: string;
  category: string;
  keywords: string[];
  hashtags: string[];
  defaultAudience: string;
  defaultVisualScene: string;
  defaultVisualObject: string;
  defaultVideoHook: string;
  defaultVideoAction: string;
  defaultCta: string;
}

export function detectIndustryDomain(topic: string): IndustryDomainInfo {
  const t = topic.toLowerCase();

  // 0. Human Resources, Attendance, Payroll & Workforce
  if (t.includes('hr') || t.includes('attendance') || t.includes('payroll') || t.includes('employee') || t.includes('workforce') || t.includes('timesheet') || t.includes('recruitment')) {
    return {
      domain: 'Human Resources & Workforce Management',
      category: 'Human Resources',
      keywords: ['human resources', 'workforce management', 'attendance tracking', 'payroll automation', 'employee engagement', 'team productivity'],
      hashtags: ['#HRTech', '#WorkforceManagement', '#EmployeeAttendance', '#HumanResources', '#FutureOfWork', '#PayrollSolutions'],
      defaultAudience: 'HR leaders, People Operations managers, and business executives',
      defaultVisualScene: 'Professional modern human resources and workspace environment with collaborative teams and digital workforce displays',
      defaultVisualObject: 'Human resources dashboard and modern employee workforce attendance overview with real-time check-in indicators',
      defaultVideoHook: 'Visual opening hook showing seamless 1-tap employee clock-in and instant team schedule alignment',
      defaultVideoAction: 'Smooth screen tour highlighting automated shift planning, leave approval workflows, and workforce metrics',
      defaultCta: 'Streamline your workforce management and explore the HR platform today',
    };
  }

  // 1. Handmade, Home Fragrance, Candles, Artisanal Crafts
  if (t.includes('candle') || t.includes('fragrance') || t.includes('scent') || t.includes('wax') || t.includes('handmade') || t.includes('craft') || t.includes('pottery') || t.includes('soap') || t.includes('home decor') || t.includes('aromatherapy')) {
    return {
      domain: 'Handmade Crafts & Home Fragrance',
      category: 'Home & Lifestyle',
      keywords: ['handmade candles', 'home fragrance', 'soy wax', 'essential oils', 'cozy living', 'artisanal decor', 'handcrafted luxury', 'aromatherapy'],
      hashtags: ['#HandmadeCandles', '#HomeFragrance', '#SoyCandles', '#CozyLiving', '#ArtisanMade', '#CandleLovers', '#Aromatherapy', '#HandcraftedLuxury'],
      defaultAudience: 'Home decor enthusiasts, fragrance lovers, and thoughtful gift seekers',
      defaultVisualScene: 'Warm, cozy minimalist interior with soft ambient light, textured linen surfaces, and subtle botanical elements',
      defaultVisualObject: 'Artisanal handmade scented candle in an amber glass vessel with a gently flickering natural flame',
      defaultVideoHook: 'Close-up of a match striking and gently lighting an artisanal candle wick with soft warm crackle',
      defaultVideoAction: 'Camera slowly pulls back to reveal the candle filling a peaceful sunlit living room with ambient warmth',
      defaultCta: 'Shop the collection today & bring warmth to your space',
    };
  }

  // 2. Food, Dining, Restaurants, Cafes & Bakeries
  if (t.includes('pizza') || t.includes('restaurant') || t.includes('cafe') || t.includes('dining') || t.includes('bakery') || t.includes('burger') || t.includes('sushi') || t.includes('chef') || t.includes('food') || t.includes('bistro') || t.includes('dessert') || t.includes('coffee') || t.includes('roastery')) {
    return {
      domain: 'Food, Dining & Culinary Arts',
      category: 'Food & Hospitality',
      keywords: ['artisanal food', 'fresh ingredients', 'culinary experience', 'gourmet dining', 'local flavors', 'foodie destination', 'handcrafted dishes'],
      hashtags: ['#FoodieLife', '#GourmetEats', '#FoodLovers', '#RestaurantOpening', '#DeliciousBites', '#CulinaryArt', '#LocalFlavors', '#Foodstagram'],
      defaultAudience: 'Local foodies, families, dining enthusiasts, and neighborhood food lovers',
      defaultVisualScene: 'Vibrant, inviting restaurant setting with rustic wood tables, warm ambient Edison bulbs, and mouthwatering food presentation',
      defaultVisualObject: 'Freshly prepared gourmet dish steaming on a rustic wooden board, garnished with fresh herbs and vibrant colors',
      defaultVideoHook: 'Sizzling close-up macro shot of ingredients being flame-cooked or fresh cheese pull',
      defaultVideoAction: 'Vibrant montage of chef plating the dish, happy diners smiling, and the inviting lively restaurant atmosphere',
      defaultCta: 'Reserve your table or order now to experience the flavors',
    };
  }

  // 3. Fashion, Apparel, Footwear & Accessories
  if (t.includes('clothing') || t.includes('apparel') || t.includes('fashion') || t.includes('dress') || t.includes('collection') || t.includes('shoes') || t.includes('summer') || t.includes('wear') || t.includes('jewelry') || t.includes('boutique') || t.includes('outfit') || t.includes('streetwear') || t.includes('textile')) {
    return {
      domain: 'Fashion, Apparel & Modern Style',
      category: 'Fashion & Retail',
      keywords: ['fashion collection', 'sustainable style', 'premium fabrics', 'wardrobe essentials', 'seasonal lookbook', 'contemporary aesthetic', 'effortless style'],
      hashtags: ['#FashionStyle', '#OOTD', '#SummerCollection', '#SustainableFashion', '#WardrobeEssentials', '#StyleInspiration', '#BoutiqueStyle', '#Lookbook'],
      defaultAudience: 'Fashion-forward individuals, style seekers, and mindful apparel shoppers',
      defaultVisualScene: 'Sun-drenched outdoor editorial setting with architectural textures and clean minimalist aesthetics',
      defaultVisualObject: 'Elegantly styled fashion model showcasing the collection with natural drape, rich textile texture, and subtle motion',
      defaultVideoHook: 'Dynamic walking transition showing the movement and texture of the new collection garment',
      defaultVideoAction: 'Snappy rhythmic cuts showcasing different styling combinations, natural daylight movement, and fabric details',
      defaultCta: 'Explore the new collection online before it sells out',
    };
  }

  // 4. Real Estate, Housing, Properties & Architecture
  if (t.includes('apartment') || t.includes('real estate') || t.includes('villa') || t.includes('property') || t.includes('housing') || t.includes('flat') || t.includes('penthouse') || t.includes('realtor') || t.includes('interior design') || t.includes('residential')) {
    return {
      domain: 'Real Estate & Premium Living Spaces',
      category: 'Real Estate',
      keywords: ['luxury living', 'modern apartments', 'prime location', 'architectural design', 'property investment', 'spacious interiors', 'dream home'],
      hashtags: ['#RealEstate', '#LuxuryLiving', '#DreamHome', '#ModernApartments', '#PropertyInvestment', '#ArchitectureDesign', '#HomeBuying', '#LuxuryHomes'],
      defaultAudience: 'Homebuyers, modern families, property investors, and luxury living seekers',
      defaultVisualScene: 'Sunlit modern architectural space with floor-to-ceiling panoramic windows, lush greenery, and contemporary interior decor',
      defaultVisualObject: 'Spacious modern living room with natural hardwood floors, designer lighting, and expansive skyline view',
      defaultVideoHook: 'Sweeping drone shot or smooth push-in through elegant double doors into a breathtaking sunlit living space',
      defaultVideoAction: 'Smooth gimbal tour highlighting the master suite, modern kitchen, private balcony, and community amenities',
      defaultCta: 'Schedule your private site tour or download the brochure today',
    };
  }

  // 5. Beauty, Cosmetics, Skincare & Salons
  if (t.includes('skincare') || t.includes('beauty') || t.includes('cosmetic') || t.includes('salon') || t.includes('spa') || t.includes('serum') || t.includes('makeup') || t.includes('facial') || t.includes('glow') || t.includes('hair') || t.includes('wellness')) {
    return {
      domain: 'Beauty, Skincare & Aesthetics',
      category: 'Health & Beauty',
      keywords: ['clean skincare', 'glowing skin', 'organic beauty', 'radiant complexion', 'hydrating serum', 'dermatologist approved', 'self care ritual'],
      hashtags: ['#SkincareRoutine', '#GlowingSkin', '#CleanBeauty', '#SelfCare', '#RadiantSkin', '#BeautyCommunity', '#HealthySkin', '#OrganicBeauty'],
      defaultAudience: 'Skincare enthusiasts, beauty lovers, and individuals prioritizing self-care and radiant skin',
      defaultVisualScene: 'Clean, serene aesthetic with soft diffused daylight, organic botanical accents, and delicate water droplet reflections',
      defaultVisualObject: 'Minimalist glass cosmetic bottle with golden serum dropper resting on natural travertine stone',
      defaultVideoHook: 'Sensory macro shot of a silky serum drop falling in ultra slow motion onto dewy, glowing skin',
      defaultVideoAction: 'Gentle, soothing application sequence demonstrating radiant texture transformation and healthy natural glow',
      defaultCta: 'Unlock your natural glow — order your skincare ritual today',
    };
  }

  // 6. Fitness, Gym, Health & Personal Training
  if (t.includes('fitness') || t.includes('gym') || t.includes('workout') || t.includes('trainer') || t.includes('health') || t.includes('yoga') || t.includes('crossfit') || t.includes('nutrition') || t.includes('athlete')) {
    return {
      domain: 'Fitness, Health & Athletic Performance',
      category: 'Health & Fitness',
      keywords: ['fitness transformation', 'strength training', 'daily workout', 'athletic performance', 'healthy lifestyle', 'gym motivation', 'endurance'],
      hashtags: ['#FitnessMotivation', '#WorkoutRoutine', '#GymLife', '#FitFam', '#HealthyLiving', '#TrainHard', '#BodyTransformation', '#StrengthTraining'],
      defaultAudience: 'Fitness enthusiasts, athletes, gym-goers, and health-conscious individuals',
      defaultVisualScene: 'High-energy modern training studio with dramatic moody rim lighting and professional fitness equipment',
      defaultVisualObject: 'Athlete in focused training motion with sweat droplets catching the rim light and sharp muscular definition',
      defaultVideoHook: 'High-octane opening burst of an athlete completing a powerful rep with motivating rhythmic beat',
      defaultVideoAction: 'Fast-paced montage of varied training exercises, inspiring dedication, and high-energy coach guidance',
      defaultCta: 'Claim your 7-day trial pass or start your training program today',
    };
  }

  // 7. Education, Courses, Bootcamps & Coaching
  if (t.includes('course') || t.includes('bootcamp') || t.includes('learn') || t.includes('tutorial') || t.includes('python') || t.includes('coding') || t.includes('academy') || t.includes('coaching') || t.includes('masterclass') || t.includes('training') || t.includes('school')) {
    return {
      domain: 'Education, Skills & Professional Growth',
      category: 'Education & Career',
      keywords: ['practical skills', 'expert mentorship', 'hands-on projects', 'career acceleration', 'interactive learning', 'skill mastery', 'industry certificate'],
      hashtags: ['#LearnToCode', '#OnlineCourse', '#CareerGrowth', '#SkillDevelopment', '#TechBootcamp', '#LifelongLearning', '#Masterclass', '#FutureSkills'],
      defaultAudience: 'Aspiring professionals, career switchers, students, and ambitious learners',
      defaultVisualScene: 'Focused, inspiring modern workspace with dual monitors displaying code or design, clean notebook, and warm study lamp',
      defaultVisualObject: 'Interactive modern learning interface with clear visual progress milestones and project completion badges',
      defaultVideoHook: 'Visual challenge hook showing a complex problem being solved with simple, structured clarity',
      defaultVideoAction: 'Step-by-step screen animation showing hands-on project building, mentor feedback, and celebratory certification',
      defaultCta: 'Enroll today and take your skills to the next level',
    };
  }

  // 8. Travel, Hospitality, Tourism & Hotels
  if (t.includes('travel') || t.includes('tour') || t.includes('hotel') || t.includes('resort') || t.includes('vacation') || t.includes('holiday') || t.includes('destination') || t.includes('flight') || t.includes('getaway')) {
    return {
      domain: 'Travel, Hospitality & World Exploration',
      category: 'Travel & Tourism',
      keywords: ['wanderlust getaway', 'luxury resort', 'travel destination', 'unforgettable experiences', 'scenic views', 'vacation package', 'adventure travel'],
      hashtags: ['#TravelGram', '#Wanderlust', '#VacationGoals', '#LuxuryTravel', '#TravelPhotography', '#ExploreTheWorld', '#ResortLiving', '#HolidayEscape'],
      defaultAudience: 'Travel lovers, vacation planners, couples, and adventure seekers looking for memorable getaways',
      defaultVisualScene: 'Breathtaking scenic landscape with golden hour sunlight, turquoise waters, and lush tropical flora',
      defaultVisualObject: 'Private infinity pool overlooking a panoramic ocean sunset with comfortable loungers and refreshing drinks',
      defaultVideoHook: 'Breathtaking drone flyover revealing an untouched paradise beach or stunning mountain vista',
      defaultVideoAction: 'Inviting montage of resort amenities, local culinary treats, serene relaxation, and unforgettable adventures',
      defaultCta: 'Book your dream getaway today and create lasting memories',
    };
  }

  // 9. Tech, SaaS & Software (ONLY when the user explicitly requests software/tech)
  if (t.includes('saas') || t.includes('software') || t.includes('crm') || t.includes('automation') || t.includes('api') || t.includes('cloud') || t.includes('cyber') || t.includes('pipeline') || t.includes('developer') || t.includes('app') || t.includes('ai automation')) {
    return {
      domain: 'Software, AI & Modern Automation',
      category: 'Technology & SaaS',
      keywords: ['workflow automation', 'cloud platform', 'ai intelligence', 'productivity boost', 'seamless integration', 'data-driven insights', 'team efficiency'],
      hashtags: ['#SaaSGrowth', '#AIAutomation', '#TechInnovation', '#CloudSoftware', '#ProductivityTools', '#DevTech', '#FutureOfWork', '#BusinessTech'],
      defaultAudience: 'Founders, engineering leaders, product teams, and modern operations professionals',
      defaultVisualScene: 'Sleek, futuristic digital workspace with clean isometric visual elements and glowing interface metrics',
      defaultVisualObject: 'Modern floating UI interface cards showing automated data flows and real-time activity metrics',
      defaultVideoHook: 'Fast visual transition from a slow manual task to an instant automated 1-click execution',
      defaultVideoAction: 'Smooth screen recording showing automated data sync, lightning-fast response, and live dashboard analytics',
      defaultCta: 'Start your 14-day free trial or request an interactive demo',
    };
  }

  // 10. Generic / Dynamic Universal Fallback (Infused directly from user keywords with ZERO DailyBuz/SaaS bias)
  const keyTerms = extractKeyTerms(topic);
  const capitalTopic = keyTerms.slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Product & Service';
  const dynamicHashtags = keyTerms.slice(0, 6).map((k) => `#${k.charAt(0).toUpperCase() + k.slice(1)}`);

  return {
    domain: `${capitalTopic} & Brand Promotion`,
    category: 'Commercial & Brand Marketing',
    keywords: [...keyTerms, 'premium quality', 'exceptional value', 'customer satisfaction', 'unique features'],
    hashtags: dynamicHashtags.length > 0 ? dynamicHashtags : ['#BrandSpotlight', '#ProductLaunch', '#NewRelease', '#QualityFirst'],
    defaultAudience: 'Discerning customers, passionate enthusiasts, and quality-focused buyers',
    defaultVisualScene: 'Polished commercial studio setting with clean visual hierarchy, balanced natural lighting, and curated styling',
    defaultVisualObject: `Showcase presentation of "${topic}" with high-fidelity detailing and premium tactile aesthetics`,
    defaultVideoHook: `Captivating opening hook highlighting the unique appeal and standout quality of "${topic}"`,
    defaultVideoAction: `Smooth dynamic sequence showcasing key features, craftsmanship, and real-world value in action`,
    defaultCta: 'Learn more and discover the collection today',
  };
}

// --------------------------------------------------------------------------
// 3. Platform Aspect Ratio & Format Guidelines
// --------------------------------------------------------------------------
export function getPlatformAspectGuidelines(platform: string): {
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
        imageRecommendation: 'Landscape 1.91:1 or 16:9 composition tailored for LinkedIn professional desktop and mobile feeds, authoritative visual hierarchy',
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

// --------------------------------------------------------------------------
// 4. Universal Natural Language Intent Parser
// --------------------------------------------------------------------------
export function parseNaturalLanguageIntent(input: string): StructuredIntent {
  const text = input.trim();
  const lower = text.toLowerCase();
  const { cleanSubject, extractedBrand, coreEntity } = extractSubjectAndEntity(text);
  const domainInfo = detectIndustryDomain(cleanSubject);

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
  let detectedObjective = 'Brand awareness & customer engagement';

  if (lower.includes('lead') || lower.includes('demo') || lower.includes('inbound') || lower.includes('trial') || lower.includes('sign up')) {
    detectedIntent = 'lead_gen';
    detectedObjective = 'Lead generation';
  } else if (lower.includes('promot') || lower.includes('offer') || lower.includes('discount') || lower.includes('sale') || lower.includes('buy') || lower.includes('shop')) {
    detectedIntent = 'promotion';
    detectedObjective = 'Promotion & sales conversion';
  } else if (lower.includes('announce') || lower.includes('update') || lower.includes('release') || lower.includes('new') || lower.includes('opening') || lower.includes('launch')) {
    detectedIntent = 'announcement';
    detectedObjective = 'New launch & announcement';
  } else if (lower.includes('how to') || lower.includes('guide') || lower.includes('tutorial') || lower.includes('tips') || lower.includes('learn')) {
    detectedIntent = 'educational';
    detectedObjective = 'Customer education & thought leadership';
  } else if (lower.includes('story') || lower.includes('customer') || lower.includes('testimonial') || lower.includes('review') || lower.includes('case study')) {
    detectedIntent = 'testimonial';
    detectedObjective = 'Social proof & customer testimonial';
  }

  // Detect Audience (derived organically from domain if not in text)
  let detectedAudience = domainInfo.defaultAudience;
  if (lower.includes('women') || lower.includes('females')) {
    detectedAudience = 'Women aged 20-35 seeking quality, elegance, and personal style';
  } else if (lower.includes('men') || lower.includes('gentlemen')) {
    detectedAudience = 'Men seeking refined, premium lifestyle and essentials';
  } else if (lower.includes('small business') || lower.includes('smb') || lower.includes('founders')) {
    detectedAudience = 'Small business owners, founders, and growth entrepreneurs';
  } else if (lower.includes('students') || lower.includes('youth') || lower.includes('gen z')) {
    detectedAudience = 'Young adults, students, and trend-conscious digital natives';
  } else if (lower.includes('family') || lower.includes('parents')) {
    detectedAudience = 'Modern families, parents, and community households';
  }

  // Detect Tone
  let detectedTone: StructuredIntent['detectedTone'] = 'engaging';
  if (lower.includes('professional') || lower.includes('formal') || lower.includes('corporate') || lower.includes('executive')) {
    detectedTone = 'professional';
  } else if (lower.includes('premium') || lower.includes('luxury') || lower.includes('elegant') || lower.includes('sophisticated')) {
    detectedTone = 'creative';
  } else if (lower.includes('short') || lower.includes('concise') || lower.includes('quick') || lower.includes('snappy')) {
    detectedTone = 'concise';
  } else if (lower.includes('educational') || lower.includes('informative') || lower.includes('guide')) {
    detectedTone = 'educational';
  } else if (lower.includes('fun') || lower.includes('exciting') || lower.includes('creative') || lower.includes('inspiring')) {
    detectedTone = 'creative';
  }

  return {
    rawInput: text,
    detectedTopic: cleanSubject,
    detectedSubject: cleanSubject,
    detectedIndustry: domainInfo.domain,
    detectedIntent,
    detectedProduct: extractedBrand || coreEntity,
    detectedAudience,
    detectedPlatforms: detectedPlatforms.length > 0 ? detectedPlatforms : undefined,
    detectedTone,
    detectedGoal: detectedObjective,
    detectedObjective,
  };
}

// --------------------------------------------------------------------------
// 5. Universal Production-Ready Image Prompt Builder (DALL-E 3 / Midjourney)
// --------------------------------------------------------------------------
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
    targetAudience,
    campaignName,
    productOrService,
    objective,
    imageStyle,
    visualStyle,
    brandContext,
    additionalInstructions,
  } = params;

  const { cleanSubject, extractedBrand } = extractSubjectAndEntity(topic);
  const domainInfo = detectIndustryDomain(cleanSubject);
  const primaryPlatform = platforms[0] || 'instagram';
  const platformSpecs = getPlatformAspectGuidelines(primaryPlatform);

  const activeStyle = imageStyle || visualStyle || (domainInfo.category === 'Food & Hospitality' || domainInfo.category === 'Home & Lifestyle' ? 'Product Photography' : 'Cinematic');
  const subjectName = productOrService || extractedBrand || cleanSubject;
  const audience = targetAudience || domainInfo.defaultAudience;
  const marketingGoal = objective || 'engagement and brand appeal';

  // Style-specific photographic/artistic rendering directives
  let styleDetails = '';
  switch (activeStyle) {
    case 'Product Photography':
      styleDetails = 'Commercial studio product photography, razor-sharp focus on the primary subject, macro depth of field, gentle softbox diffusion, authentic tactile textures, and subtle natural reflections';
      break;
    case 'Cinematic':
      styleDetails = 'Cinematic 35mm film aesthetic, rich atmospheric depth, dramatic volumetric rim lighting, subtle color grading with warm highlights and balanced shadows, artistic contrast';
      break;
    case '3D':
      styleDetails = 'Polished 3D CGI rendering, smooth frosted glass and satin textures, soft ambient occlusion, subtle neon backlighting, high-end isometric presentation';
      break;
    case 'Editorial':
      styleDetails = 'High-fashion editorial magazine style, minimalist art direction, dramatic elegant lighting, refined artistic composition, sophisticated color harmony';
      break;
    case 'Lifestyle':
      styleDetails = 'Authentic commercial lifestyle photography, warm sun-drenched natural environment, candid relatable setting, organic morning light, vibrant real-world ambiance';
      break;
    case 'Illustration':
      styleDetails = 'Refined modern vector illustration, sophisticated flat art with subtle grain textures, curated harmonious color palette, elegant curves';
      break;
    case 'Minimal SaaS':
    case 'Modern Tech':
      styleDetails = 'Ultra-clean modern technology visual, sleek floating interface cards with glassmorphic layers, crisp typography containers, soft studio lighting';
      break;
    default:
      styleDetails = 'Premium commercial advertising quality, razor-sharp focal subject, balanced natural lighting, and curated background styling';
      break;
  }

  // Construct structured, production-ready image generation prompt
  const promptLines: string[] = [
    `Create a premium ${activeStyle.toLowerCase()} visual asset for ${primaryPlatform.toUpperCase()} (${platformSpecs.imageRatio}) showcasing "${cleanSubject}".`,
    `Subject & Core Concept: High-end visual representation of ${subjectName}. The visual must clearly communicate the marketing goal of "${marketingGoal}" for an audience of ${audience}.`,
    `Scene & Environment: ${domainInfo.defaultVisualScene}. Centered on ${domainInfo.defaultVisualObject}.`,
    `Composition & Camera: ${platformSpecs.imageRecommendation}. Eye-level or slight top-down three-quarters perspective with strong focal clarity on the central subject and generous clean breathing room.`,
    `Lighting & Aesthetic: ${styleDetails}. Color direction reflects clean, inviting, and premium tones.`,
  ];

  if (brandContext?.brandColors) {
    promptLines.push(`Brand Palette: Incorporate subtle accents of ${brandContext.brandColors}.`);
  }

  if (campaignName && campaignName.trim()) {
    promptLines.push(`Campaign Theme: Aligned with the "${campaignName.trim()}" initiative.`);
  }

  if (additionalInstructions && additionalInstructions.trim()) {
    promptLines.push(`Custom Directives: ${additionalInstructions.trim()}`);
  }

  promptLines.push(`Negative Prompts (Things to avoid): No visible competitor logos, no distorted or misspelled text, no messy cluttered background, no unnatural artifacts or extra limbs, no harsh overexposure, no watermarks.`);

  return promptLines.join(' ');
}

// --------------------------------------------------------------------------
// 6. Universal Production-Ready Video Prompt Builder (Sora / Runway / Kling)
// --------------------------------------------------------------------------
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
    targetAudience,
    campaignName,
    productOrService,
    objective,
    videoStyle = 'Cinematic',
    brandContext,
    additionalInstructions,
  } = params;

  const { cleanSubject, extractedBrand } = extractSubjectAndEntity(topic);
  const domainInfo = detectIndustryDomain(cleanSubject);
  const primaryPlatform = platforms[0] || 'instagram';
  const platformSpecs = getPlatformAspectGuidelines(primaryPlatform);

  const subjectName = productOrService || extractedBrand || cleanSubject;
  const audience = targetAudience || domainInfo.defaultAudience;
  const marketingGoal = objective || 'promotion and engagement';

  // Motion style description
  let motionStyleDesc = 'Smooth gimbal movement, elegant depth transitions, and cinematic pacing';
  switch (videoStyle) {
    case 'Cinematic':
      motionStyleDesc = 'Cinematic 24fps film motion, smooth gimbal tracking shots, shallow depth of field, atmospheric soft lighting, elegant slow-motion micro-interactions';
      break;
    case 'Product Demo':
    case 'Product Showcase':
      motionStyleDesc = 'Smooth 360 rotation around the product, macro reveal of fine craftsmanship, dynamic lighting shifts, and crystal-clear feature highlights';
      break;
    case 'UGC-style':
      motionStyleDesc = 'Authentic handheld mobile camera aesthetic, natural relatable creator framing, dynamic jump cuts, realistic warm room lighting';
      break;
    case 'Storytelling':
      motionStyleDesc = 'Narrative-driven visual progression from anticipation to delightful discovery, character-centered framing with emotional warmth';
      break;
    case 'Fast-paced Social':
      motionStyleDesc = 'Punchy 0.5s rhythmic cuts, dynamic zoom transitions, high-contrast visual momentum designed for instant thumb-stopping retention';
      break;
    case 'Minimal Premium':
      motionStyleDesc = 'Sophisticated minimal movement, slow continuous floating camera drift, elegant lighting passes, pristine negative space';
      break;
  }

  // Construct structured chronological action sequence
  const videoLines: string[] = [
    `Create a 10-second ${videoStyle.toLowerCase()} marketing video for ${primaryPlatform.toUpperCase()} (${platformSpecs.videoRatio}).`,
    `Concept & Objective: Showcase "${cleanSubject}" for ${audience} delivering on "${marketingGoal}".`,
    `Visual Arc & Chronological Action Sequence:`,
    `• 0–2 sec [Opening Hook]: ${domainInfo.defaultVideoHook}. Fast visual intrigue with high sensory appeal to capture attention immediately.`,
    `• 2–5 sec [Scene & Main Action]: ${domainInfo.defaultVideoAction}. Camera glides smoothly to reveal the product in use with pristine environment styling.`,
    `• 5–8 sec [Product / Value Demonstration]: Macro camera push-in highlighting exquisite details, premium quality, and emotional satisfaction of using ${subjectName}.`,
    `• 8–10 sec [Ending / CTA Visual]: Camera gently pulls back to an artistic final hero frame showcasing ${subjectName} with clean negative space for the concluding call-to-action.`,
    `Camera Movement & Transitions: ${motionStyleDesc}. Smooth transitions with realistic physics and natural motion blur.`,
    `Lighting, Environment & Palette: Warm, natural ambient lighting highlighting authentic textures and rich colors.`,
  ];

  if (brandContext?.brandColors) {
    videoLines.push(`Brand Tones: Featuring subtle accents of ${brandContext.brandColors}.`);
  }

  if (campaignName && campaignName.trim()) {
    videoLines.push(`Campaign Context: Aligned with "${campaignName.trim()}".`);
  }

  if (additionalInstructions && additionalInstructions.trim()) {
    videoLines.push(`Custom Directives: ${additionalInstructions.trim()}`);
  }

  videoLines.push(`Negative Prompts (Things to avoid): Avoid competitor branding, distorted elements, unnatural jerky camera shaking, abrupt jump cuts, blurry frames, watermarks.`);

  return videoLines.join(' ');
}

// --------------------------------------------------------------------------
// 7. Universal Social & Blog Content Generator
// --------------------------------------------------------------------------
export async function generateMarketingContent(
  req: GenerateContentRequest
): Promise<ContentGenerationResult> {
  const rawInput = req.topic?.trim() || 'Handmade artisanal collection';
  const intent = parseNaturalLanguageIntent(rawInput);
  const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const { cleanSubject, extractedBrand } = extractSubjectAndEntity(rawInput);
  const domainInfo = detectIndustryDomain(cleanSubject);

  const topic = cleanSubject;
  const tone = req.tone || intent.detectedTone || 'engaging';
  const isBlog = req.contentType === 'blog';
  const platformList = req.platforms && req.platforms.length > 0
    ? req.platforms
    : (intent.detectedPlatforms || ['instagram', 'linkedin', 'x']);

  const objective = req.objective || intent.detectedObjective || 'Brand awareness & customer engagement';
  const targetAudience = req.targetAudience || intent.detectedAudience || domainInfo.defaultAudience;
  const campaignName = req.campaignName || req.brandContext?.campaign || '';

  // Subject/Brand Priority:
  // 1. User's explicit product / extracted entity from prompt
  // 2. req.productOrService if passed
  // 3. Brand context business name ONLY if no entity was in the prompt
  const productOrService = req.productOrService || extractedBrand || (req.brandContext?.businessName ? req.brandContext.businessName : cleanSubject);
  const brandName = extractedBrand || req.brandContext?.businessName || productOrService.split(' ')[0] || 'Our Brand';

  const imageStyle = req.imageStyle || req.visualStyle || 'Product Photography';
  const videoStyle = req.videoStyle || 'Cinematic';

  const topicKeywords = extractKeyTerms(topic);

  // Regeneration flags
  const isImagePromptOnly = req.regenTarget === 'image_prompt_only';
  const isVideoPromptOnly = req.regenTarget === 'video_prompt_only';
  const isHashtagsOnly = req.regenTarget === 'hashtags_only';
  const isCaptionOnly = req.regenTarget === 'caption_only';

  const imagePromptVersion = (req.imagePromptVersion || 1) + (isImagePromptOnly ? 1 : 0);
  const videoPromptVersion = (req.videoPromptVersion || 1) + (isVideoPromptOnly ? 1 : 0);

  // Image & Video Prompts
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

  const imageConcept = `A high-impact ${imageStyle} visual showcasing "${cleanSubject}" for ${targetAudience}.`;
  const imageAltText = `${imageStyle} marketing visual for "${cleanSubject}" - ${targetAudience} focus`;

  // Keywords & Hashtags Synthesis
  const combinedKeywords = req.existingKeywords && isImagePromptOnly
    ? req.existingKeywords
    : Array.from(new Set([...topicKeywords, ...domainInfo.keywords.slice(0, 5)]));

  const cleanBrandTag = brandName ? `#${brandName.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  const combinedHashtags = req.existingHashtags && isImagePromptOnly
    ? req.existingHashtags
    : Array.from(new Set([
        ...(cleanBrandTag && cleanBrandTag.length > 2 ? [cleanBrandTag] : []),
        ...domainInfo.hashtags,
        ...topicKeywords.map((k) => `#${k.charAt(0).toUpperCase() + k.slice(1)}`),
      ]));

  const trendingAngleHeadline = `Why "${topicKeywords[0] || cleanSubject}" Is Capturing Customer Attention This Season`;
  const trendingContext = `Audiences increasingly value authenticity, craftsmanship, and memorable experiences in ${domainInfo.domain}.`;

  const finalUploadedMediaUrl = req.uploadedMediaUrl || undefined;

  // --------------------------------------------------------------------------
  // BLOG GENERATION
  // --------------------------------------------------------------------------
  if (isBlog) {
    const primaryKw = combinedKeywords[0] || topic;
    const secKeywords = combinedKeywords.slice(1, 5);
    const blogTitle = req.existingTitle || (
      topic.length < 50
        ? `The Complete Guide to ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
        : `Everything You Need to Know About ${cleanSubject}`
    );

    const slug = blogTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);

    const seoTitle = `${blogTitle} | ${brandName}`;
    const seoDescription = `Discover everything you need to know about ${primaryKw}. Explore expert tips, craftsmanship, and insights in ${domainInfo.domain}.`;

    const headings = [
      { level: 2, text: `1. Introduction: The Appeal of ${cleanSubject}` },
      { level: 2, text: `2. Key Features & What Makes It Special` },
      { level: 3, text: `Understanding Quality & Craftsmanship` },
      { level: 2, text: `3. Practical Tips & Everyday Inspiration` },
      { level: 3, text: `How to Get the Most Value` },
      { level: 2, text: `4. Frequently Asked Questions` },
    ];

    const faqSchema = [
      {
        question: `What makes ${primaryKw} unique?`,
        answer: `${primaryKw} is crafted with attention to detail and premium materials to deliver an exceptional, lasting experience.`,
      },
      {
        question: `How can I get started with ${cleanSubject}?`,
        answer: `Explore our collection and discover the perfect fit for your lifestyle and preferences.`,
      },
    ];

    const bodyContent = [
      `When it comes to **${cleanSubject}**, quality, authenticity, and attention to detail make all the difference. In this guide, we explore what sets it apart and how you can enjoy the best experience.`,
      ``,
      `## 1. Introduction: The Appeal of ${cleanSubject}`,
      `Whether you are exploring **${primaryKw}** for the first time or looking to elevate your daily ritual, choosing handcrafted, thoughtfully designed products brings warmth, satisfaction, and lasting value to your routine.`,
      ``,
      `## 2. Key Features & What Makes It Special`,
      `Here are the standout aspects that define excellence in ${domainInfo.domain}:`,
      `- **Premium Ingredients & Materials**: Selected carefully to ensure purity, longevity, and superior performance.`,
      `- **Artisanal Attention**: Every piece is prepared with dedication to deliver an unforgettable customer experience.`,
      `- **Sustainable & Mindful**: Designed with care for your environment and everyday well-being.`,
      ``,
      `### Understanding Quality & Craftsmanship`,
      `True quality is immediately noticeable. From the moment you unbox **${productOrService}**, the care in presentation and finish speaks for itself.`,
      ``,
      `## 3. Practical Tips & Everyday Inspiration`,
      `To make the most of your purchase, consider incorporating it into your regular self-care, home ambiance, or daily workflow rituals.`,
      ``,
      `## 4. Frequently Asked Questions`,
      `**Q: What makes ${primaryKw} unique?**`,
      `A: ${primaryKw} is crafted with attention to detail to deliver an exceptional, lasting experience.`,
      ``,
      `---`,
      `*Discover the difference today with ${productOrService}.*`,
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
        category: domainInfo.category,
        tags: [primaryKw, ...secKeywords, domainInfo.category],
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
        brandKeywords: [brandName, domainInfo.category],
      },
      providerUsed: 'DailyBuz Universal Marketing AI Engine',
    };
  }

  // --------------------------------------------------------------------------
  // SOCIAL GENERATION (UNIVERSAL COPYWRITING)
  // --------------------------------------------------------------------------
  const postTitle = req.existingTitle || (
    cleanSubject.length < 50
      ? cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1)
      : `Spotlight: ${cleanSubject}`
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
      hook = `Excellence in ${domainInfo.domain} begins with quality, consistency, and purposeful design.`;
      body = [
        `Introducing ${productOrService} — thoughtfully created to meet the highest standards of ${domainInfo.domain.toLowerCase()}.`,
        ``,
        `Highlights:`,
        `✨ Handpicked premium quality & thoughtful formulation`,
        `✨ Designed for reliability, satisfaction, and elegance`,
        `✨ Backed by our commitment to customer delight`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Learn more and discover how ${productOrService} delivers exceptional value.`].join('\n');
    } else if (tone === 'concise') {
      hook = `Discover ${cleanSubject}. ✨`;
      body = `Crafted with care, designed to delight. Experience the difference with ${productOrService}.`;
      caption = [hook, ``, body, ``, `Shop now and elevate your experience! 🚀`].join('\n');
    } else if (tone === 'creative') {
      hook = `There is something truly magical about ${cleanSubject}. ✨🕯️`;
      body = [
        `Indulge your senses with ${productOrService}. Crafted with passion and designed to bring comfort, luxury, and warmth into your world.`,
        ``,
        `Why you will love it:`,
        `🌿 Pure, mindful craftsmanship`,
        `💫 Unmatched sensory appeal`,
        `🎁 The perfect treat for yourself or someone special`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Tap the link in bio to shop the collection today! ✨`].join('\n');
    } else {
      // Engaging & Conversational default
      hook = `Ready to experience the ultimate ${cleanSubject}? ✨`;
      body = [
        `Whether you're treating yourself or looking for the perfect gift, ${productOrService} is here to elevate your everyday moments.`,
        ``,
        `What makes it special:`,
        `• Handcrafted with premium care & precision`,
        `• Designed to deliver lasting satisfaction`,
        `• Loved by our growing community`,
      ].join('\n');
      caption = [hook, ``, body, ``, `👉 Tap the link below to explore more and get yours today!`].join('\n');
    }
  }

  const short_description = `Experience ${cleanSubject} with ${productOrService}. Premium quality and delight in every detail.`;
  const shortCaption = `${cleanSubject} by ${productOrService}. Elevate your everyday! ✨`;
  const cta = req.existingCta || (
    req.websiteUrl || req.brandContext?.website
      ? `Click here to explore: ${req.websiteUrl || req.brandContext?.website}`
      : domainInfo.defaultCta
  );

  // Platform-Specific Copy Variations
  const platform_specific: Record<string, PlatformSpecificContent> = {
    instagram: {
      caption: [
        hook,
        ``,
        body,
        ``,
        `Tap the link in bio to explore ${productOrService}! ✨`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 8),
      cta: 'Tap link in bio to shop now 👆',
      characterCount: 360,
      formatNote: 'Visual-first format with emotive hook and engagement CTA.',
      recommendedImageRatio: '1:1 (Square) or 4:5 (Vertical)',
      recommendedVideoRatio: '9:16 (Vertical Reel)',
    },
    linkedin: {
      caption: [
        `Excellence in ${domainInfo.domain} requires relentless attention to quality and customer experience.`,
        ``,
        `Introducing ${productOrService} — designed for individuals and organizations that value craftsmanship and precision.`,
        ``,
        `Key highlights:`,
        `🔹 Premium materials and sustainable practices`,
        `🔹 Curated for lasting quality and impact`,
        `🔹 Dedicated support and satisfaction guarantee`,
        ``,
        `How does your team prioritize quality in ${domainInfo.domain.toLowerCase()}?`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 5),
      cta: 'Explore more in the link below.',
      characterCount: 520,
      formatNote: 'Professional, structured copy tailored for industry decision makers.',
      recommendedImageRatio: '1.91:1 (Landscape) or 16:9',
      recommendedVideoRatio: '16:9 (Landscape)',
    },
    x: {
      caption: `${hook}\n\nExperience ${cleanSubject} crafted with exceptional quality by ${productOrService}.\n\nExplore now 🚀\n${combinedHashtags.slice(0, 3).join(' ')}`,
      hashtags: combinedHashtags.slice(0, 3),
      cta: 'Discover more at: ' + (req.websiteUrl || 'https://example.com'),
      characterCount: 220,
      formatNote: 'Concise 280-character post designed for high timeline readability.',
      recommendedImageRatio: '16:9 (Landscape)',
      recommendedVideoRatio: '16:9 or 1:1',
    },
    facebook: {
      caption: [
        `Looking for ${cleanSubject}?`,
        ``,
        `${productOrService} brings you exceptional quality and craftsmanship designed to delight.`,
        ``,
        `Order today and experience the difference!`,
      ].join('\n'),
      hashtags: combinedHashtags.slice(0, 4),
      cta: 'Click the link below to get yours now!',
      characterCount: 300,
      formatNote: 'Community-oriented copy with clear direct action link.',
      recommendedImageRatio: '1.91:1 or 1:1',
      recommendedVideoRatio: '16:9 or 9:16',
    },
    tiktok: {
      caption: `${hook} #fyp #viral #trending\n\nLink in bio! ✨`,
      hashtags: ['#fyp', '#viral', ...domainInfo.hashtags.slice(0, 3)],
      cta: 'Check the link in bio!',
      characterCount: 110,
      formatNote: 'Short-form punchy caption with high-discovery hashtags.',
      recommendedImageRatio: '9:16 (Vertical)',
      recommendedVideoRatio: '9:16 (Vertical Fullscreen)',
    },
    youtube: {
      caption: `${postTitle}\n\n${body}\n\n${cta}`,
      hashtags: combinedHashtags.slice(0, 5),
      cta: 'Subscribe and check out the link in description!',
      characterCount: 420,
      formatNote: 'Keyword-dense video description and community post summary.',
      recommendedImageRatio: '16:9 (Thumbnail)',
      recommendedVideoRatio: '16:9 (Video) or 9:16 (Shorts)',
    },
    threads: {
      caption: `${hook}\n\n${short_description}\n\nDrop a comment if you love this! 👇`,
      hashtags: combinedHashtags.slice(0, 3),
      cta: 'Leave your thoughts below!',
      characterCount: 180,
      formatNote: 'Conversational social post designed for community discussion.',
      recommendedImageRatio: '1:1 or 4:5',
      recommendedVideoRatio: '9:16 or 1:1',
    },
  };

  const platformNotes: Record<string, string> = {
    linkedin: 'Optimized with professional formatting, bullet highlights, and strategic industry hashtags.',
    instagram: 'Best paired with a 1:1 clean graphic or 9:16 Reel hook with key visual showcase slides.',
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
    detected_subject: cleanSubject,
    detected_industry: domainInfo.domain,
    suggestedPostingTime: {
      time: '11:00 AM',
      dayOfWeek: 'Wednesday',
      reason: 'Peak engagement window for social discovery and shopping intent.',
    },
    contentCategory: domainInfo.category,
    image_concept: imageConcept,
    image_alt_text: imageAltText,
    image_url: finalUploadedMediaUrl,
    creativeSuggestion: {
      description: imageConcept,
      imageStyle,
      videoStyle,
      visualStyle: imageStyle,
      aspectRatio: platformList.includes('instagram') ? '1:1 (Square)' : '1.91:1 (Landscape)',
      suggestedColorPalette: ['#E2B170', '#8B5A2B', '#2C3E50', '#F8F9FA'],
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
      brandKeywords: [brandName, domainInfo.category],
    },
    providerUsed: 'DailyBuz Universal Marketing AI Engine',
  };
}
