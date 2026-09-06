import { describe, it, expect } from 'vitest';
import { generateMarketingContent, parseNaturalLanguageIntent } from './ai-generator';
import { validateMediaForPlatforms, validatePublishingReadiness } from './media-validator';
import { evaluateBlogSEO } from './seo-evaluator';

describe('DailyBuz Marketing Module QA Test Suite (Tests 1-20)', () => {
  // TEST 01: CRM-specific Post Generation
  it('TEST 01: parses natural language and generates CRM-specific content package', async () => {
    const input = 'Create an Instagram post promoting DailyBuz CRM for small businesses';
    const parsed = parseNaturalLanguageIntent(input);

    expect(parsed.detectedProduct).toBe('DailyBuz CRM');
    expect(parsed.detectedIntent).toBe('promotion');
    expect(parsed.detectedAudience).toContain('Small business');

    const res = await generateMarketingContent({ topic: input });
    expect(res.success).toBe(true);
    expect(res.generation_id).toMatch(/^gen_/);
    expect(res.social?.caption.toLowerCase()).toContain('crm');
    expect(res.social?.image_prompt).toContain('CRM');
    expect(res.social?.hashtags.some((h) => h.toLowerCase().includes('crm'))).toBe(true);
  });

  // TEST 02: Dynamic changes per topic (Attendance feature)
  it('TEST 02: changes content, hashtags, and CTA completely when topic changes to attendance', async () => {
    const input = 'Announce our new employee attendance feature in DailyBuz HR';
    const res = await generateMarketingContent({ topic: input });

    expect(res.social?.caption.toLowerCase()).toContain('attendance');
    expect(res.social?.image_prompt.toLowerCase()).toMatch(/hr|human resources|attendance/);
    expect(res.social?.hashtags.some((h) => h.toLowerCase().includes('hr') || h.toLowerCase().includes('workforce'))).toBe(true);
  });

  // TEST 03: Multi-Platform (Instagram + LinkedIn) with platform-specific copy
  it('TEST 03: generates platform-specific content for Instagram and LinkedIn', async () => {
    const res = await generateMarketingContent({
      topic: 'DailyBuz WhatsApp Marketing Broadcasts',
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

  // TEST 04: Uploaded custom image retention
  it('TEST 04: preserves uploaded custom image URL without replacing it with AI image', async () => {
    const customMedia = 'https://example.com/my-uploaded-brochure.png';
    const res = await generateMarketingContent({
      topic: 'Special Year-End Discount on DailyBuz Workspace',
      uploadedMediaUrl: customMedia,
    });

    expect(res.social?.image_url).toBe(customMedia);
  });

  // TEST 05 & TEST 08: Granular regeneration of hashtags
  it('TEST 08: regenerates ONLY hashtags without touching human-edited caption', async () => {
    const humanCaption = 'Administrator custom written text: Exclusive 50% discount for early adopters.';
    const res = await generateMarketingContent({
      topic: 'Early Adopter Discount',
      regenTarget: 'hashtags_only',
      existingCaption: humanCaption,
    });

    expect(res.social?.caption).toBe(humanCaption);
    expect(res.social?.hashtags.length).toBeGreaterThan(0);
  });

  // TEST 11, 12, 13, 14: Publishing Readiness Validator
  it('TEST 11-14: enforces strict publishing readiness checks and blocks invalid states', () => {
    // Missing caption
    const resNoCaption = validatePublishingReadiness({
      post: { title: 'Test Post', defaultCaption: '', channels: ['linkedin'], status: 'approved' },
      hasConnectedChannels: true,
      userCanPublish: true,
    });
    expect(resNoCaption.ready).toBe(false);
    expect(resNoCaption.errors).toContain('Caption is required to publish.');

    // Unapproved state
    const resUnapproved = validatePublishingReadiness({
      post: { title: 'Test Post', defaultCaption: 'Valid Caption', channels: ['linkedin'], status: 'draft' },
      hasConnectedChannels: true,
      userCanPublish: false,
    });
    expect(resUnapproved.ready).toBe(false);
    expect(resUnapproved.errors.some((e) => e.toLowerCase().includes('approval'))).toBe(true);

    // All valid
    const resValid = validatePublishingReadiness({
      post: { title: 'Test Post', defaultCaption: 'Valid Caption', channels: ['linkedin'], status: 'approved' },
      hasConnectedChannels: true,
      userCanPublish: true,
    });
    expect(resValid.ready).toBe(true);
    expect(resValid.errors.length).toBe(0);
  });

  // TEST 17 & 18: Blog generation with full SEO checklist
  it('TEST 17 & 18: generates full long-form SEO blog article with structure and FAQ schema', async () => {
    const res = await generateMarketingContent({
      topic: 'How to Implement Omnichannel Support in 2026',
      contentType: 'blog',
    });

    expect(res.success).toBe(true);
    expect(res.blog?.headings.length).toBeGreaterThanOrEqual(4);
    expect(res.blog?.faqSchema.length).toBeGreaterThanOrEqual(2);
    expect(res.blog?.seoReadiness.checks.length).toBe(10);
  });
});
