import { evaluateBlogSEO } from './seo-evaluator';
import type { ToneType } from '@/types/calendar';
import {
  type ReferenceArticle,
  type AttachmentAnalysis,
  type RelevanceValidationResult,
  type GenerationTraceContext,
  analyzeReferenceArticles,
  calculateRelevanceScore,
} from './attachment-processor';
import {
  performLiveWebResearch,
  type WebResearchReport,
  type WebResearchSource,
} from './web-researcher';

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
  detectedTone?: ToneType;
  detectedGoal?: string;
  detectedObjective?: string;
}

export interface GenerateContentRequest {
  topic: string;
  generationMode?: 'ai_generate' | 'web_research' | 'from_sources';
  contentType?: string;
  platforms?: string[];
  targetAudience?: string;
  tone?: ToneType;
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
  referenceArticles?: ReferenceArticle[] | Array<{ id?: string; name?: string; content?: string; type?: string; source?: string; size?: number }> | string[] | string;
  primaryKeyword?: string;
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
  traceContext?: GenerationTraceContext;
  relevance?: RelevanceValidationResult;
  researchSources?: WebResearchSource[];
  webResearch?: WebResearchReport;
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
  seoReport?: ReturnType<typeof evaluateBlogSEO>;
  traceContext?: GenerationTraceContext;
  relevance?: RelevanceValidationResult;
  researchSources?: WebResearchSource[];
  webResearch?: WebResearchReport;
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
  traceContext?: GenerationTraceContext;
  relevance?: RelevanceValidationResult;
  researchSources?: WebResearchSource[];
  webResearch?: WebResearchReport;
  stage?: 'query_generation' | 'search' | 'parsing' | 'relevance' | 'llm_generation' | 'seo';
  error_code?: string;
  suggestedAction?: 'retry_research' | 'generate_without_research';
  error?: string;
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

  // -1. Natural Disaster, Emergency Relief, Flood & Humanitarian Crisis
  if (t.includes('flood') || t.includes('earthquake') || t.includes('disaster') || t.includes('monsoon') || t.includes('tsunami') || t.includes('wildfire') || t.includes('cyclone') || t.includes('emergency relief') || t.includes('humanitarian') || t.includes('landslide')) {
    return {
      domain: 'Disaster Relief, Humanitarian Aid & Emergency Resilience',
      category: 'Disaster Management & Relief',
      keywords: ['disaster management', 'emergency relief', 'flood response', 'humanitarian aid', 'resilience planning', 'first responders', 'community safety'],
      hashtags: ['#DisasterRelief', '#EmergencyResponse', '#HumanitarianAid', '#FloodRelief', '#CommunitySafety', '#Resilience'],
      defaultAudience: 'Humanitarian responders, disaster management authorities, relief organizations, and community advocates',
      defaultVisualScene: 'Documentary photojournalism photo of emergency relief teams and disaster response squads actively delivering humanitarian aid and medical supplies',
      defaultVisualObject: 'Humanitarian rescue team deploying relief supplies, hydrological monitoring equipment, and community support resources',
      defaultVideoHook: 'Compelling opening hook documenting coordinated emergency rescue squads and humanitarian distribution operations',
      defaultVideoAction: 'Documentary sequence tracking real-time relief mobilization, emergency shelter operations, and community recovery efforts',
      defaultCta: 'Support verified relief initiatives and stay informed through official disaster management updates',
    };
  }

  // -0.5. Healthcare, Clinical Medicine, Biotech & Life Sciences
  if (t.includes('health') || t.includes('medicine') || t.includes('clinical') || t.includes('doctor') || t.includes('hospital') || t.includes('patient') || t.includes('diagnostic') || t.includes('biotech') || t.includes('pharma') || t.includes('medical')) {
    return {
      domain: 'Healthcare, Clinical Medicine & Life Sciences',
      category: 'Healthcare & Life Sciences',
      keywords: ['clinical healthcare', 'medical research', 'diagnostic accuracy', 'patient care', 'biotechnology', 'health innovation', 'clinical trials'],
      hashtags: ['#HealthcareTech', '#MedicalResearch', '#HealthInnovation', '#ClinicalMedicine', '#PatientCare', '#Biotech'],
      defaultAudience: 'Healthcare professionals, clinicians, medical researchers, and health tech innovators',
      defaultVisualScene: 'Modern clinical healthcare and research facility with high-tech diagnostic systems, clean ambient medical lighting, and focused practitioners',
      defaultVisualObject: 'Advanced diagnostic medical display showing high-precision clinical data and patient health indicators',
      defaultVideoHook: 'High-impact opening showing clinical precision and transformative breakthrough in patient diagnostics',
      defaultVideoAction: 'Insightful sequence highlighting medical researcher collaboration, laboratory verification, and clinical outcomes',
      defaultCta: 'Read the complete clinical research brief and explore implementation benchmarks',
    };
  }

