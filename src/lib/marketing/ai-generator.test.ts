import { describe, it, expect } from 'vitest';
import {
  generateMarketingContent,
  buildDetailedImagePrompt,
  buildDetailedVideoPrompt,
} from './ai-generator';

describe('DailyBuz AI Generator Suite', () => {
  it('generates a complete structured marketing package with image and video generation prompts', async () => {
    const res = await generateMarketingContent({
      topic: 'DailyBuz CRM helps small businesses manage customer conversations',
      contentType: 'post',
      platforms: ['instagram'],
      objective: 'Lead generation',
      targetAudience: 'Small business owners',
      tone: 'engaging',
    });

    expect(res.success).toBe(true);
    expect(res.social).toBeDefined();

    const social = res.social!;

    // 1. Social media content & descriptions
    expect(social.title).toBeTruthy();
    expect(social.caption).toBeTruthy();
    expect(social.short_description).toBeTruthy();
    expect(social.shortCaption).toBeTruthy();

    // 2. Hashtags & Keywords
    expect(social.hashtags.length).toBeGreaterThan(0);
    expect(social.keywords.length).toBeGreaterThan(0);

    // 3. CTA
    expect(social.cta).toBeTruthy();

    // 4. Detailed Image Prompt
    expect(social.image_prompt).toBeTruthy();
    expect(social.image_prompt).toContain('Instagram');
    expect(social.image_prompt.toLowerCase()).toContain('customer conversation');
    expect(social.image_prompt).toContain('Negative Prompts');
    expect(social.image_prompt).toContain('competitor logos');

    // 5. Detailed Video Prompt
    expect(social.video_prompt).toBeTruthy();
    expect(social.video_prompt).toContain('0–2 sec [Opening Hook]');
    expect(social.video_prompt).toContain('2–5 sec [Scene & Main Action]');
    expect(social.video_prompt).toContain('5–8 sec [Product / Value Demonstration]');
    expect(social.video_prompt).toContain('8–10 sec [Ending / CTA Visual]');

    // 6. No fake media URL attached by default
    expect(social.image_url).toBeUndefined();

    // 7. Structured fields
    expect(social.platform).toBe('instagram');
    expect(social.target_audience).toBe('Small business owners');
    expect(social.objective).toBe('Lead generation');
    expect(social.image_prompt_version).toBe(1);
    expect(social.video_prompt_version).toBe(1);
  });

  it('builds platform-aware image prompts for different social networks', () => {
    const instaPrompt = buildDetailedImagePrompt({
      topic: 'Omnichannel WhatsApp Support',
      platforms: ['instagram'],
      imageStyle: 'Minimal SaaS',
    });
    expect(instaPrompt).toContain('1:1');

    const linkedinPrompt = buildDetailedImagePrompt({
      topic: 'Enterprise Sales Automation',
      platforms: ['linkedin'],
      imageStyle: 'Professional',
    });
    expect(linkedinPrompt).toContain('1.91:1');

    const tiktokPrompt = buildDetailedImagePrompt({
      topic: 'Fast Customer Growth',
      platforms: ['tiktok'],
      imageStyle: 'Lifestyle',
    });
    expect(tiktokPrompt).toContain('9:16');
  });

  it('builds chronological action-time video prompts with quality requirements', () => {
    const videoPrompt = buildDetailedVideoPrompt({
      topic: 'Instant GST Invoicing Engine',
      platforms: ['instagram'],
      videoStyle: 'SaaS Commercial',
      objective: 'Promotion & sales conversion',
      targetAudience: 'Retail shop owners',
    });

    expect(videoPrompt).toContain('10-second');
    expect(videoPrompt).toContain('0–2 sec');
    expect(videoPrompt).toContain('2–5 sec');
    expect(videoPrompt).toContain('5–8 sec');
    expect(videoPrompt).toContain('8–10 sec');
    expect(videoPrompt).toContain('Negative Prompts');
    expect(videoPrompt).toContain('Retail shop owners');
  });

  it('regenerates ONLY the image prompt without altering caption, hashtags, CTA, or video prompt', async () => {
    const existingCaption = 'Human-edited caption: Discover how our tool drives real ROI.';
    const existingVideoPrompt = 'Original video prompt 0-2s hook...';
    const existingHashtags = ['#CustomTag1', '#CustomTag2'];
    const existingCta = 'Special CTA link';

    const res = await generateMarketingContent({
      topic: 'Automated Sales Pipelines',
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
    expect(res.social?.image_prompt).toContain('3d');
    expect(res.social?.image_prompt_version).toBe(2);
  });

  it('regenerates ONLY the video prompt without altering caption or image prompt', async () => {
    const existingCaption = 'Custom caption that must not change.';
    const existingImagePrompt = 'Custom image prompt that must not change.';

    const res = await generateMarketingContent({
      topic: 'Customer Success Story',
      videoStyle: 'Storytelling',
      regenTarget: 'video_prompt_only',
      existingCaption,
      existingImagePrompt,
      videoPromptVersion: 2,
    });

    expect(res.social?.caption).toBe(existingCaption);
    expect(res.social?.image_prompt).toBe(existingImagePrompt);
    expect(res.social?.video_prompt).toContain('storytelling');
    expect(res.social?.video_prompt_version).toBe(3);
  });

  it('dynamically adapts brand context for multi-tenant isolation', async () => {
    const customTenantBrand = {
      businessName: 'Acme Logistics SaaS',
      brandVoice: 'Dynamic, modern supply-chain leader',
      brandColors: 'Electric amber and graphite black',
      website: 'https://acmelogistics.io',
      productsOrServices: 'Acme Fleet Dispatch Hub',
    };

    const res = await generateMarketingContent({
      topic: 'Fleet Tracking & Route Optimization',
      brandContext: customTenantBrand,
      platforms: ['linkedin'],
    });

    expect(res.social?.image_prompt).toContain('Electric amber');
    expect(res.social?.image_prompt).toContain('Acme Fleet Dispatch Hub');
    expect(res.social?.video_prompt).toContain('Acme Logistics SaaS');
    expect(res.social?.cta).toContain('acmelogistics.io');
    expect(res.social?.hashtags.some((h) => h.toLowerCase().includes('acmelogistics'))).toBe(true);
  });

  it('changes creative concepts completely between distinct topics (Summer Sale vs CRM Feature vs Customer Success)', async () => {
    const resSale = await generateMarketingContent({
      topic: 'Summer flash sale 50% discount on annual plans',
      platforms: ['instagram'],
    });

    const resFeature = await generateMarketingContent({
      topic: 'New automated WhatsApp pipeline triggers and real-time alerts',
      platforms: ['instagram'],
    });

    const resSuccess = await generateMarketingContent({
      topic: 'Customer success story: How RetailPro grew revenue by 300%',
      platforms: ['instagram'],
    });

    expect(resSale.social?.image_prompt).not.toEqual(resFeature.social?.image_prompt);
    expect(resFeature.social?.image_prompt).not.toEqual(resSuccess.social?.image_prompt);
    expect(resSale.social?.video_prompt).not.toEqual(resSuccess.social?.video_prompt);
  });
});
