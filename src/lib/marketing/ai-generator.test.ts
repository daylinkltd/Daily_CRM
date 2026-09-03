import { describe, it, expect } from 'vitest';
import { generateMarketingContent } from './ai-generator';

describe('generateMarketingContent', () => {
  it('generates a complete social post from a raw topic with all required fields', async () => {
    const res = await generateMarketingContent({
      topic: 'DailyBiz CRM for small retail businesses',
      contentType: 'social',
      platforms: ['linkedin', 'instagram', 'x'],
      tone: 'engaging',
    });

    expect(res.success).toBe(true);
    expect(res.mode).toBe('social');
    expect(res.social).toBeDefined();

    const social = res.social!;
    expect(social.title).toBeTruthy();
    expect(social.caption).toContain('DailyBiz');
    expect(social.shortCaption).toBeTruthy();
    expect(social.cta).toBeTruthy();
    expect(social.hashtags.length).toBeGreaterThan(0);
    expect(social.keywords.length).toBeGreaterThan(0);
    expect(social.suggestedPlatforms).toContain('linkedin');
    expect(social.creativeSuggestion.description).toBeTruthy();
    expect(social.trendingAngle.headline).toBeTruthy();
    expect(social.suggestedPostingTime.time).toBeTruthy();
  });

  it('generates a structured long-form SEO blog article from a topic', async () => {
    const res = await generateMarketingContent({
      topic: 'Omnichannel Customer Support Strategies',
      contentType: 'blog',
    });

    expect(res.success).toBe(true);
    expect(res.mode).toBe('blog');
    expect(res.blog).toBeDefined();

    const blog = res.blog!;
    expect(blog.title).toBeTruthy();
    expect(blog.slug).toMatch(/^[a-z0-9-]+$/);
    expect(blog.content).toContain('## 1.');
    expect(blog.headings.length).toBeGreaterThanOrEqual(3);
    expect(blog.faqSchema.length).toBeGreaterThanOrEqual(2);
    expect(blog.seoReadiness.score).toBeGreaterThan(50);
  });

  it('regenerates only hashtags and keywords without modifying the existing caption', async () => {
    const existingCaption = 'Custom manual edits made by administrator that should not be lost.';
    const res = await generateMarketingContent({
      topic: 'Automated GST Billing Engine',
      contentType: 'social',
      regenTarget: 'hashtags_only',
      existingCaption,
    });

    expect(res.social?.caption).toBe(existingCaption);
    expect(res.social?.hashtags.length).toBeGreaterThan(0);
  });
});