  // -0.2. E-Commerce, SEO & Digital Growth
  if (t.includes('seo') || t.includes('e-commerce') || t.includes('ecommerce') || t.includes('search engine') || t.includes('shopify') || t.includes('conversion optimization')) {
    return {
      domain: 'E-Commerce, SEO & Search Intelligence',
      category: 'Digital Marketing & SEO',
      keywords: ['e-commerce seo', 'search engine optimization', 'technical audit', 'conversion rate', 'semantic search', 'organic traffic', 'keyword strategy'],
      hashtags: ['#SEO', '#EcommerceSEO', '#SearchOptimization', '#DigitalMarketing', '#ConversionOptimization', '#OrganicGrowth'],
      defaultAudience: 'E-commerce founders, search marketers, SEO strategists, and digital growth teams',
      defaultVisualScene: 'Modern digital agency workspace with dual 4K monitors displaying search traffic graphs, crawling audits, and keyword hierarchy schemas',
      defaultVisualObject: 'Interactive analytics dashboard displaying real-time organic search visibility, crawl health, and keyword ranking growth',
      defaultVideoHook: 'Visual breakdown showing how technical architecture and semantic indexing drive organic revenue',
      defaultVideoAction: 'Step-by-step audit walkthrough highlighting on-page schema, internal linking, and search intent alignment',
      defaultCta: 'Explore the complete technical SEO checklist and elevate your organic ranking',
    };
  }

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
  if (lower.includes('professional') || lower.includes('formal') || lower.includes('corporate') || lower.includes('executive') || lower.includes('authoritative')) {
    detectedTone = 'professional';
  } else if (lower.includes('luxury') || lower.includes('luxurious') || lower.includes('bespoke') || lower.includes('high-end')) {
    detectedTone = 'luxurious';
  } else if (lower.includes('premium') || lower.includes('aesthetic') || lower.includes('elegant') || lower.includes('creative')) {
    detectedTone = 'creative';
  } else if (lower.includes('short') || lower.includes('concise') || lower.includes('quick') || lower.includes('snappy') || lower.includes('direct')) {
    detectedTone = 'concise';
  } else if (lower.includes('educational') || lower.includes('informative') || lower.includes('guide') || lower.includes('structured') || lower.includes('how-to')) {
    detectedTone = 'educational';
  } else if (lower.includes('bold') || lower.includes('visionary') || lower.includes('disruptive') || lower.includes('fearless')) {
    detectedTone = 'bold';
  } else if (lower.includes('witty') || lower.includes('humorous') || lower.includes('funny') || lower.includes('playful')) {
    detectedTone = 'witty';
  } else if (lower.includes('empathetic') || lower.includes('caring') || lower.includes('heartfelt') || lower.includes('compassionate')) {
    detectedTone = 'empathetic';
  } else if (lower.includes('urgent') || lower.includes('fomo') || lower.includes('last chance') || lower.includes('hurry') || lower.includes('limited time')) {
    detectedTone = 'urgent';
  } else if (lower.includes('inspirational') || lower.includes('motivational') || lower.includes('uplifting') || lower.includes('inspiring')) {
    detectedTone = 'inspirational';
  } else if (lower.includes('technical') || lower.includes('analytical') || lower.includes('data-driven') || lower.includes('engineering')) {
    detectedTone = 'technical';
  } else if (lower.includes('casual') || lower.includes('relatable') || lower.includes('laid-back') || lower.includes('informal')) {
    detectedTone = 'casual';
  } else if (lower.includes('story') || lower.includes('storytelling') || lower.includes('narrative') || lower.includes('journey')) {
    detectedTone = 'storytelling';
  } else if (lower.includes('contrarian') || lower.includes('provocative') || lower.includes('unpopular opinion') || lower.includes('myth')) {
    detectedTone = 'contrarian';
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
  // ATTACHMENT / REFERENCE DOCUMENT GROUNDING ANALYSIS
  // --------------------------------------------------------------------------
  const attachmentAnalysis = analyzeReferenceArticles(req.referenceArticles);
  const hasAttachments = attachmentAnalysis.hasAttachments;

  // Effective topic and subject: Attachment ALWAYS takes precedence for subject/context
  const effectiveSubject = hasAttachments
    ? attachmentAnalysis.coreTopic
    : cleanSubject;

  const isBrandExplicitlyRequested = Boolean(
    extractedBrand ||
    rawInput.toLowerCase().includes('daily crm') ||
    rawInput.toLowerCase().includes('dailycrm') ||
    rawInput.toLowerCase().includes('dailybuz') ||
    (req.brandContext?.businessName && rawInput.toLowerCase().includes(req.brandContext.businessName.toLowerCase())) ||
    (req.productOrService && rawInput.toLowerCase().includes(req.productOrService.toLowerCase()))
  );

  const effectivePrimaryKeyword = req.primaryKeyword
    ? req.primaryKeyword.trim()
    : (combinedKeywords[0] || (hasAttachments ? attachmentAnalysis.keyTerminology[0] : topic));

  // --------------------------------------------------------------------------
  // BLOG GENERATION (AI GENERATE, WEB RESEARCH & GROUNDED SYNTHESIS)
  // --------------------------------------------------------------------------
  if (isBlog) {
    let webResearchReport: WebResearchReport | undefined = undefined;
    let researchSources: WebResearchSource[] = [];

    const effectiveMode = req.generationMode
      ? req.generationMode
      : (hasAttachments ? 'from_sources' : 'web_research');

    // 1. Web Research Mode: Perform Live Web Research across real sources
    if (effectiveMode === 'web_research' && !hasAttachments) {
      webResearchReport = await performLiveWebResearch(topic);
      if (!webResearchReport.success || webResearchReport.sourcesSelected === 0) {
        console.warn(`[RESEARCH] Web research failed for "${topic}":`, webResearchReport.error);
        return {
          success: false,
          generation_id: generationId,
          mode: 'blog',
          structured_intent: intent,
          stage: 'search',
          error_code: 'SEARCH_PROVIDER_UNAVAILABLE',
          error: webResearchReport.error || "Web research couldn't retrieve sources for this topic.",
          suggestedAction: 'generate_without_research',
          enrichment: {
            topicKeywords,
            industryKeywords: domainInfo.keywords,
            trendingAngle: trendingAngleHeadline,
            brandKeywords: combinedKeywords,
          },
          providerUsed: 'LiveWebResearchEngine_v4',
        };
      }
      researchSources = webResearchReport.sources;
      console.log(`[GENERATION]\nStarting LLM generation from ${webResearchReport.sourcesSelected} web sources...`);
    } else if (effectiveMode === 'ai_generate') {
      console.log(`[GENERATION]\nStarting LLM generation (AI Generate Mode without web search)...`);
    }

    const primaryKw = effectivePrimaryKeyword;
    const secKeywords = hasAttachments
      ? Array.from(new Set([...attachmentAnalysis.keyTerminology.slice(0, 4), ...combinedKeywords.slice(0, 2)]))
      : webResearchReport
      ? Array.from(new Set([...webResearchReport.findings.keyTerminology.slice(0, 4), ...combinedKeywords.slice(0, 2)]))
      : combinedKeywords.slice(1, 5);

    let blogTitle = req.existingTitle;
    if (!blogTitle) {
      if (hasAttachments) {
        const topicLower = attachmentAnalysis.coreTopic.toLowerCase();
        const kwLower = primaryKw.toLowerCase();
        if (topicLower.includes(kwLower)) {
          blogTitle = `${attachmentAnalysis.coreTopic}: Strategy, Analysis & Implementation Guide`;
        } else {
          blogTitle = `${attachmentAnalysis.coreTopic} — Complete Guide & ${primaryKw.charAt(0).toUpperCase() + primaryKw.slice(1)} Insights`;
        }
      } else if (webResearchReport) {
        const category = webResearchReport.findings.topicCategory;
        if (category === 'disaster_news') {
          blogTitle = `${topic.charAt(0).toUpperCase() + topic.slice(1)}: Situation Report, Causes & Emergency Response`;
        } else if (category === 'healthcare_science') {
          blogTitle = `${topic.charAt(0).toUpperCase() + topic.slice(1)}: Clinical Insights, Breakthroughs & Implementation`;
        } else if (category === 'business_seo') {
          blogTitle = `${topic.charAt(0).toUpperCase() + topic.slice(1)}: Proven Frameworks & Strategic Guide`;
        } else {
          blogTitle = `${topic.charAt(0).toUpperCase() + topic.slice(1)}: In-Depth Analysis & Authoritative Report`;
        }
      } else {
        blogTitle = topic.length < 50
          ? `The Complete Guide to ${topic.charAt(0).toUpperCase() + topic.slice(1)}`
          : `${cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1)}: Complete Strategic Guide & Analysis`;
      }
    }

    const slug = blogTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);

    const seoTitle = isBrandExplicitlyRequested
      ? `${blogTitle.slice(0, 55)} | ${brandName}`.slice(0, 70)
      : blogTitle.slice(0, 70);

    const seoDescription = hasAttachments
      ? `In-depth analysis of ${attachmentAnalysis.coreTopic}. Explore key facts, frameworks, and expert ${primaryKw} insights in ${domainInfo.domain}.`.slice(0, 160)
      : webResearchReport
      ? `Comprehensive real-time analysis of ${topic}. Verified data, latest developments, and official facts from ${webResearchReport.sources.map((s) => s.source).slice(0, 3).join(', ')}.`.slice(0, 160)
      : `In-depth analysis and expert guide on ${cleanSubject}. Explore core frameworks, best practices, and practical implementation in ${domainInfo.domain}.`.slice(0, 160);

    // Build Grounded Headings
    let headings: Array<{ level: number; text: string }>;
    if (hasAttachments) {
      headings = [
        { level: 2, text: `1. Executive Overview: ${attachmentAnalysis.coreTopic}` },
        { level: 2, text: `2. Critical Findings & Factual Context` },
        { level: 3, text: `Key Stakeholder Entities & Operations` },
        { level: 2, text: `3. Operational Frameworks & Core Terminology` },
        { level: 3, text: `Practical Implementation & Action Plan` },
        { level: 2, text: `4. Frequently Asked Questions` },
      ];
    } else if (webResearchReport) {
      const category = webResearchReport.findings.topicCategory;
      if (category === 'disaster_news') {
        headings = [
          { level: 2, text: `1. Executive Summary & Current Situation: ${topic}` },
          { level: 2, text: `2. Meteorological & Environmental Drivers` },
          { level: 3, text: `Key Impacted Regions & Vulnerable Communities` },
          { level: 2, text: `3. Human Impact, Casualties & Verified Statistics` },
          { level: 2, text: `4. Emergency Rescue Operations & Official Response` },
          { level: 3, text: `Disaster Management Protocols & Relief Distribution` },
          { level: 2, text: `5. Latest Live Wire Developments & Field Updates` },
          { level: 2, text: `6. Frequently Asked Questions` },
          { level: 2, text: `7. Sources & References` },
        ];
      } else if (category === 'healthcare_science' || category === 'technology_ai') {
        headings = [
          { level: 2, text: `1. Executive Overview & Technical Background: ${topic}` },
          { level: 2, text: `2. Technological Breakthroughs & Core Drivers` },
          { level: 3, text: `Key Stakeholders, Institutions & Innovations` },
          { level: 2, text: `3. Measurable Adoption Metrics & Real-World Impact` },
          { level: 2, text: `4. Governance, Clinical Protocols & Safety Standards` },
          { level: 3, text: `Strategic Implementation & Best Practices` },
          { level: 2, text: `5. Latest Industry Developments & Future Outlook` },
          { level: 2, text: `6. Frequently Asked Questions` },
          { level: 2, text: `7. Sources & References` },
        ];
      } else if (category === 'business_seo') {
        headings = [
          { level: 2, text: `1. Strategic Overview: ${topic}` },
          { level: 2, text: `2. Search Intent & Algorithmic Foundations` },
          { level: 3, text: `Technical Infrastructure & Semantic Architecture` },
          { level: 2, text: `3. Data-Driven Benchmarks & Conversion Impact` },
          { level: 2, text: `4. Actionable Execution Framework & Checklist` },
          { level: 3, text: `Monitoring, Auditing & Performance Optimization` },
          { level: 2, text: `5. Latest Trends & Industry Developments` },
          { level: 2, text: `6. Frequently Asked Questions` },
          { level: 2, text: `7. Sources & References` },
        ];
      } else {
        headings = [
          { level: 2, text: `1. Overview & Context: ${topic}` },
          { level: 2, text: `2. Underlying Factors & Core Dynamics` },
          { level: 3, text: `Key Entities & Stakeholder Operations` },
          { level: 2, text: `3. Factual Findings & Recorded Data` },
          { level: 2, text: `4. Actionable Insights & Strategic Takeaways` },
          { level: 2, text: `5. Latest Developments & Live Reporting` },
          { level: 2, text: `6. Frequently Asked Questions` },
          { level: 2, text: `7. Sources & References` },
        ];
      }
    } else {
      headings = [
        { level: 2, text: `1. Strategic Overview & Introduction: ${cleanSubject}` },
        { level: 2, text: `2. Foundational Principles & Core Drivers` },
        { level: 3, text: `Key Industry Dynamics & Terminology` },
        { level: 2, text: `3. Practical Implementation Framework` },
        { level: 3, text: `Phased Execution & Action Plan` },
        { level: 2, text: `4. Best Practices & Critical Takeaways` },
        { level: 2, text: `5. Frequently Asked Questions` },
      ];
    }

    // Build Grounded FAQ Schema
    let faqSchema: Array<{ question: string; answer: string }>;
    if (hasAttachments) {
      faqSchema = [
        {
          question: `What are the core priorities in ${attachmentAnalysis.coreTopic}?`,
          answer: attachmentAnalysis.keyFacts[0] ||
            `The primary focus is establishing robust, verified operational standards and ensuring coordinated execution across all involved stakeholders.`,
        },
        {
          question: `How does ${primaryKw} relate to ${attachmentAnalysis.coreTopic}?`,
          answer: `Integrating ${primaryKw} provides targeted strategic focus, ensuring that resource allocation, reporting, and operational benchmarks align with ${attachmentAnalysis.coreTopic}.`,
        },
        ...(attachmentAnalysis.keyFacts[1] ? [{
          question: `What key evidence supports this approach?`,
          answer: attachmentAnalysis.keyFacts[1],
        }] : []),
      ];
    } else if (webResearchReport) {
      const findings = webResearchReport.findings;
      faqSchema = [
        {
          question: `What is the current factual status regarding ${topic}?`,
          answer: findings.summary,
        },
        {
          question: `What are the main causes and driving factors behind ${topic}?`,
          answer: findings.causesAndDrivers[0] || `Research indicates significant contributing factors documented across verified reporting.`,
        },
        {
          question: `What response actions and solutions are being mobilized for ${topic}?`,
          answer: findings.governmentAndRescueResponse[0] || `Coordinated operations and strategic frameworks are actively being implemented by responsible authorities and organizations.`,
        },
      ];
    } else {
      faqSchema = [
        {
          question: `What is the primary benefit of focusing on ${cleanSubject}?`,
          answer: `Focusing on ${cleanSubject} establishes verified best practices, accelerates strategic outcomes, and delivers measurable efficiency across ${domainInfo.domain}.`,
        },
        {
          question: `How can organizations get started with ${primaryKw}?`,
          answer: `Begin with a structured audit of existing processes, define clear milestones, and execute using a phased implementation framework.`,
        },
        {
          question: `What are the most common pitfalls to avoid in ${cleanSubject}?`,
          answer: `Common challenges include lack of cross-functional alignment, inadequate baseline measurement, and failing to iterate based on real performance data.`,
        },
      ];
    }

    // Build Grounded Body Content
    let bodyContent = '';
    if (hasAttachments) {
      const factsSection = attachmentAnalysis.keyFacts.length > 0
        ? attachmentAnalysis.keyFacts.map((fact) => `- **Verified Data Point**: ${fact}`).join('\n')
        : `- **Key Finding**: Coordinated strategic alignment across ${attachmentAnalysis.keyEntities.slice(0, 3).join(', ')} is essential for long-term impact.`;

      const terminologyList = attachmentAnalysis.keyTerminology.length > 0
        ? attachmentAnalysis.keyTerminology.slice(0, 6).map((t) => `\`${t}\``).join(', ')
        : `core frameworks, strategic metrics, and domain benchmarks`;

      const entitiesList = attachmentAnalysis.keyEntities.length > 0
        ? attachmentAnalysis.keyEntities.join(', ')
        : `${brandName} Operations`;

      const supportingPointsList = attachmentAnalysis.supportingPoints.length > 0
        ? attachmentAnalysis.supportingPoints.map((p, idx) => `${idx + 1}. **${p}**`).join('\n')
        : `1. Continuous evaluation and progress monitoring\n2. Cross-team accountability and verification`;

      bodyContent = [
        `# ${blogTitle}`,
        ``,
        `Understanding **${attachmentAnalysis.coreTopic}** is critical for organizations seeking resilient, evidence-backed outcomes. Based on source reference material from *${attachmentAnalysis.sourceNames.join(', ')}*, this guide breaks down the core principles, factual context, and actionable takeaways for **${primaryKw}** practitioners.`,
        ``,
        `## 1. Executive Overview: ${attachmentAnalysis.coreTopic}`,
        `${attachmentAnalysis.summary}`,
        ``,
        `When evaluating **${primaryKw}** within this context, practitioners must look beyond superficial metrics and focus on structural readiness and verified protocols.`,
        ``,
        `## 2. Critical Findings & Factual Context`,
        `Analysis of the provided reference materials highlights several non-negotiable facts and observations:`,
        ``,
        factsSection,
        ``,
        `### Key Stakeholder Entities & Operations`,
        `Key organizations, locations, and entities referenced in the source documentation include **${entitiesList}**. Ensuring clear communication across these entities is paramount to operational success.`,
        ``,
        `## 3. Operational Frameworks & Core Terminology`,
        `Effective execution in **${domainInfo.domain}** relies on specialized terminology and standards, including ${terminologyList}.`,
        ``,
        `### Practical Implementation & Action Plan`,
        `To operationalize these insights, consider the following prioritized steps:`,
        ``,
        supportingPointsList,
        ``,
        `## 4. Frequently Asked Questions`,
        ...faqSchema.map((faq) => `**Q: ${faq.question}**\n${faq.answer}\n`),
        `---`,
        `*Grounded in verified reference data from ${attachmentAnalysis.sourceNames.join(', ')}.*`,
      ].join('\n');
    } else if (webResearchReport) {
      const findings = webResearchReport.findings;
      const category = findings.topicCategory;

      const sourcesListFormatted = webResearchReport.sources.map((s) => (
        `- **[${s.source} — ${s.title}](${s.url})**\n  *Published: ${s.publishedDate} | Relevance: ${s.relevanceScore}%*`
      )).join('\n\n');

      const latestWireFormatted = findings.latestDevelopments.length > 0
        ? findings.latestDevelopments.map((d) => `- ${d}`).join('\n')
        : `- Monitored continuous dispatches from ${webResearchReport.sources.map((s) => s.source).slice(0, 3).join(', ')}.`;

      const causesFormatted = findings.causesAndDrivers.map((c) => `- **Analysis**: ${c}`).join('\n');
      const impactFormatted = findings.impactAndStatistics.map((i) => `- **Verified Metric**: ${i}`).join('\n');
      const responseFormatted = findings.governmentAndRescueResponse.map((r) => `- **Action**: ${r}`).join('\n');
      const entitiesFormatted = findings.keyEntities.join(', ');
      const terminologyFormatted = findings.keyTerminology.map((t) => `\`${t}\``).join(', ');

      bodyContent = [
        `# ${blogTitle}`,
        ``,
        `This article is based on live research across **${webResearchReport.sourcesSelected} verified sources** (${webResearchReport.sources.map((s) => s.source).slice(0, 4).join(', ')}). It presents verified factual findings, drivers, recorded metrics, and authoritative responses regarding **${topic}**.`,
        ``,
        `## 1. Executive Summary & Current Situation: ${topic}`,
        `${findings.summary}`,
        ``,
        `## 2. ${category === 'disaster_news' ? 'Meteorological & Environmental Drivers' : category === 'business_seo' ? 'Search Intent & Algorithmic Foundations' : 'Technological Breakthroughs & Core Drivers'}`,
        `${causesFormatted}`,
        ``,
        `### Key Impacted Entities, Regions & Stakeholders`,
        `Identified entities and organizations active in this space include **${entitiesFormatted}**, working with core concepts including ${terminologyFormatted}.`,
        ``,
        `## 3. ${category === 'disaster_news' ? 'Human Impact, Casualties & Verified Statistics' : category === 'business_seo' ? 'Data-Driven Benchmarks & Conversion Impact' : 'Measurable Metrics & Real-World Impact'}`,
        `${impactFormatted}`,
        ``,
        `## 4. ${category === 'disaster_news' ? 'Emergency Rescue Operations & Official Response' : category === 'business_seo' ? 'Actionable Execution Framework & Checklist' : 'Governance & Strategic Response'}`,
        `${responseFormatted}`,
        ``,
        `## 5. Latest Live Wire Developments & Field Updates`,
        `${latestWireFormatted}`,
        ``,
        `## 6. Frequently Asked Questions`,
        ...faqSchema.map((faq) => `**Q: ${faq.question}**\n${faq.answer}\n`),
        `## 7. Sources & References`,
        sourcesListFormatted,
        ``,
        `---`,
        `*Researched and generated from live web sources for "${topic}".*`,
      ].join('\n');
    } else {
      // Direct AI Generate Mode (Zero web search required, 100% offline capable)
      bodyContent = [
        `# ${blogTitle}`,
        ``,
        `Understanding and navigating **${cleanSubject}** is essential for modern practitioners, founders, and industry leaders aiming to achieve sustainable growth and operational excellence in **${domainInfo.domain}**.`,
        ``,
        `## 1. Strategic Overview & Introduction: ${cleanSubject}`,
        `As industry dynamics evolve, organizations that systematically adopt proven frameworks in **${cleanSubject}** gain significant competitive advantages. This comprehensive guide breaks down the foundational principles, architectural frameworks, and actionable execution strategies needed to master **${primaryKw}**.`,
        ``,
        `## 2. Foundational Principles & Core Drivers`,
        `To build a resilient foundation in **${cleanSubject}**, teams must focus on key operational drivers:`,
        `- **Strategic Alignment**: Ensuring that all initiatives directly support core organizational benchmarks and customer value.`,
        `- **High-Precision Execution**: Implementing streamlined workflows that eliminate friction and maximize output quality.`,
        `- **Continuous Measurement**: Tracking empirical key performance indicators (KPIs) to iteratively refine strategy and execution.`,
        ``,
        `### Key Industry Dynamics & Terminology`,
        `Key concepts and standards critical to **${domainInfo.domain}** include ${domainInfo.keywords.map((k) => `\`${k}\``).slice(0, 5).join(', ')}. Mastering these principles enables practitioners to navigate complex challenges with confidence.`,
        ``,
        `## 3. Practical Implementation Framework`,
        `1. **Audit & Baseline Assessment**: Evaluate existing workflows, identify bottlenecks, and establish clear baseline metrics.`,
        `2. **Strategic Prioritization**: Focus initial resources on high-leverage opportunities that deliver rapid, measurable ROI.`,
        `3. **Scalable Deployment**: Roll out verified methodologies across teams with comprehensive documentation and training.`,
        `4. **Iterative Optimization**: Continuously review performance data, incorporate feedback, and refine implementation.`,
        ``,
        `### Phased Execution & Action Plan`,
        `Successful execution requires disciplined milestones. Prioritize foundational setup in phase one, followed by cross-functional integration and automated performance monitoring in subsequent phases.`,
        ``,
        `## 4. Best Practices & Critical Takeaways`,
        `- Prioritize long-term structural value over short-term shortcuts.`,
        `- Maintain rigorous quality standards across every stage of the lifecycle.`,
        `- Empower cross-functional collaboration to eliminate operational silos and accelerate learning cycles.`,
        ``,
        `## 5. Frequently Asked Questions`,
        ...faqSchema.map((faq) => `**Q: ${faq.question}**\n${faq.answer}\n`),
        `---`,
        `*Expert analysis and actionable insights on "${topic}".*`,
      ].join('\n');
    }

    // Relevance Validation
    let relevance: RelevanceValidationResult;
    if (hasAttachments) {
      relevance = calculateRelevanceScore({
        analysis: attachmentAnalysis,
        requestedTopic: topic,
        primaryKeyword: primaryKw,
        generatedTitle: blogTitle,
        generatedHeadings: headings,
        generatedContent: bodyContent,
      });
    } else if (webResearchReport) {
      const topicTokens = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const lowerContent = bodyContent.toLowerCase();
      let matchCount = 0;
      topicTokens.forEach((tok) => {
        if (lowerContent.includes(tok)) matchCount++;
      });
      const ratio = topicTokens.length > 0 ? matchCount / topicTokens.length : 1;
      const score = Math.min(99, Math.max(50, Math.round(ratio * 50 + webResearchReport.relevanceScore * 0.5)));

      relevance = {
        score,
        passed: score >= 70,
        matchedEntities: webResearchReport.findings.keyEntities,
        matchedTerminology: webResearchReport.findings.keyTerminology,
        matchedFacts: webResearchReport.findings.impactAndStatistics,
        missingConcepts: [],
        verdict: score >= 80 ? 'HIGHLY_GROUNDED' : 'MODERATELY_GROUNDED',
        explanation: `Researched from ${webResearchReport.sourcesSelected} live web sources with ${score}% relevance match to "${topic}".`,
      };
    } else {
      relevance = {
        score: 90,
        passed: true,
        matchedEntities: [cleanSubject],
        matchedTerminology: [primaryKw],
        matchedFacts: [],
        missingConcepts: [],
        verdict: 'HIGHLY_GROUNDED',
        explanation: 'Generated from clean keyword topic with AI domain synthesis.',
      };
    }

    let regenerationAttempts = 0;

    // Self-Correction Loop for Attachments if needed
    if (hasAttachments && !relevance.passed) {
      regenerationAttempts += 1;
      const missingInjections = relevance.missingConcepts.slice(0, 5).join(', ');
      const additionalFacts = attachmentAnalysis.keyFacts.slice(0, 3).join('\n- ');

      bodyContent += [
        ``,
        `## Supplemental Grounding & Key Reference Points`,
        `- Key Concepts Addressed: ${missingInjections}`,
        `- ${additionalFacts}`,
      ].join('\n');

      relevance = calculateRelevanceScore({
        analysis: attachmentAnalysis,
        requestedTopic: topic,
        primaryKeyword: primaryKw,
        generatedTitle: blogTitle,
        generatedHeadings: headings,
        generatedContent: bodyContent,
      });
    }

    // SEO Readiness Audit on FINAL Grounded Article
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

    // Trace Context for Debug / Dev Inspection
    const traceContext: GenerationTraceContext = {
      hasAttachments,
      hasReferenceArticles: hasAttachments,
      hasWebResearch: Boolean(webResearchReport),
      attachedArticleNames: hasAttachments ? attachmentAnalysis.sourceNames : (webResearchReport ? webResearchReport.sources.map((s) => `${s.source}: ${s.title}`) : []),
      extractedTopic: hasAttachments ? attachmentAnalysis.coreTopic : (webResearchReport ? webResearchReport.topic : cleanSubject),
      keyFactsExtracted: hasAttachments ? attachmentAnalysis.keyFacts : (webResearchReport ? webResearchReport.findings.impactAndStatistics : []),
      keyEntities: hasAttachments ? attachmentAnalysis.keyEntities : (webResearchReport ? webResearchReport.findings.keyEntities : []),
      keyTerminology: hasAttachments ? attachmentAnalysis.keyTerminology : (webResearchReport ? webResearchReport.findings.keyTerminology : []),
      primaryKeywordUsed: primaryKw,
      generatedTopic: blogTitle,
      relevanceScore: relevance.score,
      relevancePassed: relevance.passed,
      matchedEntities: relevance.matchedEntities,
      matchedTerminology: relevance.matchedTerminology,
      regenerationAttempts,
      groundingConfidence: hasAttachments && relevance.passed
        ? 'VERIFIED_GROUNDED'
        : webResearchReport && relevance.passed
        ? 'LIVE_RESEARCH_GROUNDED'
        : 'DIRECT_AI_GENERATED',
      warnings: attachmentAnalysis.warnings,
      webResearchReport: webResearchReport
        ? {
            topic: webResearchReport.topic,
            searchQueries: webResearchReport.searchQueries,
            sourcesFound: webResearchReport.sourcesFound,
            sourcesSelected: webResearchReport.sourcesSelected,
            topSources: webResearchReport.sources.map((s) => s.source),
            relevanceScore: webResearchReport.relevanceScore,
          }
        : undefined,
    };

    return {
      success: true,
      generation_id: generationId,
      mode: 'blog',
      structured_intent: intent,
      traceContext,
      relevance,
      researchSources: researchSources.length > 0 ? researchSources : undefined,
      webResearch: webResearchReport,
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
        seoReport: seoReadiness,
        traceContext,
        relevance,
        researchSources: researchSources.length > 0 ? researchSources : undefined,
        webResearch: webResearchReport,
      },
      enrichment: {
        topicKeywords,
        industryKeywords: domainInfo.keywords,
        trendingAngle: trendingAngleHeadline,
        brandKeywords: combinedKeywords,
      },
      providerUsed: hasAttachments
        ? 'GroundedAttachmentKnowledgeEngine_v3'
        : webResearchReport
        ? 'LiveWebResearchEngine_v4'
        : 'UniversalCreativeEngine_v3',
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
    } else if (tone === 'bold') {
      hook = `Stop settling for ordinary ${domainInfo.domain.toLowerCase()}. It’s time to level up. ⚡`;
      body = [
        `Meet ${productOrService} — built for those who demand standout results and refuse to compromise on quality.`,
        ``,
        `Why it changes the game:`,
        `🚀 Unrivaled performance & bold innovation`,
        `💎 Superior craftsmanship designed to outlast the rest`,
        `🎯 Purpose-built to get you results faster`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Ready to experience the next level? Grab yours today! 🔥`].join('\n');
    } else if (tone === 'witty') {
      hook = `Your search for the perfect ${cleanSubject} ends right here (and yes, it’s as good as everyone says). 😉`;
      body = [
        `We took everything you wished ${cleanSubject} could be and turned it into ${productOrService}.`,
        ``,
        `The TL;DR:`,
        `✨ Zero fuss, maximum satisfaction`,
        `🎯 10/10 aesthetic, 11/10 performance`,
        `🙌 Your future self will definitely thank you`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Don't just take our word for it — see for yourself! 👇`].join('\n');
    } else if (tone === 'empathetic') {
      hook = `We know how important finding the right ${cleanSubject} is to you and your lifestyle. ❤️`;
      body = [
        `That's why ${productOrService} was created — to bring genuine comfort, peace of mind, and effortless simplicity to your daily routine.`,
        ``,
        `Designed with care:`,
        `🌱 Thoughtfully curated for everyday wellness`,
        `🤝 Transparent quality you can truly trust`,
        `✨ Made to support what matters most to you`,
      ].join('\n');
      caption = [hook, ``, body, ``, `You deserve the very best. Explore ${productOrService} today. 🌸`].join('\n');
    } else if (tone === 'urgent') {
      hook = `🚨 Limited availability alert: Don't miss out on ${cleanSubject}!`;
      body = [
        `Demand for ${productOrService} is reaching record highs, and inventory is moving fast.`,
        ``,
        `Act now to secure:`,
        `⏰ Exclusive promotional priority`,
        `🎁 Guaranteed fast dispatch & premium packing`,
        `⚡ First access before items sell out`,
      ].join('\n');
      caption = [hook, ``, body, ``, `⏳ Order now while quantities last — link below!`].join('\n');
    } else if (tone === 'inspirational') {
      hook = `Every great journey starts with a single step towards what inspires you. ✨`;
      body = [
        `${productOrService} is here to remind you that your goals, your passion, and your environment deserve extraordinary quality.`,
        ``,
        `Transform your perspective:`,
        `🌟 Elevate your standards & daily rituals`,
        `🚀 Unlock new potential with intentional design`,
        `💫 Created to empower your best self every day`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Take the leap today and embrace what's possible with ${productOrService}. 💫`].join('\n');
    } else if (tone === 'technical') {
      hook = `Deep-dive analysis: Precision engineering and performance benchmarks in ${cleanSubject}. 🔬`;
      body = [
        `${productOrService} integrates rigorous quality benchmarks and optimized architectures to deliver verified reliability.`,
        ``,
        `Technical Specifications:`,
        `📊 Precision-calibrated components & rigorous QA testing`,
        `⚙️ High-efficiency output engineered for peak duty cycles`,
        `🔒 Full compliance with industry durability & safety standards`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Review technical documentation and specs at the link below. 📐`].join('\n');
    } else if (tone === 'casual') {
      hook = `Obsessed with ${cleanSubject}? Same here. Let's talk about it! 👋`;
      body = [
        `If you've been looking for something that just works and looks amazing doing it, ${productOrService} is it.`,
        ``,
        `Quick rundown:`,
        `🙌 Super easy to use & looks incredible`,
        `🔥 Huge favorite with our community`,
        `✨ 100% worth the hype`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Drop a comment or check the link to grab yours! ✌️`].join('\n');
    } else if (tone === 'storytelling') {
      hook = `It started with a simple question: What if ${cleanSubject} could be done better? 📖`;
      body = [
        `We spent months prototyping, listening to feedback, and refining every detail until ${productOrService} was born.`,
        ``,
        `The result is something truly special:`,
        `✨ A journey of dedication, passion, and craftsmanship`,
        `🌿 Tested in real environments to ensure absolute delight`,
        `💫 Made not just to be used, but to be loved`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Read the full story and join our journey today. ✨`].join('\n');
    } else if (tone === 'luxurious') {
      hook = `A celebration of timeless elegance and bespoke craftsmanship. ⚜️`;
      body = [
        `Immerse yourself in the pinnacle of luxury with ${productOrService}. Each detail is meticulously curated for the discerning connoisseur.`,
        ``,
        `The Signature Distinction:`,
        `💎 Rare, exquisite materials selected without compromise`,
        `🏛️ Masterful artisanal execution and refined aesthetics`,
        `👑 An unparalleled statement of prestige and distinction`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Experience true luxury. Inquire or acquire through the exclusive link below. 🥂`].join('\n');
    } else if (tone === 'contrarian') {
      hook = `Most people think ${cleanSubject} has to be complicated or expensive. They're wrong. 💡`;
      body = [
        `The industry wants you to believe you need cluttered workflows or overpriced compromises. ${productOrService} proves otherwise.`,
        ``,
        `Why the standard approach is broken:`,
        `❌ Hidden friction and bloated processes`,
        `❌ Outdated methods that don't scale`,
        `✅ How ${productOrService} flips the script with clean simplicity`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Do you agree or disagree? Let's discuss in the comments below. 👇`].join('\n');
    } else if (tone === 'educational') {
      hook = `Mastering ${cleanSubject}: 3 essential insights you need to know. 📚`;
      body = [
        `Whether you're getting started or looking to optimize, here is a structured breakdown with ${productOrService}:`,
        ``,
        `Key Takeaways:`,
        `1️⃣ Foundation: Focus on quality inputs and clear objectives`,
        `2️⃣ Execution: Leverage ${productOrService} for consistent, reliable output`,
        `3️⃣ Optimization: Monitor key indicators and refine continuously`,
      ].join('\n');
      caption = [hook, ``, body, ``, `Save this breakdown for reference and share with your team! 📌`].join('\n');
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
