import { describe, it, expect } from 'vitest';
import {
  generateMarketingContent,
  buildDetailedImagePrompt,
  buildDetailedVideoPrompt,
  parseNaturalLanguageIntent,
  extractSubjectAndEntity,
  extractCreativeIntent,
  extractValuePropositionsAndServices,
  isValidBrandName,
  normalizeAssetPublicUrl,
  validateAndSanitizePrompt,
  resolveAssetPublicUrl,
  validateAssetUrlAccessibility,
  validateCreativePromptQA,
  stripLegalCompanySuffix,
  parseCreativeType,
  resolveBrandIdentity,
  parseDynamicCreativeIntent,
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
    expect(instaPrompt).toContain('4:5');
    expect(instaPrompt).toContain('Instagram 4:5 vertical');

    const linkedinPrompt = buildDetailedImagePrompt({
      topic: 'AI Automation Services',
      platforms: ['linkedin'],
      imageStyle: 'Modern Tech',
    });
    expect(linkedinPrompt).toContain('1.91:1');
    expect(linkedinPrompt).toContain('Linkedin');

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

  // TEST 24: "how to set up a tech compney" -> Normalizes spelling, produces 17-step practical guide, zero fake numbers
  it('TEST 24: normalizes "how to set up a tech compney" into authoritative 17-step guide with zero fake metrics', async () => {
    const rawInput = 'how to set up a tech compney';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: rawInput,
      generationMode: 'ai_generate',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;

    // 1. Normalized title without spelling errors
    expect(blog.title).toBe('How to Set Up a Tech Company: A Practical Step-by-Step Guide');
    expect(blog.title.toLowerCase()).not.toContain('compney');
    expect(blog.slug).toContain('how-to-set-up-a-tech-company');

    // 2. Structured 17-step headings
    expect(blog.headings.length).toBeGreaterThanOrEqual(15);
    const headingTexts = blog.headings.map((h) => h.text.toLowerCase()).join(' | ');

    expect(headingTexts).toContain('problem');
    expect(headingTexts).toContain('market validation');
    expect(headingTexts).toContain('legal business structure');
    expect(headingTexts).toContain('incorporation');
    expect(headingTexts).toContain('founder agreements');
    expect(headingTexts).toContain('banking');
    expect(headingTexts).toContain('intellectual property');
    expect(headingTexts).toContain('mvp');
    expect(headingTexts).toContain('technology infrastructure');
    expect(headingTexts).toContain('funding');
    expect(headingTexts).toContain('hire');
    expect(headingTexts).toContain('go-to-market');
    expect(headingTexts).toContain('compliance');
    expect(headingTexts).toContain('pitfalls');
    expect(headingTexts).toContain('launch checklist');
    expect(headingTexts).toContain('frequently asked questions');
    expect(headingTexts).toContain('sources');

    // 3. No fake metric dumps (e.g. "Key recorded data points & metrics: 26, 2025, 28, 039")
    expect(blog.content).not.toMatch(/Key recorded data points & metrics:\s*\d+/);
    expect(blog.content).not.toContain('Technological Breakthroughs & Core Drivers');
    expect(blog.content).not.toContain('Governance & Strategic Response');
    expect(blog.content).not.toContain('compney');

    // 4. Practical content verification
    expect(blog.content).toContain('Private Limited Company');
    expect(blog.content).toContain('C-Corporation');
    expect(blog.content).toContain('Minimum Viable Product');
    expect(blog.content).toContain('Four-Year Vesting');
  });

  // TEST 25: "how to start a candle business" -> Step-by-step practical guide
  it('TEST 25: generates practical how-to guide for "how to start a candle business"', async () => {
    const rawInput = 'how to start a candle business';
    const res = await generateMarketingContent({
      contentType: 'blog',
      topic: rawInput,
      generationMode: 'ai_generate',
    });

    expect(res.success).toBe(true);
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    expect(blog.title).toBe('How to Start a Candle Business: A Practical Step-by-Step Guide');
    expect(blog.headings.length).toBeGreaterThanOrEqual(15);
    expect(blog.content).toContain('Minimum Viable Product');
    expect(blog.content).not.toContain('compney');
  });

  // TEST 26: Intelligent AI Brand Asset Selection & Filtering
  it('TEST 26: selects relevant brand assets and filters out irrelevant ones', async () => {
    const brandAssets = [
      {
        id: 'asset_logo',
        name: 'Primary Brand Logo',
        category: 'LOGOS' as const,
        sub_category: 'Primary Logo',
        public_url: 'https://cdn.example.com/tenant123/brand/logo.png',
        description: 'Primary vector logo mark in white and gold',
      },
      {
        id: 'asset_candle',
        name: 'Vanilla Scented Candle',
        category: 'PRODUCTS' as const,
        sub_category: 'Product Photos',
        public_url: 'https://cdn.example.com/tenant123/assets/vanilla-candle.png',
        description: 'Main handmade vanilla scented candle with luxury label in studio lighting',
      },
      {
        id: 'asset_app_ui',
        name: 'Mobile App Dashboard Screen',
        category: 'UI_DIGITAL' as const,
        sub_category: 'App Screenshots',
        public_url: 'https://cdn.example.com/tenant123/assets/app-ui.png',
        description: 'Mobile application interface showing customer metrics',
      },
      {
        id: 'asset_founder',
        name: 'Founder Portrait',
        category: 'PEOPLE' as const,
        sub_category: 'Founder Photos',
        public_url: 'https://cdn.example.com/tenant123/assets/founder-portrait.png',
        description: 'Professional headshot of the company founder',
      },
    ];

    // Case A: Product post for handmade candle
    const candleRes = await generateMarketingContent({
      topic: 'Create an Instagram post promoting our new vanilla scented candle',
      platforms: ['instagram'],
      brandAssets,
    });

    expect(candleRes.success).toBe(true);
    const candleSocial = candleRes.social!;
    expect(candleSocial.selected_assets).toBeDefined();
    const candleSelectedIds = candleSocial.selected_assets!.map((a) => a.id);

    expect(candleSelectedIds).toContain('asset_logo');
    expect(candleSelectedIds).toContain('asset_candle');
    expect(candleSelectedIds).not.toContain('asset_app_ui');
    expect(candleSelectedIds).not.toContain('asset_founder');

    // Case B: Founder Announcement post
    const founderRes = await generateMarketingContent({
      topic: 'Create a founder announcement post celebrating our milestone',
      platforms: ['linkedin'],
      brandAssets,
    });

    expect(founderRes.success).toBe(true);
    const founderSelectedIds = founderRes.social!.selected_assets!.map((a) => a.id);
    expect(founderSelectedIds).toContain('asset_logo');
    expect(founderSelectedIds).toContain('asset_founder');
    expect(founderSelectedIds).not.toContain('asset_candle');

    // Case C: Mobile Application post
    const appRes = await generateMarketingContent({
      topic: 'Announcing the launch of our new mobile application',
      platforms: ['instagram'],
      brandAssets,
    });

    expect(appRes.success).toBe(true);
    const appSelectedIds = appRes.social!.selected_assets!.map((a) => a.id);
    expect(appSelectedIds).toContain('asset_logo');
    expect(appSelectedIds).toContain('asset_app_ui');
    expect(appSelectedIds).not.toContain('asset_candle');
    expect(appSelectedIds).not.toContain('asset_founder');
  });

  // TEST 27: Public Asset URLs Referenced in Image and Video Prompts
  it('TEST 27: builds image and video prompts referencing public asset URLs with explicit usage', async () => {
    const brandAssets = [
      {
        id: 'logo_1',
        name: 'Lumina Brand Logo',
        category: 'LOGOS' as const,
        public_url: 'https://storage.example.com/tenant123/assets/logo.png',
      },
      {
        id: 'product_1',
        name: 'Vanilla Scented Candle',
        category: 'PRODUCTS' as const,
        public_url: 'https://storage.example.com/tenant123/assets/vanilla-candle.png',
      },
    ];

    const res = await generateMarketingContent({
      topic: 'Create an Instagram post promoting our new vanilla scented candle',
      platforms: ['instagram'],
      brandAssets,
    });

    expect(res.success).toBe(true);
    const social = res.social!;

    // Image Prompt verification
    expect(social.image_prompt).toContain('https://storage.example.com/tenant123/assets/vanilla-candle.png');
    expect(social.image_prompt).toContain('https://storage.example.com/tenant123/assets/logo.png');
    expect(social.image_prompt).toContain('PRODUCT REFERENCE IMAGE:');
    expect(social.image_prompt).toContain('PRIMARY REFERENCE IMAGE:');
    expect(social.image_prompt).toContain('LOGO PRESERVATION:');

    // Video Prompt verification
    expect(social.video_prompt).toContain('https://storage.example.com/tenant123/assets/vanilla-candle.png');
    expect(social.video_prompt).toContain('https://storage.example.com/tenant123/assets/logo.png');
    expect(social.video_prompt).toContain('Scene 1 — 0–2 seconds:');
    expect(social.video_prompt).toContain('Scene 2 — 2–5 seconds:');
    expect(social.video_prompt).toContain('Scene 3 — 5–8 seconds:');
    expect(social.video_prompt).toContain('Scene 4 — 8–10 seconds:');
  });

  // TEST 28: Universal Generation Across 6 Distinct Industries (Zero DailyBuz / CRM Pollution)
  it('TEST 28: verifies universal content across 6 industries with ZERO DailyBuz/CRM injection', async () => {
    const testCases = [
      {
        industry: 'Candles',
        prompt: 'Create an Instagram post for a premium handmade candle',
        expectedTerms: ['candle', 'fragrance', 'handcrafted', 'flame'],
      },
      {
        industry: 'AI Automation',
        prompt: 'Create a LinkedIn post promoting an AI automation service for logistics',
        expectedTerms: ['automation', 'logistics', 'efficiency', 'ai'],
      },
      {
        industry: 'Pizza Restaurant',
        prompt: 'Create an Instagram Reel announcing our new wood-fired pizza restaurant',
        expectedTerms: ['pizza', 'restaurant', 'wood-fired', 'dough'],
      },
      {
        industry: 'Sneakers',
        prompt: 'Create a product launch post for a limited edition running sneaker',
        expectedTerms: ['sneaker', 'running', 'footwear', 'cushion'],
      },
      {
        industry: 'Real Estate',
        prompt: 'Create a real estate advertisement for luxury waterfront apartments',
        expectedTerms: ['waterfront', 'apartments', 'luxury', 'living'],
      },
      {
        industry: 'Mobile App',
        prompt: 'Create a post announcing our new mobile app for personal fitness tracking',
        expectedTerms: ['fitness', 'mobile app', 'tracking', 'workout'],
      },
    ];

    for (const tc of testCases) {
      const res = await generateMarketingContent({
        topic: tc.prompt,
        platforms: ['instagram'],
      });

      expect(res.success).toBe(true);
      const social = res.social!;
      const fullText = `${social.caption} ${social.image_prompt} ${social.video_prompt}`.toLowerCase();

      // Verify industry relevance
      const hasExpected = tc.expectedTerms.some((term) => fullText.includes(term.toLowerCase()));
      expect(hasExpected, `Industry ${tc.industry} missing terms: ${tc.expectedTerms.join(', ')}`).toBe(true);

      // Verify NO DailyBuz / CRM leakage
      expect(fullText).not.toContain('dailybuz');
      expect(fullText).not.toContain('dailycrm');
      if (tc.industry !== 'AI Automation') {
        expect(fullText).not.toContain('sales pipeline');
        expect(fullText).not.toContain('customer conversations');
      }
    }
  });

  // TEST 29: Independent Prompt Regeneration
  it('TEST 29: regenerates ONLY image prompt when regenTarget is image_prompt_only', async () => {
    const originalCaption = 'Original handmade candle caption that must remain untouched.';
    const originalVideoPrompt = 'Original video script 0-10s that must remain untouched.';

    const res = await generateMarketingContent({
      topic: 'Create an Instagram post for our vanilla scented candle',
      platforms: ['instagram'],
      existingCaption: originalCaption,
      existingVideoPrompt: originalVideoPrompt,
      imagePromptVersion: 1,
      regenTarget: 'image_prompt_only',
    });

    expect(res.success).toBe(true);
    const social = res.social!;

    // Caption and Video Prompt are preserved
    expect(social.caption).toBe(originalCaption);
    expect(social.video_prompt).toBe(originalVideoPrompt);

    // Image prompt version is incremented
    expect(social.image_prompt_version).toBe(2);
    expect(social.image_prompt).toContain('vanilla scented candle');
  });

  // TEST 30: Semantic parsing of conversational DailyBuz user request without verbatim sentence leakage
  it('TEST 30: parses conversational DailyBuz request semantically and prevents verbatim sentence leakage in prompt subject', () => {
    const rawUserRequest =
      'I want to create a detailed DailyBuz marketing post using the updated logo as the primary brand reference. The generated content and creative should accurately reflect the updated logo and brand identity.';

    const parsed = extractSubjectAndEntity(rawUserRequest);

    // Brand and digital classification
    expect(parsed.extractedBrand).toBe('DailyBuz');
    expect(parsed.isSaaSOrDigital).toBe(true);
    expect(parsed.hasPhysicalProduct).toBe(false);
    expect(parsed.productName).toBeNull();

    // Subject must be concise, NOT the whole conversational sentence
    expect(parsed.cleanSubject.toLowerCase()).not.toContain('i want to create');
    expect(parsed.cleanSubject.toLowerCase()).not.toContain('the generated content and creative should accurately reflect');
    expect(parsed.cleanSubject.toLowerCase()).toContain('dailybuz');
  });

  // TEST 31: DailyBuz SaaS Creative Direction (Zero physical product photography or packaging details)
  it('TEST 31: generates a premium SaaS technology creative prompt for DailyBuz without physical product hallucinations', () => {
    const rawUserRequest =
      'I want to create a detailed DailyBuz marketing post using the updated logo as the primary brand reference. The generated content and creative should accurately reflect the updated logo and brand identity.';

    const logoAsset = {
      id: 'asset_dailybuz_logo_001',
      name: 'DailyBuz Official Logo',
      category: 'LOGOS' as const,
      public_url: 'https://cdn.dailybuz.com/assets/tenant_123/dailybuz-logo.png',
      usageInstruction: 'Primary brand reference logo',
      relevanceScore: 100,
    };

    const prompt = buildDetailedImagePrompt({
      topic: rawUserRequest,
      platforms: ['instagram'],
      selectedAssets: [logoAsset],
      objective: 'Promotion & Sales',
      targetAudience: 'Discerning customers, passionate enthusiasts, and quality-focused buyers',
    });

    // 1. Must contain header and brand
    expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM MARKETING POST FOR DAILYBUZ.');
    expect(prompt).toContain('BRAND:\nDailyBuz');

    // 2. Must cite the real public URL and strict preservation rules
    expect(prompt).toContain('https://cdn.dailybuz.com/assets/tenant_123/dailybuz-logo.png');
    expect(prompt).toContain('PRIMARY REFERENCE IMAGE:');
    expect(prompt).toContain('LOGO PRESERVATION:');
    expect(prompt).toContain('Do not recreate, redesign, recolor, distort, stretch, modify, replace or generate a new version of the logo.');

    // 3. Must specify modern SaaS / AI CRM visual direction
    expect(prompt).toContain('CREATIVE DIRECTION:\nCreate a sophisticated premium SaaS environment');
    expect(prompt).toContain('modern software dashboard with elegant CRM');
    expect(prompt).toContain('VISUAL STYLE:\nPremium enterprise SaaS.');

    // 4. Must NOT hallucinate physical product photography or packaging
    const lowerPrompt = prompt.toLowerCase();
    expect(lowerPrompt).not.toContain('product photography');
    expect(lowerPrompt).not.toContain('product packaging');
    expect(lowerPrompt).not.toContain('packaging details');
    expect(lowerPrompt).not.toContain('tactile product aesthetics');
    expect(lowerPrompt).not.toContain('i want to create a detailed dailybuz marketing post');

    // 5. Must NOT contain HTML tags
    expect(prompt).not.toMatch(/<[^>]*>/);
  });

  // TEST 32: Video prompt structure for DailyBuz with 0-10s timeline and logo closing card
  it('TEST 32: generates a structured 0-10s video prompt for DailyBuz citing the authentic logo reference', () => {
    const rawUserRequest =
      'Create a DailyBuz video post announcing our new AI automation features';

    const logoAsset = {
      id: 'asset_dailybuz_logo_001',
      name: 'DailyBuz Official Logo',
      category: 'LOGOS' as const,
      public_url: 'https://cdn.dailybuz.com/assets/tenant_123/dailybuz-logo.png',
      usageInstruction: 'Primary brand reference logo',
      relevanceScore: 100,
    };

    const videoPrompt = buildDetailedVideoPrompt({
      topic: rawUserRequest,
      platforms: ['instagram'],
      selectedAssets: [logoAsset],
      objective: 'Promotion & Sales',
      videoStyle: 'Cinematic',
    });

    expect(videoPrompt).toContain('CREATE A 10-SECOND CINEMATIC PROMOTIONAL VIDEO FOR DAILYBUZ');
    expect(videoPrompt).toContain('https://cdn.dailybuz.com/assets/tenant_123/dailybuz-logo.png');
    expect(videoPrompt).toContain('Chronological Sequence (0–10s)');
    expect(videoPrompt).toContain('0–2s (Opening Hook)');
    expect(videoPrompt).toContain('8–10s (Outro & CTA)');
    expect(videoPrompt).not.toContain('product packaging');
    expect(videoPrompt).not.toMatch(/<[^>]*>/);
  });

  // TEST 33: Daylink Tech Labs brand extraction & value propositions separation
  it('TEST 33: resolves Daylink Tech Labs brand and separates value propositions without contamination', () => {
    const userInput =
      'Create a marketing post for Daylink Tech Labs to promote our AI & automation platform that helps businesses build intelligent software and automate repetitive work';

    const intent = extractCreativeIntent(userInput, {
      platform: 'instagram',
      objective: 'Promotion & Sales',
      targetAudience: 'Engineering leaders, founders, and product teams',
    });

    expect(intent.brand_name).toBe('Daylink Tech Labs');
    expect(intent.brand_name).not.toBe('build intelligent software');
    expect(intent.brand_name).not.toBe('automate repetitive work');

    expect(intent.value_propositions).toContain('build intelligent software');
    expect(intent.value_propositions).toContain('automate repetitive work');
    expect(intent.creative_category).toBe('SaaS / Technology Marketing');
    expect(intent.visual_style).toBe('Premium Enterprise SaaS');

    const vpServices = extractValuePropositionsAndServices(userInput);
    expect(vpServices.services).toContain('AI & Automation');
    expect(vpServices.valuePropositions).toContain('build intelligent software');
    expect(vpServices.valuePropositions).toContain('automate repetitive work');
  });

  // TEST 34: Absolute HTTPS public URL verification and relative URL normalization
  it('TEST 34: normalizes relative asset paths to absolute HTTPS URLs and rejects localhost', () => {
    const relativeUrl = '/uploads/marketing/assets/tenant_abc/logo.png';
    const normalized = normalizeAssetPublicUrl(relativeUrl);
    expect(normalized.startsWith('https://') || normalized.startsWith('http://')).toBe(true);
    expect(normalized).not.toContain('localhost');
    expect(normalized).toContain('/uploads/marketing/assets/tenant_abc/logo.png');

    const fullHttpsUrl = 'https://cdn.customcdn.com/assets/logo.png';
    expect(normalizeAssetPublicUrl(fullHttpsUrl)).toBe(fullHttpsUrl);
  });

  // TEST 35: PRIMARY BRAND ASSET structure and logo compositing directives
  it('TEST 35: renders PRIMARY BRAND ASSET block and production logo compositing directives', () => {
    const logoAsset = {
      id: 'asset_daylink_001',
      name: 'Daylink Tech Labs Official Logo',
      category: 'LOGOS' as const,
      public_url: '/uploads/marketing/assets/tenant_1/logo.png',
      usageInstruction: 'Primary official logo',
      relevanceScore: 100,
    };

    const prompt = buildDetailedImagePrompt({
      topic: 'Daylink Tech Labs intelligent automation platform',
      platforms: ['instagram'],
      selectedAssets: [logoAsset],
    });

    expect(prompt).toContain('PRIMARY REFERENCE IMAGE:');
    expect(prompt).toContain('REFERENCE ASSET TYPE:\nOfficial Company Logo');
    expect(prompt).toContain('BRAND:\nDaylink Tech Labs');
    expect(prompt).toContain('https://');
    expect(prompt).toContain('LOGO PRESERVATION:');
    expect(prompt).toContain('Do not recreate, redesign, recolor, distort, stretch, modify, replace or generate a new version of the logo.');
    expect(prompt).not.toMatch(/(?:^|\s)\/uploads\//); // Must not be a bare relative path
  });

  // TEST 36: SaaS / Technology Marketing classification without Product Photography
  it('TEST 36: classifies SaaS platforms under SaaS / Technology Marketing and never Product Photography', () => {
    const prompt = buildDetailedImagePrompt({
      topic: 'Daylink Tech Labs modern cloud automation platform for developers',
      platforms: ['linkedin'],
    });

    expect(prompt.toLowerCase()).not.toContain('style: product photography');
    expect(prompt).toContain('VISUAL STYLE:\nPremium enterprise SaaS.');
    expect(prompt).toContain('CREATIVE DIRECTION:\nCreate a sophisticated premium SaaS environment');
  });

  // --------------------------------------------------------------------------
  // PRODUCTION VALIDATION SUITE: 15 Core Acceptance Tests for Daylink Tech Labs
  // --------------------------------------------------------------------------
  const sampleUserRequest =
    'Create a premium Instagram marketing creative for Daylink Tech Labs promoting our AI & Automation services. Use the uploaded Daylink Tech Labs logo as the primary brand reference and keep the logo exactly unchanged. The visual should communicate that Daylink Tech Labs helps businesses automate repetitive work, build intelligent software solutions and improve productivity using AI. Target audience: startups, small and medium businesses and technology-driven companies. Modern premium SaaS/technology aesthetic, strong visual hierarchy, clean composition, subtle AI and automation elements, professional enterprise feel. Instagram 4:5 vertical. Keep text minimal and leave negative space. Do not invent statistics, customer logos or claims.';

  const sampleDbLogoAsset = {
    id: 'ab6095d0-aa86-4328-934b-d56f26d8d7d8',
    name: 'Daylink Tech Labs Logo',
    category: 'LOGOS' as const,
    sub_category: 'Primary Official Logo',
    description: 'Authoritative official vector brand logo for Daylink Tech Labs',
    storage_path: '/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png',
    public_url: '/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png',
    mime_type: 'image/png',
    usageInstruction: 'Use as authoritative primary official brand logo',
    relevanceScore: 100,
  };

  // TEST 1: Uploaded PNG logo -> public URL resolution
  it('PRODUCTION TEST 1: resolves uploaded relative logo storage path to absolute production HTTPS URL', () => {
    const resolved = resolveAssetPublicUrl(sampleDbLogoAsset);
    expect(resolved.publicUrl).toBe(
      'https://dailybuz.com/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png'
    );
    expect(resolved.publicUrl.startsWith('https://')).toBe(true);
    expect(resolved.storagePath).toBe(
      '/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png'
    );
    expect(resolved.publicUrl).not.toContain('localhost');
  });

  // TEST 2: Public URL -> HTTP accessibility validation
  it('PRODUCTION TEST 2: verifies public HTTPS URL format, HTTP status and image/png MIME type', async () => {
    const resolved = resolveAssetPublicUrl(sampleDbLogoAsset);
    const report = await validateAssetUrlAccessibility(resolved.publicUrl, {
      id: sampleDbLogoAsset.id,
      name: sampleDbLogoAsset.name,
    });

    expect(report.accessible).toBe(true);
    expect(report.status).toBe(200);
    expect(report.contentType).toMatch(/image\/png|image\//);
    expect(report.publicUrl.startsWith('https://')).toBe(true);
  });

  // TEST 3: Asset -> image reference passed to generation system
  it('PRODUCTION TEST 3: attaches resolved reference asset to generated image prompt structure', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).toContain('PRIMARY REFERENCE IMAGE:');
    expect(prompt).toContain('https://dailybuz.com/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png');
    expect(prompt).toContain('REFERENCE ASSET TYPE:\nOfficial Company Logo');
    expect(prompt).toContain('REFERENCE ASSET:\nOfficial Daylink Tech Labs logo.');
  });

  // TEST 4: User request -> semantic extraction
  it('PRODUCTION TEST 4: semantically extracts brand, services, value propositions and audience without raw request dumping', () => {
    const intent = extractCreativeIntent(sampleUserRequest, {
      platform: 'instagram',
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(intent.brand_name).toBe('Daylink Tech Labs');
    expect(intent.service_or_product).toContain('AI & Automation');
    expect(intent.value_propositions).toContain('automate repetitive work');
    expect(intent.value_propositions).toContain('build intelligent software');
    expect(intent.value_propositions).toContain('improve productivity using AI');
    expect(intent.creative_category).toBe('SaaS / Technology Marketing');
    expect(intent.visual_style).toBe('Premium Enterprise SaaS');
  });

  // TEST 5: Brand resolution -> Daylink Tech Labs
  it('PRODUCTION TEST 5: accurately resolves brand name as Daylink Tech Labs and rejects service concepts', () => {
    const { extractedBrand } = extractSubjectAndEntity(sampleUserRequest);
    expect(extractedBrand).toBe('Daylink Tech Labs');
    expect(extractedBrand).not.toBe('build intelligent software');
    expect(extractedBrand).not.toBe('automate repetitive work');
    expect(isValidBrandName('build intelligent software')).toBe(false);
    expect(isValidBrandName('Daylink Tech Labs')).toBe(true);
  });

  // TEST 6: Creative type -> Premium SaaS / Technology
  it('PRODUCTION TEST 6: classifies the creative type strictly as SaaS / Technology Marketing and not Product Photography', () => {
    const intent = extractCreativeIntent(sampleUserRequest);
    expect(intent.creative_category).toBe('SaaS / Technology Marketing');
    expect(intent.visual_style).toBe('Premium Enterprise SaaS');
  });

  // TEST 7: Aspect ratio -> Instagram 4:5
  it('PRODUCTION TEST 7: specifies vertical 4:5 aspect ratio and 1080 × 1350 resolution for Instagram', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM AI / AUTOMATION SERVICES FOR DAYLINK TECH LABS.');
    expect(prompt).toContain('CREATIVE TYPE:\nAI / Automation Services');
    expect(prompt).toContain('Instagram 4:5 vertical.');
    expect(prompt).toContain('1080 × 1350 composition.');
  });

  // TEST 8: Generated prompt contains REAL HTTPS image URL
  it('PRODUCTION TEST 8: ensures generated prompt embeds the validated public HTTPS URL', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).toContain(
      'PRIMARY REFERENCE IMAGE:\nhttps://dailybuz.com/uploads/marketing/assets/ab6095d0-aa86-4328-934b-d56f26d8d7d8/bf9b5959-3af3-47af-b66c-6ec213000399.png'
    );
    expect(prompt).toContain('FINAL REQUIREMENT:\nThe supplied reference image URL above is a REAL validated public HTTPS image URL.');
  });

  // TEST 9: Generated prompt contains exact-logo preservation rules
  it('PRODUCTION TEST 9: ensures logo preservation rules strictly forbid redrawing, distortion, or generative modification', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).toContain('LOGO PRESERVATION:');
    expect(prompt).toContain('Use the supplied logo as the authoritative brand reference.');
    expect(prompt).toContain('Do not recreate, redesign, recolor, distort, stretch, modify, replace or generate a new version of the logo.');
    expect(prompt).toContain('LOGO:\nPlace the actual supplied logo naturally in a premium, unobstructed brand-safe area.\n\nDo not modify the logo.');
  });

  // TEST 10: Generated prompt contains no relative /uploads URL
  it('PRODUCTION TEST 10: contains zero un-prefixed relative /uploads/ paths', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    const hasRelativeUpload = /(?<!https?:\/\/[^\s\n"']+)\/uploads\/marketing/i.test(prompt);
    expect(hasRelativeUpload).toBe(false);
  });

  // TEST 11: Zero localhost references
  it('PRODUCTION TEST 11: contains zero localhost or 127.0.0.1 references', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).not.toContain('localhost');
    expect(prompt).not.toContain('127.0.0.1');
  });

  // TEST 12: Zero brand contamination
  it('PRODUCTION TEST 12: never infers "build intelligent software" as the company name', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).toContain('BRAND:\nDaylink Tech Labs');
    expect(prompt).not.toContain('BRAND:\nbuild intelligent software');
  });

  // TEST 13: Zero Product Photography classification for SaaS
  it('PRODUCTION TEST 13: contains zero "Product Photography" classification for SaaS/technology', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt.toLowerCase()).not.toContain('style: product photography');
    expect(prompt.toLowerCase()).not.toContain('creative type:\nproduct photography');
  });

  // TEST 14: Zero raw HTML tags
  it('PRODUCTION TEST 14: contains zero raw HTML, <p>, <br>, or markdown garbage', () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    expect(prompt).not.toContain('<p>');
    expect(prompt).not.toContain('</p>');
    expect(prompt).not.toContain('<br>');
  });

  // TEST 15: Prompt QA validation pipeline passes all 15 checks
  it('PRODUCTION TEST 15: validates that the complete prompt passes all QA pipeline gates', async () => {
    const prompt = buildDetailedImagePrompt({
      topic: sampleUserRequest,
      platforms: ['instagram'],
      selectedAssets: [sampleDbLogoAsset],
    });

    const intent = extractCreativeIntent(sampleUserRequest, {
      platform: 'instagram',
      selectedAssets: [sampleDbLogoAsset],
    });

    const resolved = resolveAssetPublicUrl(sampleDbLogoAsset);
    const assetReport = await validateAssetUrlAccessibility(resolved.publicUrl, {
      id: sampleDbLogoAsset.id,
      name: sampleDbLogoAsset.name,
    });

    const qaResult = validateCreativePromptQA(prompt, intent, [assetReport]);

    expect(qaResult.passed).toBe(true);
    expect(qaResult.brandCorrect).toBe(true);
    expect(qaResult.referenceAssetPresent).toBe(true);
    expect(qaResult.publicUrlPresent).toBe(true);
    expect(qaResult.publicUrlHttps).toBe(true);
    expect(qaResult.publicUrlAccessible).toBe(true);
    expect(qaResult.correctMimeType).toBe(true);
    expect(qaResult.noInternalPath).toBe(true);
    expect(qaResult.noBrandConflict).toBe(true);
    expect(qaResult.correctCreativeType).toBe(true);
    expect(qaResult.correctPlatform).toBe(true);
    expect(qaResult.correctAspectRatio).toBe(true);
    expect(qaResult.noHtml).toBe(true);
    expect(qaResult.noFakeClaims).toBe(true);
    expect(qaResult.noCompetitorBranding).toBe(true);
    expect(qaResult.exactLogoInstructionPresent).toBe(true);
    expect(qaResult.diagnostics).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // DYNAMIC CREATIVE TYPE & INTENT SUITE (7 Core User Verification Tests)
  // --------------------------------------------------------------------------
  describe('Dynamic Creative Type & Intent Resolution Suite', () => {
    // TEST 1: daylink tech labs services poster
    it('TEST 1: daylink tech labs services poster -> Services Poster (Source: User Request)', () => {
      const input = 'daylink tech labs services poster';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.source).toBe('user_request');
      expect(intent.creativeType.label).toBe('Services Poster');
      expect(intent.creativeType.value).toBe('services_poster');
      expect(intent.creativeType.source).toBe('user_request');
      expect(intent.platform).toBe('instagram');
      expect(intent.quickStarter).toBeNull();

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM SERVICES POSTER FOR DAYLINK TECH LABS.');
      expect(prompt).toContain('CREATIVE TYPE:\nServices Poster');
    });

    // TEST 2: daylink tech labs internship poster
    it('TEST 2: daylink tech labs internship poster -> Internship / Recruitment Poster (Source: User Request)', () => {
      const input = 'daylink tech labs internship poster';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.source).toBe('user_request');
      expect(intent.creativeType.label).toBe('Internship / Recruitment Poster');
      expect(intent.creativeType.value).toBe('internship_recruitment_poster');
      expect(intent.creativeType.source).toBe('user_request');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM INTERNSHIP / RECRUITMENT POSTER FOR DAYLINK TECH LABS.');
      expect(prompt).toContain('CREATIVE TYPE:\nInternship / Recruitment Poster');
    });

    // TEST 3: daylink tech labs website development poster
    it('TEST 3: daylink tech labs website development poster -> Website Development Poster (Source: User Request)', () => {
      const input = 'daylink tech labs website development poster';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.source).toBe('user_request');
      expect(intent.creativeType.label).toBe('Website Development Poster');
      expect(intent.creativeType.value).toBe('website_development_poster');
      expect(intent.creativeType.source).toBe('user_request');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM WEBSITE DEVELOPMENT POSTER FOR DAYLINK TECH LABS.');
      expect(prompt).toContain('CREATIVE TYPE:\nWebsite Development Poster');
    });

    // TEST 4: daylink tech labs AI automation poster
    it('TEST 4: daylink tech labs AI automation poster -> AI / Automation Poster (Source: User Request)', () => {
      const input = 'daylink tech labs AI automation poster';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.source).toBe('user_request');
      expect(intent.creativeType.label).toBe('AI / Automation Poster');
      expect(intent.creativeType.value).toBe('ai_automation_poster');
      expect(intent.creativeType.source).toBe('user_request');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM AI / AUTOMATION POSTER FOR DAYLINK TECH LABS.');
      expect(prompt).toContain('CREATIVE TYPE:\nAI / Automation Poster');
    });

    // TEST 5: make something for Daylink Tech Labs
    it('TEST 5: make something for Daylink Tech Labs -> Creative Type: Not specified (value: null)', () => {
      const input = 'make something for Daylink Tech Labs';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.source).toBe('user_request');
      expect(intent.creativeType.label).toBe('Not specified');
      expect(intent.creativeType.value).toBeNull();
      expect(intent.creativeType.source).toBe('none');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).not.toContain('CREATIVE TYPE:\nMarketing Creative');
    });

    // TEST 6: AI automation services
    it('TEST 6: AI automation services -> AI / Automation Services (Source: User Request)', () => {
      const input = 'AI automation services';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.creativeType.label).toBe('AI / Automation Services');
      expect(intent.creativeType.value).toBe('ai_automation_services');
      expect(intent.creativeType.source).toBe('user_request');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM AI / AUTOMATION SERVICES');
      expect(prompt).toContain('CREATIVE TYPE:\nAI / Automation Services');
    });

    // TEST 7: create an Instagram post
    it('TEST 7: create an Instagram post -> Creative Type: Not specified, Platform: Instagram (NO Marketing Creative fallback)', () => {
      const input = 'create an Instagram post';
      const intent = parseDynamicCreativeIntent({ rawInput: input });

      expect(intent.creativeType.label).toBe('Not specified');
      expect(intent.creativeType.value).toBeNull();
      expect(intent.creativeType.source).toBe('none');
      expect(intent.platform).toBe('instagram');

      const prompt = buildDetailedImagePrompt({ topic: input });
      expect(prompt).not.toContain('CREATIVE TYPE:\nMarketing Creative');
    });

    // TEST 8: Distinguishes Legal Name from Display Brand Name
    it('TEST 8: strips legal suffix (Private Limited) for display brand name while preserving legal company name', () => {
      expect(stripLegalCompanySuffix('Daylink Tech Labs Private Limited')).toBe('Daylink Tech Labs');
      expect(stripLegalCompanySuffix('Dailybuz Pvt Ltd')).toBe('Dailybuz');

      const resolved = resolveBrandIdentity('services poster', {
        businessName: 'Daylink Tech Labs Private Limited',
      });

      expect(resolved.name).toBe('Daylink Tech Labs');
      expect(resolved.legalName).toBe('Daylink Tech Labs Private Limited');
      expect(resolved.source).toBe('tenant_profile');
    });

    // TEST 9: Quick Starter tracking
    it('TEST 9: Quick Starters only affect generation when explicitly provided and reset to null otherwise', () => {
      const intentWithQuickStarter = parseDynamicCreativeIntent({
        rawInput: 'daylink tech labs services poster',
        activeQuickStarter: 'AI Automation Services',
      });
      expect(intentWithQuickStarter.quickStarter).toBe('AI Automation Services');

      const intentWithoutQuickStarter = parseDynamicCreativeIntent({
        rawInput: 'daylink tech labs services poster',
        activeQuickStarter: null,
      });
      expect(intentWithoutQuickStarter.quickStarter).toBeNull();
    });

    // TEST 10: Dynamic intent resets on new requests
    it('TEST 10: recalculates creative type dynamically when request changes from AI automation to CRM poster', () => {
      const intent1 = parseDynamicCreativeIntent({ rawInput: 'AI automation poster' });
      expect(intent1.creativeType.label).toBe('AI / Automation Poster');

      const intent2 = parseDynamicCreativeIntent({ rawInput: 'make a poster for our CRM' });
      expect(intent2.creativeType.label).toBe('CRM Product Poster');
      expect(intent2.creativeType.value).toBe('crm_product_poster');

      const intent3 = parseDynamicCreativeIntent({ rawInput: 'daylink tech labs company profile' });
      expect(intent3.creativeType.label).toBe('Company Profile Creative');
      expect(intent3.creativeType.value).toBe('company_profile_creative');
    });
  });

  // ==========================================================================
  // MULTI-TENANT ISOLATION & ZERO DAYLINK-AS-CUSTOMER ASSUMPTION SUITE
  // ==========================================================================
  describe('Multi-Tenant Customer Isolation & Cross-Industry Isolation Suite', () => {
    // TEST 1: Tenant A - Daylink Tech Labs (Authenticated Tenant)
    it('TENANT A: Daylink Tech Labs generates tech/services poster from authenticated tenant data', async () => {
      const tenantContext = {
        businessName: 'Daylink Tech Labs Private Limited',
        brandVoice: 'Innovative enterprise AI solutions',
        brandColors: '#0EA5E9, #0284C7',
        productsOrServices: 'AI & Automation, Intelligent Software Solutions',
        targetAudience: 'Startups and technology enterprises',
      };

      const logoAsset = {
        id: 'asset_tenant_daylink_logo',
        name: 'Daylink Official Logo',
        category: 'LOGOS' as const,
        public_url: 'https://dailybuz.com/uploads/marketing/assets/daylink/logo.png',
      };

      const intent = parseDynamicCreativeIntent({
        rawInput: 'services poster',
        tenantId: 'tenant_daylink_123',
        tenantName: 'Daylink Tech Labs',
        brandContext: tenantContext,
      });

      expect(intent.brand.name).toBe('Daylink Tech Labs');
      expect(intent.brand.legalName).toBe('Daylink Tech Labs Private Limited');
      expect(intent.brand.source).toBe('tenant_profile');
      expect(intent.creativeType.label).toBe('Services Poster');
      expect(intent.creativeType.value).toBe('services_poster');

      const prompt = buildDetailedImagePrompt({
        topic: 'services poster',
        brandContext: tenantContext,
        selectedAssets: [logoAsset],
      });

      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM SERVICES POSTER FOR DAYLINK TECH LABS.');
      expect(prompt).toContain('BRAND:\nDaylink Tech Labs');
      expect(prompt).toContain('CREATIVE TYPE:\nServices Poster');
      expect(prompt).toContain('https://dailybuz.com/uploads/marketing/assets/daylink/logo.png');
      expect(prompt).not.toContain('pizza');
      expect(prompt).not.toContain('apartment');
      expect(prompt).not.toContain('fashion');
    });

    // TEST 2: Tenant B - ABC Pizza (Restaurant / Food)
    it('TENANT B: ABC Pizza generates culinary creative with ZERO Daylink/CRM/SaaS contamination', async () => {
      const tenantContext = {
        businessName: 'ABC Pizza LLC',
        brandVoice: 'Warm, appetizing, artisanal Italian',
        brandColors: '#E11D48, #F59E0B',
        productsOrServices: 'Wood-fired pizzas, garlic knots, artisanal desserts',
        targetAudience: 'Local families and food lovers',
      };

      const pizzaLogoAsset = {
        id: 'asset_tenant_pizza_logo',
        name: 'ABC Pizza Logo',
        category: 'LOGOS' as const,
        public_url: 'https://dailybuz.com/uploads/marketing/assets/abc_pizza/logo.png',
      };

      const intent = parseDynamicCreativeIntent({
        rawInput: 'weekend pizza offer',
        tenantId: 'tenant_pizza_456',
        tenantName: 'ABC Pizza',
        brandContext: tenantContext,
      });

      expect(intent.brand.name).toBe('ABC Pizza');
      expect(intent.brand.source).toBe('tenant_profile');
      expect(intent.creativeType.label).toBe('Sale Promotional Creative');
      expect(intent.creativeType.value).toBe('sale_promotional_creative');

      const prompt = buildDetailedImagePrompt({
        topic: 'weekend pizza offer',
        brandContext: tenantContext,
        selectedAssets: [pizzaLogoAsset],
      });

      // Assert Brand and Creative Type
      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM SALE PROMOTIONAL CREATIVE FOR ABC PIZZA.');
      expect(prompt).toContain('BRAND:\nABC Pizza');
      expect(prompt).toContain('CREATIVE TYPE:\nSale Promotional Creative');
      expect(prompt).toContain('PRIMARY REFERENCE IMAGE:\nhttps://dailybuz.com/uploads/marketing/assets/abc_pizza/logo.png');

      // Assert Culinary Creative Direction
      expect(prompt).toContain('CREATIVE DIRECTION:\nCreate a mouth-watering artisanal culinary visual asset');
      expect(prompt).toContain('VISUAL STYLE:\nArtisanal Culinary Photography.');
      expect(prompt).toContain('CTA:\n"Order Now"');

      // STRICT NEGATIVE ASSERTIONS: Must NEVER contain Daylink, CRM, SaaS, AI Automation
      const lower = prompt.toLowerCase();
      expect(lower).not.toContain('daylink');
      expect(lower).not.toContain('crm');
      expect(lower).not.toContain('saas');
      expect(lower).not.toContain('ai automation');
      expect(lower).not.toContain('software');
      expect(lower).not.toContain('dashboard');
    });

    // TEST 3: Tenant C - XYZ Properties (Real Estate)
    it('TENANT C: XYZ Properties generates luxury architectural creative with ZERO SaaS contamination', async () => {
      const tenantContext = {
        businessName: 'XYZ Properties Private Limited',
        brandVoice: 'Prestigious, refined, luxury living',
        brandColors: '#0F172A, #D97706',
        productsOrServices: 'Luxury 2BHK and 3BHK residential apartments and penthouses',
        targetAudience: 'High-net-worth homebuyers and real estate investors',
      };

      const reLogoAsset = {
        id: 'asset_tenant_re_logo',
        name: 'XYZ Properties Logo',
        category: 'LOGOS' as const,
        public_url: 'https://dailybuz.com/uploads/marketing/assets/xyz_properties/logo.png',
      };

      const intent = parseDynamicCreativeIntent({
        rawInput: '2BHK apartment launch poster',
        tenantId: 'tenant_re_789',
        tenantName: 'XYZ Properties',
        brandContext: tenantContext,
      });

      expect(intent.brand.name).toBe('XYZ Properties');
      expect(intent.brand.source).toBe('tenant_profile');
      expect(intent.creativeType.label).toBe('Property Launch Poster');

      const prompt = buildDetailedImagePrompt({
        topic: '2BHK apartment launch poster',
        brandContext: tenantContext,
        selectedAssets: [reLogoAsset],
      });

      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM PROPERTY LAUNCH POSTER FOR XYZ PROPERTIES.');
      expect(prompt).toContain('BRAND:\nXYZ Properties');
      expect(prompt).toContain('CREATIVE TYPE:\nProperty Launch Poster');
      expect(prompt).toContain('CREATIVE DIRECTION:\nCreate a breathtaking architectural visual asset');
      expect(prompt).toContain('VISUAL STYLE:\nLuxury Architectural Photography.');
      expect(prompt).toContain('CTA:\n"Schedule a Tour"');

      // Zero Daylink / SaaS
      const lower = prompt.toLowerCase();
      expect(lower).not.toContain('daylink');
      expect(lower).not.toContain('crm');
      expect(lower).not.toContain('saas');
      expect(lower).not.toContain('ai automation');
      expect(lower).not.toContain('intelligent software');
    });

    // TEST 4: Tenant D - ABC Fashion (Clothing Brand)
    it('TENANT D: ABC Fashion generates summer collection lookbook with ZERO software contamination', async () => {
      const tenantContext = {
        businessName: 'ABC Fashion Studio',
        brandVoice: 'Chic, contemporary, effortless elegance',
        brandColors: '#BE185D, #FDE047',
        productsOrServices: 'Summer linen collections, designer apparel, sustainable clothing',
        targetAudience: 'Fashion-forward women and trendsetters',
      };

      const fashionLogoAsset = {
        id: 'asset_tenant_fashion_logo',
        name: 'ABC Fashion Logo',
        category: 'LOGOS' as const,
        public_url: 'https://dailybuz.com/uploads/marketing/assets/abc_fashion/logo.png',
      };

      const intent = parseDynamicCreativeIntent({
        rawInput: 'summer collection poster',
        tenantId: 'tenant_fashion_101',
        tenantName: 'ABC Fashion Studio',
        brandContext: tenantContext,
      });

      expect(intent.brand.name).toBe('ABC Fashion Studio');
      expect(intent.creativeType.label).toBe('Product Collection Poster');

      const prompt = buildDetailedImagePrompt({
        topic: 'summer collection poster',
        brandContext: tenantContext,
        selectedAssets: [fashionLogoAsset],
      });

      expect(prompt).toContain('CREATE A PREMIUM 4:5 INSTAGRAM PRODUCT COLLECTION POSTER FOR ABC FASHION STUDIO.');
      expect(prompt).toContain('BRAND:\nABC Fashion Studio');
      expect(prompt).toContain('CREATIVE DIRECTION:\nCreate a high-fashion editorial visual asset');
      expect(prompt).toContain('VISUAL STYLE:\nHigh-Fashion Editorial Lookbook.');
      expect(prompt).toContain('CTA:\n"Shop the Collection"');

      // Zero Daylink / SaaS
      const lower = prompt.toLowerCase();
      expect(lower).not.toContain('daylink');
      expect(lower).not.toContain('crm');
      expect(lower).not.toContain('saas');
      expect(lower).not.toContain('automation workflow');
    });

    // TEST 5: Creative Types parsed dynamically from specific user requests without "Marketing Creative" default
    it('TENANT UNIVERSAL: parses dynamic creative types without assuming Marketing Creative default', () => {
      const t1 = parseCreativeType('pizza menu poster');
      expect(t1.label).toBe('Menu Poster');
      expect(t1.value).toBe('menu_poster');

      const t2 = parseCreativeType('employee hiring poster');
      expect(t2.label).toBe('Recruitment Poster');
      expect(t2.value).toBe('recruitment_poster');

      const t3 = parseCreativeType('new product launch');
      expect(t3.label).toBe('Product Launch Creative');
      expect(t3.value).toBe('product_launch_creative');

      const t4 = parseCreativeType('summer sale');
      expect(t4.label).toBe('Sale Promotional Creative');
      expect(t4.value).toBe('sale_promotional_creative');

      const t5 = parseCreativeType('company services');
      expect(t5.label).toBe('Services Poster');
      expect(t5.value).toBe('services_poster');

      const t6 = parseCreativeType('Instagram post');
      expect(t6.label).toBe('Not specified');
      expect(t6.value).toBeNull();

      const t7 = parseCreativeType('marketing campaign for our summer sale');
      expect(t7.label).toBe('Marketing Campaign');
      expect(t7.value).toBe('marketing_campaign');
    });

    // TEST 6: Multi-tenant asset isolation ensures zero cross-tenant contamination
    it('TENANT ISOLATION: prevents Tenant A assets from leaking into Tenant B generations', async () => {
      const tenantAAssets = [
        {
          id: 'asset_tenant_a_logo',
          name: 'Tenant A Daylink Logo',
          category: 'LOGOS' as const,
          public_url: 'https://dailybuz.com/uploads/marketing/assets/tenant_a/logo.png',
        },
      ];

      const tenantBAssets = [
        {
          id: 'asset_tenant_b_logo',
          name: 'Tenant B Pizza Logo',
          category: 'LOGOS' as const,
          public_url: 'https://dailybuz.com/uploads/marketing/assets/tenant_b/logo.png',
        },
      ];

      const promptB = buildDetailedImagePrompt({
        topic: 'weekend pizza offer',
        brandContext: { businessName: 'ABC Pizza' },
        selectedAssets: tenantBAssets,
      });

      expect(promptB).toContain('https://dailybuz.com/uploads/marketing/assets/tenant_b/logo.png');
      expect(promptB).not.toContain('tenant_a');
      expect(promptB).not.toContain('Daylink');
    });
  });
});
