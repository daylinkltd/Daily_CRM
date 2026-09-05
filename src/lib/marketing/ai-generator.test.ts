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
    expect(social.image_prompt).toContain('Use the provided product image as the primary product reference:');
    expect(social.image_prompt).toContain("Use the company's actual logo for subtle branding:");
    expect(social.image_prompt).toContain('No watermarks');

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
    expect(prompt).toContain('CREATE A PREMIUM INSTAGRAM MARKETING CREATIVE FOR DAILYBUZ');
    expect(prompt).toContain('Brand:\nDailyBuz');
    expect(prompt).toContain('Marketing Goal:\nPromotion & Sales');

    // 2. Must cite the real public URL and strict preservation rules
    expect(prompt).toContain('https://cdn.dailybuz.com/assets/tenant_123/dailybuz-logo.png');
    expect(prompt).toContain('Use the supplied DailyBuz logo as the primary brand reference exactly as provided');
    expect(prompt).toContain('Do not:\n- redesign the logo\n- recreate the logo\n- alter the logo colors\n- change proportions\n- stretch the logo\n- distort the logo\n- replace the logo');

    // 3. Must specify modern SaaS / AI CRM visual direction
    expect(prompt).toContain('Create a premium modern SaaS marketing composition');
    expect(prompt).toContain('AI-powered CRM and marketing platform');
    expect(prompt).toContain('Modern CRM dashboard concepts');

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
});


