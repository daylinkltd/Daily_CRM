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
});
