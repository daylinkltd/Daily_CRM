import { describe, it, expect } from 'vitest';
import {
  generateMarketingContent,
  buildDetailedImagePrompt,
  buildDetailedVideoPrompt,
  parseNaturalLanguageIntent,
  extractSubjectAndEntity,
} from './ai-generator';

describe('Universal AI Marketing Content Generator Suite', () => {
  // TEST 1: Handmade Vanilla Candle (Zero SaaS/DailyBuz Bias)
  it('TEST 1: generates handmade vanilla candle content with ZERO DailyBuz/SaaS/CRM references', async () => {
    const prompt = 'Promote a handmade vanilla candle for Instagram. Premium feminine style, target women aged 20-35, objective is sales.';
    const res = await generateMarketingContent({
      topic: prompt,
      platforms: ['instagram'],
      tone: 'creative',
      objective: 'Promotion & Sales',
      targetAudience: 'Women aged 20-35',
    });

    expect(res.success).toBe(true);
    expect(res.social).toBeDefined();

    const social = res.social!;
    const lowerCaption = social.caption.toLowerCase();
    const lowerImage = social.image_prompt.toLowerCase();
    const lowerVideo = social.video_prompt.toLowerCase();

    // Must be about candles/home fragrance
    expect(lowerCaption).toMatch(/candle|fragrance|vanilla|warmth|handcrafted/);
    expect(lowerImage).toMatch(/candle|amber glass|flame|scented/);
    expect(lowerVideo).toMatch(/candle|wick|flame|sensory/);

    // Must NEVER mention DailyBuz / CRM / SaaS / Workspace
    expect(lowerCaption).not.toContain('dailybuz');
    expect(lowerCaption).not.toContain('dailycrm');
    expect(lowerCaption).not.toContain('pipeline');
    expect(lowerCaption).not.toContain('software');
    expect(lowerImage).not.toContain('dailybuz');
    expect(lowerImage).not.toContain('workspace');
    expect(lowerVideo).not.toContain('dailybuz');
    expect(lowerVideo).not.toContain('spreadsheets');

    // Hashtags must be candle & lifestyle related
    expect(social.hashtags.some((h) => h.toLowerCase().includes('candle') || h.toLowerCase().includes('fragrance') || h.toLowerCase().includes('cozyliving'))).toBe(true);
  });

  // TEST 2: Pizza Restaurant Opening
  it('TEST 2: generates restaurant & food content for a pizza restaurant opening', async () => {
    const prompt = 'Create a post for a new pizza restaurant opening in Belgaum';
    const res = await generateMarketingContent({
      topic: prompt,
      platforms: ['instagram', 'facebook'],
    });

    expect(res.success).toBe(true);
    const social = res.social!;
    const lowerCaption = social.caption.toLowerCase();
    const lowerImage = social.image_prompt.toLowerCase();

    expect(lowerCaption).toMatch(/pizza|restaurant|belgaum|flavor|delicious|table/);
    expect(lowerImage).toMatch(/pizza|gourmet|dish|crust|restaurant/);
    expect(lowerCaption).not.toContain('dailybuz');
    expect(lowerCaption).not.toContain('crm');
  });

  // TEST 3: Real Estate Apartments
  it('TEST 3: generates real estate & architectural visual prompts for apartments', async () => {
    const prompt = 'Promote our luxury residential apartments with panoramic views';
    const res = await generateMarketingContent({
      topic: prompt,
      platforms: ['facebook', 'instagram'],
      tone: 'professional',
    });

    expect(res.success).toBe(true);
    const social = res.social!;
    expect(social.caption.toLowerCase()).toMatch(/apartment|living|residential|quality|home/);
    expect(social.image_prompt.toLowerCase()).toMatch(/apartment|architectural|panoramic|interior|living room/);
    expect(social.hashtags.some((h) => h.toLowerCase().includes('realestate') || h.toLowerCase().includes('apartment') || h.toLowerCase().includes('luxuryhomes'))).toBe(true);
  });

  // TEST 4: Fashion Summer Collection
  it('TEST 4: generates editorial fashion content for summer clothing collection', async () => {
    const prompt = 'Create an Instagram post about a summer clothing collection for women';
    const res = await generateMarketingContent({
      topic: prompt,
      platforms: ['instagram'],
      imageStyle: 'Editorial',
    });

    expect(res.success).toBe(true);
    const social = res.social!;
    expect(social.caption.toLowerCase()).toMatch(/clothing|collection|summer|style|wardrobe/);
    expect(social.image_prompt.toLowerCase()).toMatch(/fashion|collection|editorial|textile/);
  });

  // TEST 5: AI Automation / SaaS (Generated ONLY when explicitly requested)
  it('TEST 5: generates tech & automation content when AI/SaaS is explicitly requested', async () => {
    const prompt = 'Promote an AI automation service to small businesses on LinkedIn';
    const res = await generateMarketingContent({
      topic: prompt,
      platforms: ['linkedin'],
      tone: 'professional',
    });

    expect(res.success).toBe(true);
    const social = res.social!;
    expect(social.caption.toLowerCase()).toMatch(/automation|quality|service|business/);
    expect(social.image_prompt.toLowerCase()).toMatch(/technology|visual|automation/);
  });

  // TEST 6: User prompt takes strict precedence over tenant default brand
  it('TEST 6: user prompt entity overrides tenant brand name so DailyBuz is not forced into custom brands', async () => {
    const tenantBrand = {
      businessName: 'DailyBuz CRM Workspace',
      brandVoice: 'Fast-paced enterprise software',
      website: 'https://dailybuz.com',
    };

    const res = await generateMarketingContent({
      topic: 'Create a post for a handmade candle brand called Creative Crafter',
      brandContext: tenantBrand,
      platforms: ['instagram'],
    });

    const social = res.social!;
    const lowerCaption = social.caption.toLowerCase();
    const lowerImage = social.image_prompt.toLowerCase();

    // Must be about Creative Crafter candles
    expect(lowerCaption).toContain('creative crafter');
    expect(lowerImage).toContain('creative crafter');
    expect(lowerImage).toMatch(/candle|fragrance|natural/);
    expect(lowerCaption).not.toContain('dailybuz');
  });

  // TEST 7: Platform Aspect Ratio Guidelines
  it('TEST 7: adapts aspect ratios and camera recommendations per platform', () => {
    const instaPrompt = buildDetailedImagePrompt({
      topic: 'Handmade Vanilla Candle',
      platforms: ['instagram'],
      imageStyle: 'Product Photography',
    });
    expect(instaPrompt).toContain('1:1');
    expect(instaPrompt).toContain('Instagram mobile feed');

    const linkedinPrompt = buildDetailedImagePrompt({
      topic: 'AI Automation Services',
      platforms: ['linkedin'],
      imageStyle: 'Modern Tech',
    });
    expect(linkedinPrompt).toContain('1.91:1');
    expect(linkedinPrompt).toContain('LinkedIn');

    const tiktokPrompt = buildDetailedImagePrompt({
      topic: 'Summer Fashion Outfits',
      platforms: ['tiktok'],
      imageStyle: 'Lifestyle',
    });
    expect(tiktokPrompt).toContain('9:16');
  });

  // TEST 8: Granular Regeneration of Image Prompt Only
  it('TEST 8: regenerates ONLY the image prompt without altering human caption or video prompt', async () => {
    const existingCaption = 'Human-edited caption: Discover how our artisanal candles bring warmth to your home.';
    const existingVideoPrompt = 'Original video prompt 0-2s hook...';
    const existingHashtags = ['#CustomCandle1', '#CustomCandle2'];
    const existingCta = 'Special CTA link: https://example.com/candles';

    const res = await generateMarketingContent({
      topic: 'Handmade Lavender Candle',
      imageStyle: '3D',
      regenTarget: 'image_prompt_only',
      existingCaption,
      existingVideoPrompt,
      existingHashtags,
      existingCta,
      imagePromptVersion: 1,
    });

    expect(res.social?.caption).toBe(existingCaption);
    expect(res.social?.video_prompt).toBe(existingVideoPrompt);
    expect(res.social?.hashtags).toEqual(existingHashtags);
    expect(res.social?.cta).toBe(existingCta);
    expect(res.social?.image_prompt.toLowerCase()).toContain('3d');
    expect(res.social?.image_prompt_version).toBe(2);
  });

  // TEST 9: Granular Regeneration of Video Prompt Only
  it('TEST 9: regenerates ONLY the video prompt without altering caption or image prompt', async () => {
    const existingCaption = 'Custom caption that must not change.';
    const existingImagePrompt = 'Custom image prompt that must not change.';

    const res = await generateMarketingContent({
      topic: 'Gourmet Pizza Restaurant',
      videoStyle: 'Storytelling',
      regenTarget: 'video_prompt_only',
      existingCaption,
      existingImagePrompt,
      videoPromptVersion: 2,
    });

    expect(res.social?.caption).toBe(existingCaption);
    expect(res.social?.image_prompt).toBe(existingImagePrompt);
    expect(res.social?.video_prompt.toLowerCase()).toContain('storytelling');
    expect(res.social?.video_prompt_version).toBe(3);
  });

  // TEST 10: Multi-Platform (Instagram + LinkedIn) with platform-specific copy
  it('TEST 10: generates tailored platform copy for Instagram and LinkedIn simultaneously', async () => {
    const res = await generateMarketingContent({
      topic: 'Organic Herbal Teas and Wellness Infusions',
      platforms: ['instagram', 'linkedin'],
    });

    expect(res.social?.platform_specific).toBeDefined();
    const insta = res.social?.platform_specific.instagram;
    const linkedin = res.social?.platform_specific.linkedin;

    expect(insta).toBeDefined();
    expect(linkedin).toBeDefined();
    expect(insta?.formatNote).toContain('Visual-first');
    expect(linkedin?.formatNote).toContain('Professional');
    expect(insta?.caption).not.toEqual(linkedin?.caption);
  });

  // TEST 12: ATTACHMENT-FIRST CONTENT GENERATION (Nepal Flood Disaster Management vs Generic Nepal Keyword)
  it('TEST 12: generates an article grounded strictly in Nepal Flood Disaster Management when attached, ignoring generic Nepal travel/tourism keyword bias', async () => {
    const attachmentContent = `
# Nepal Monsoon Emergency & Flood Disaster Management Brief 2026
Recent torrential monsoon downpours across the Koshi, Gandaki, and Bagmati river basins have triggered widespread flash flooding and riverbank erosion in eastern and central Nepal.
Emergency disaster management teams, including the National Disaster Risk Reduction and Management Authority (NDRRMA) and armed police rescue squads, deployed motorized inflatable boats, high-capacity dewatering pumps, and satellite-based early warning sirens.
Over 45,000 residents across 14 vulnerable districts were relocated to community shelters with water purification kits, oral rehydration salts, and solar charging units.
Immediate priorities focus on strengthening hydrological monitoring stations, reinforcing river levees, and establishing pre-positioned medical relief hubs before secondary landslide risks escalate.
    `.trim();

    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Nepal Disaster Management Overview',
      primaryKeyword: 'Nepal', // Generic keyword that could easily drift into tourism
      referenceArticles: [
        {
          id: 'ref-1',
          name: 'nepal_flood_disaster_brief_2026.md',
          content: attachmentContent,
          source: 'file',
        },
      ],
      objective: 'Thought Leadership',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();
    const lowerTitle = blog.title.toLowerCase();

    // 1. MUST BE ABOUT FLOOD DISASTER MANAGEMENT
    expect(lowerContent).toMatch(/flood|disaster|emergency|relief|monsoon|ndrrma|rescue|shelter/i);
    expect(lowerTitle).toMatch(/disaster|flood|emergency|resilience|response/i);

    // 2. MUST NEVER DRIFT INTO TOURISM / TREKKING / SIGHTSEEING
    expect(lowerContent).not.toMatch(/himalayan trek|mount everest tour|kathmandu sightseeing|luxury hotel|travel packages/i);

    // 3. RELEVANCE SCORE AND TRACE CONTEXT VALIDATION
    expect(res.relevance).toBeDefined();
    expect(res.relevance?.score).toBeGreaterThanOrEqual(70);
    expect(res.relevance?.verdict).toMatch(/HIGHLY_GROUNDED|MODERATELY_GROUNDED/);
    expect(res.traceContext).toBeDefined();
    expect(res.traceContext?.hasReferenceArticles).toBe(true);
    expect(res.traceContext?.attachedArticleNames).toContain('nepal_flood_disaster_brief_2026.md');
    expect(res.traceContext?.extractedTopic.toLowerCase()).toContain('flood');

    // 4. SEO REPORT ON FINAL ARTICLE
    expect(res.blog?.seoReport).toBeDefined();
    expect(res.blog?.seoReport?.checks.length).toBeGreaterThan(0);
  });

  // TEST 13: MULTIPLE ATTACHMENTS FUSION
  it('TEST 13: fuses and synthesizes facts across multiple attached articles without dropping context', async () => {
    const docA = `
Source A: Logistics & Supply Chain Automation Protocols
Modern cold-chain pharmaceutical logistics requires IoT temperature dataloggers (operating between -20C and 4C) and automated warehouse sortation conveyor systems to prevent 18% spoilage rates.
    `.trim();

    const docB = `
Source B: Last-Mile Drone Delivery in Remote Terrains
Autonomous electric cargo drones with 15kg payload capacities and GPS-waypoint failover mechanisms reduce delivery turnaround times from 6 hours to 28 minutes in rugged valleys.
    `.trim();

    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Next-Gen Medical Logistics',
      primaryKeyword: 'Medical Logistics',
      referenceArticles: [
        { id: 'doc-1', name: 'cold_chain_iot.txt', content: docA, source: 'file' },
        { id: 'doc-2', name: 'drone_delivery.txt', content: docB, source: 'file' },
      ],
    });

    expect(res.success).toBe(true);
    const content = res.blog?.content.toLowerCase() || '';

    // Verify information from BOTH attachments is represented
    expect(content).toMatch(/cold-chain|temperature|iot|spoilage/i);
    expect(content).toMatch(/drone|cargo|payload|turnaround/i);
    expect(res.traceContext?.attachedArticleNames).toHaveLength(2);
    expect(res.relevance?.score).toBeGreaterThanOrEqual(70);
  });

  // TEST 14: CHANGING ATTACHMENT RADICALLY CHANGES GENERATED SUBJECT
  it('TEST 14: changing the attachment to a completely different subject causes the generated article to follow the new subject', async () => {
    const spaceAttachment = `
# James Webb Deep Field Exoplanet Spectroscopy
Astronomers analyzing transit transmission spectra from the James Webb Space Telescope (JWST) have detected atmospheric carbon dioxide, methane, and sulfur dioxide on exoplanet WASP-39b, confirming photochemical atmospheric processes.
    `.trim();

    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Space Exploration Discoveries',
      primaryKeyword: 'Discoveries',
      referenceArticles: [{ id: 'jwst-1', name: 'exoplanet_spectroscopy.md', content: spaceAttachment, source: 'file' }],
    });

    expect(res.success).toBe(true);
    expect(res.blog?.content.toLowerCase()).toMatch(/wasp-39b|jwst|spectroscopy|exoplanet|atmosphere/i);
    expect(res.blog?.content.toLowerCase()).not.toMatch(/flood|koshi|monsoon|medical logistics/i);
  });

  // TEST 15: FALLBACK WARNING WHEN ATTACHMENT IS EMPTY OR UNREADABLE
  it('TEST 15: produces clear warning when an attachment has empty content and falls back cleanly', async () => {
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Organic Herbal Teas',
      referenceArticles: [{ id: 'empty-1', name: 'corrupted_file.pdf', content: '   ', source: 'file' }],
    });

    expect(res.success).toBe(true);
    expect(res.traceContext?.warnings.length).toBeGreaterThan(0);
    expect(res.traceContext?.warnings[0]).toContain('corrupted_file.pdf');
  });

  // =========================================================================
  // LIVE WEB RESEARCH PIPELINE TESTS (ZERO CRM CONTAMINATION)
  // =========================================================================

  // TEST 16: TOPIC "Nepal flood" -> Real Live Web Research, Zero CRM Bias
  it('TEST 16: generates article on "Nepal flood" using real web research with ZERO Daily CRM / product contamination', async () => {
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Nepal flood',
      brandContext: {
        businessName: 'Daily CRM Workspace',
        productsOrServices: 'CRM and sales automation tools',
      },
      objective: 'Awareness',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();
    const lowerTitle = blog.title.toLowerCase();

    // 1. MUST be about Nepal flood / disaster / emergency / rescue / monsoon
    expect(lowerTitle).toMatch(/nepal|flood|monsoon|disaster|emergency/i);
    expect(lowerContent).toMatch(/nepal|flood|monsoon|rescue|relief|emergency|disaster/i);

    // 2. MUST NOT contain Daily CRM / DailyBuz / Daylink / CRM product contamination
    expect(lowerContent).not.toContain('daily crm');
    expect(lowerContent).not.toContain('dailycrm');
    expect(lowerContent).not.toContain('dailybuz');
    expect(lowerContent).not.toContain('sales pipeline');
    expect(lowerContent).not.toContain('unbox');
    expect(lowerTitle).not.toContain('daily crm');

    // 3. MUST contain research sources with real publications and valid URLs
    expect(blog.researchSources).toBeDefined();
    expect(blog.researchSources!.length).toBeGreaterThan(0);
    expect(lowerContent).toContain('## 7. sources & references');
    expect(blog.researchSources!.some((s) => s.url.startsWith('http'))).toBe(true);

    // 4. Trace context must expose live research details
    expect(res.traceContext).toBeDefined();
    expect(res.traceContext?.hasWebResearch).toBe(true);
    expect(res.traceContext?.webResearchReport).toBeDefined();
    expect(res.traceContext?.webResearchReport?.searchQueries.length).toBeGreaterThan(0);
    expect(res.traceContext?.webResearchReport?.sourcesSelected).toBeGreaterThan(0);
    expect(res.traceContext?.relevanceScore).toBeGreaterThanOrEqual(70);
  });

  // TEST 17: TOPIC "AI trends in healthcare" -> Real AI + Healthcare Research
  it('TEST 17: generates article on "AI trends in healthcare" with real clinical tech sources and ZERO CRM content', async () => {
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'AI trends in healthcare',
      brandContext: {
        businessName: 'Daily CRM Technologies',
      },
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();
    const lowerTitle = blog.title.toLowerCase();

    // 1. MUST be about AI & Healthcare
    expect(lowerTitle).toMatch(/ai|artificial intelligence|healthcare|clinical/i);
    expect(lowerContent).toMatch(/healthcare|clinical|diagnostic|medical|patient|algorithm/i);

    // 2. Zero CRM contamination
    expect(lowerContent).not.toContain('daily crm');
    expect(lowerContent).not.toContain('pipeline');

    // 3. Real sources attached
    expect(blog.researchSources).toBeDefined();
    expect(blog.researchSources!.length).toBeGreaterThan(0);
  });

  // TEST 18: TOPIC "Best practices for e-commerce SEO" -> Real E-Commerce SEO Research
  it('TEST 18: generates article on "Best practices for e-commerce SEO" with zero Nepal flood or CRM contamination', async () => {
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Best practices for e-commerce SEO',
      brandContext: {
        businessName: 'Daily CRM Workspace',
      },
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();

    // 1. Must be about SEO / E-commerce
    expect(lowerContent).toMatch(/seo|search|ranking|crawl|e-commerce|keyword/i);

    // 2. Zero Nepal flood or Daily CRM contamination
    expect(lowerContent).not.toContain('nepal flood');
    expect(lowerContent).not.toContain('monsoon');
    expect(lowerContent).not.toContain('daily crm');
  });

  // TEST 19: TOPIC "Daily CRM" -> Branded research ONLY when explicitly requested
  it('TEST 19: includes Daily CRM research context when user explicitly queries "Daily CRM"', async () => {
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: 'Daily CRM',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();
    expect(res.blog?.title.toLowerCase()).toContain('daily crm');
  });

  // TEST 20: AI GENERATE MODE (Offline Capable, Zero Web Search)
  it('TEST 20: generates article in AI Generate mode WITHOUT calling web search (100% offline capable)', async () => {
    const topic = 'How Artificial Intelligence Is Transforming Small Businesses in 2026';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic,
      generationMode: 'ai_generate',
      objective: 'Thought Leadership',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();

    // 1. Must be about AI & Small Businesses in 2026
    expect(lowerContent).toMatch(/artificial intelligence|small business|framework|strategy|automation/i);

    // 2. No web research sources attached in direct AI Generate mode
    expect(res.traceContext?.hasWebResearch).toBe(false);
    expect(blog.researchSources).toBeUndefined();

    // 3. Headings and SEO report present
    expect(blog.headings.length).toBeGreaterThanOrEqual(4);
    expect(blog.seoReport).toBeDefined();
    expect(blog.seoReport?.score).toBeGreaterThan(60);

    // 4. Zero CRM contamination
    expect(lowerContent).not.toContain('daily crm');
    expect(lowerContent).not.toContain('dailycrm');
    expect(lowerContent).not.toContain('dailybuz');
  });

  // TEST 21: WEB RESEARCH MODE on "How Artificial Intelligence Is Transforming Small Businesses in 2026"
  it('TEST 21: retrieves real web sources and generates article on "How Artificial Intelligence Is Transforming Small Businesses in 2026"', async () => {
    const topic = 'How Artificial Intelligence Is Transforming Small Businesses in 2026';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic,
      generationMode: 'web_research',
      objective: 'Thought Leadership',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();
    const lowerTitle = blog.title.toLowerCase();

    // 1. Must be about AI & small businesses
    expect(lowerTitle).toMatch(/artificial intelligence|ai|small business/i);
    expect(lowerContent).toMatch(/artificial intelligence|automation|business|efficiency|tools|growth/i);

    // 2. Real sources must be found and attached (at least 1, preferred 3-6)
    expect(blog.researchSources).toBeDefined();
    expect(blog.researchSources!.length).toBeGreaterThanOrEqual(1);
    expect(blog.researchSources![0].url.startsWith('http')).toBe(true);
    expect(blog.researchSources![0].title.length).toBeGreaterThan(5);

    // 3. Trace context details
    expect(res.traceContext?.hasWebResearch).toBe(true);
    expect(res.traceContext?.webResearchReport?.sourcesSelected).toBeGreaterThanOrEqual(1);

    // 4. Zero CRM contamination
    expect(lowerContent).not.toContain('daily crm');
    expect(lowerContent).not.toContain('dailycrm');
  });

  // TEST 22: WEB RESEARCH MODE on "Tata Group"
  it('TEST 22: retrieves real web sources on "Tata Group" with zero CRM contamination', async () => {
    const topic = 'Tata Group';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic,
      generationMode: 'web_research',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    const lowerContent = blog.content.toLowerCase();
    const lowerTitle = blog.title.toLowerCase();

    // 1. Must be about Tata Group
    expect(lowerTitle).toContain('tata group');
    expect(lowerContent).toContain('tata group');

    // 2. Real sources retrieved
    expect(blog.researchSources).toBeDefined();
    expect(blog.researchSources!.length).toBeGreaterThanOrEqual(1);
    expect(blog.researchSources!.some((s) => s.title.toLowerCase().includes('tata') || s.source.toLowerCase().includes('tata') || s.url.includes('tata') || s.source.length > 0)).toBe(true);

    // 3. Zero CRM contamination
    expect(lowerContent).not.toContain('daily crm');
  });

  // TEST 23: WEB RESEARCH MODE on "artificial intelligence business"
  it('TEST 23: retrieves real web sources on "artificial intelligence business"', async () => {
    const topic = 'artificial intelligence business';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic,
      generationMode: 'web_research',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    expect(blog.researchSources).toBeDefined();
    expect(blog.researchSources!.length).toBeGreaterThanOrEqual(1);
    expect(blog.content.toLowerCase()).toMatch(/artificial intelligence|ai|business|automation/i);
  });
});

