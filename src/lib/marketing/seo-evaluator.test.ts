import { describe, it, expect } from 'vitest';
import { evaluateBlogSEO } from './seo-evaluator';

describe('evaluateBlogSEO', () => {
  it('evaluates an empty blog post as poor SEO', () => {
    const report = evaluateBlogSEO({});
    expect(report.score).toBeLessThan(40);
    expect(report.grade).toBe('Poor');
    expect(report.color).toBe('rose');
    expect(report.wordCount).toBe(0);
  });

  it('evaluates a well-optimized blog post with Good grade', () => {
    const content = Array(450).fill('word').join(' ') + ' crm automation crm automation';
    const report = evaluateBlogSEO({
      title: 'How to Implement CRM Automation for Modern Growth Teams',
      seoTitle: 'How to Implement CRM Automation for Modern Growth Teams',
      seoDescription: 'Discover step-by-step strategies for crm automation. Learn how modern teams streamline workflows, boost efficiency, and drive measurable ROI.',
      slug: 'how-to-implement-crm-automation',
      content,
      primaryKeyword: 'crm automation',
      secondaryKeywords: ['pipeline growth', 'sales automation'],
      featuredImage: 'https://example.com/banner.jpg',
      altText: 'CRM automation workflow diagram',
      headings: [
        { level: 2, text: '1. Why CRM Automation Matters' },
        { level: 2, text: '2. Implementation Steps' },
      ],
      faqSchema: [
        { question: 'What is CRM automation?', answer: 'Automating sales and marketing tasks.' },
        { question: 'How much does it save?', answer: 'Over 10 hours per week.' },
      ],
    });

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.grade).toBe('Good');
    expect(report.color).toBe('emerald');
    expect(report.wordCount).toBeGreaterThanOrEqual(450);
  });

  it('flags short meta description and missing keyword', () => {
    const report = evaluateBlogSEO({
      title: 'Short Title',
      seoDescription: 'Too short',
      slug: 'bad slug with spaces',
      content: 'Short body',
      primaryKeyword: 'enterprise hrms',
    });

    const metaCheck = report.checks.find((c) => c.id === 'meta_description');
    expect(metaCheck?.passed).toBe(false);

    const slugCheck = report.checks.find((c) => c.id === 'url_slug');
    expect(slugCheck?.passed).toBe(false);
  });
});
