export interface SEOCheckItem {
  id: string;
  label: string;
  passed: boolean;
  score: number; // 0 to 10
  importance: 'critical' | 'recommended' | 'optional';
  feedback: string;
}

export interface SEOReadinessReport {
  score: number; // 0 to 100
  grade: 'Good' | 'Needs Improvement' | 'Poor';
  color: 'emerald' | 'amber' | 'rose';
  wordCount: number;
  readingTimeMinutes: number;
  checks: SEOCheckItem[];
}

export interface BlogSEOInput {
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  content?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  featuredImage?: string;
  altText?: string;
  headings?: Array<{ level: number; text: string }>;
  faqSchema?: Array<{ question: string; answer: string }>;
  internalLinks?: string[];
}

export function evaluateBlogSEO(input: BlogSEOInput): SEOReadinessReport {
  const checks: SEOCheckItem[] = [];

  const title = (input.seoTitle || input.title || '').trim();
  const description = (input.seoDescription || '').trim();
  const slug = (input.slug || '').trim();
  const content = (input.content || '').trim();
  const primaryKw = (input.primaryKeyword || '').toLowerCase().trim();
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // 1. Title Presence & Length Check
  const titleLen = title.length;
  const titlePassed = titleLen >= 30 && titleLen <= 70;
  checks.push({
    id: 'title_length',
    label: 'SEO Title Length (30-70 chars)',
    passed: titlePassed,
    score: titlePassed ? 10 : titleLen > 0 ? 5 : 0,
    importance: 'critical',
    feedback: titleLen === 0
      ? 'SEO title is missing.'
      : titleLen < 30
      ? `Title is too short (${titleLen} chars). Aim for 30-70 characters.`
      : titleLen > 70
      ? `Title is too long (${titleLen} chars). Search engines may truncate it.`
      : `Optimal title length (${titleLen} chars).`,
  });

  // 2. Keyword in Title
  const titleHasKw = primaryKw ? title.toLowerCase().includes(primaryKw) : false;
  checks.push({
    id: 'title_keyword',
    label: 'Primary Keyword in Title',
    passed: !primaryKw || titleHasKw,
    score: primaryKw ? (titleHasKw ? 10 : 0) : 5,
    importance: 'critical',
    feedback: !primaryKw
      ? 'Define a primary keyword to optimize title ranking.'
      : titleHasKw
      ? `Primary keyword "${primaryKw}" found in title.`
      : `Primary keyword "${primaryKw}" not found in title.`,
  });

  // 3. Meta Description Check (120-160 chars)
  const descLen = description.length;
  const descPassed = descLen >= 110 && descLen <= 165;
  checks.push({
    id: 'meta_description',
    label: 'Meta Description (120-160 chars)',
    passed: descPassed,
    score: descPassed ? 10 : descLen > 0 ? 5 : 0,
    importance: 'critical',
    feedback: descLen === 0
      ? 'Meta description is missing.'
      : descLen < 110
      ? `Meta description is too short (${descLen} chars).`
      : descLen > 165
      ? `Meta description is too long (${descLen} chars).`
      : `Optimal meta description (${descLen} chars).`,
  });

  // 4. Keyword in Meta Description
  const descHasKw = primaryKw ? description.toLowerCase().includes(primaryKw) : false;
  checks.push({
    id: 'desc_keyword',
    label: 'Primary Keyword in Meta Description',
    passed: !primaryKw || descHasKw,
    score: primaryKw ? (descHasKw ? 10 : 0) : 5,
    importance: 'recommended',
    feedback: !primaryKw
      ? 'Define a primary keyword.'
      : descHasKw
      ? `Primary keyword "${primaryKw}" included in meta description.`
      : `Include the primary keyword "${primaryKw}" in your meta description.`,
  });

  // 5. URL Slug Quality
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const slugValid = slug.length > 3 && slugRegex.test(slug);
  checks.push({
    id: 'url_slug',
    label: 'Clean URL Slug',
    passed: slugValid,
    score: slugValid ? 10 : slug ? 4 : 0,
    importance: 'critical',
    feedback: !slug
      ? 'URL slug is missing.'
      : !slugRegex.test(slug)
      ? 'Slug should be lowercase letters, numbers, and hyphens only (no spaces/symbols).'
      : `Valid clean URL slug: /${slug}`,
  });

  // 6. Content Word Count (> 350 words)
  const wordsPassed = wordCount >= 350;
  checks.push({
    id: 'word_count',
    label: 'Content Depth (> 350 words)',
    passed: wordsPassed,
    score: wordCount >= 600 ? 10 : wordCount >= 350 ? 8 : wordCount >= 150 ? 4 : 0,
    importance: 'critical',
    feedback: wordCount === 0
      ? 'Article body content is empty.'
      : wordCount < 350
      ? `Short article (${wordCount} words). Add in-depth sections to reach 350+ words.`
      : `Strong content depth (${wordCount} words, ~${readingTimeMinutes} min read).`,
  });

  // 7. Headings Structure (H2 / H3)
  const headingCount = (input.headings || []).length;
  const headingsPassed = headingCount >= 2;
  checks.push({
    id: 'heading_structure',
    label: 'Subheadings (H2/H3 Structure)',
    passed: headingsPassed,
    score: headingsPassed ? 10 : headingCount === 1 ? 5 : 0,
    importance: 'recommended',
    feedback: headingCount === 0
      ? 'No subheadings found. Break up text with descriptive H2 headings.'
      : headingCount < 2
      ? 'Only 1 subheading found. Add at least 2 structured subheadings.'
      : `Good structure with ${headingCount} subheadings.`,
  });

  // 8. Image Alt Text
  const hasImage = Boolean(input.featuredImage);
  const hasAlt = Boolean(input.altText && input.altText.trim().length > 3);
  checks.push({
    id: 'image_alt_text',
    label: 'Featured Image Alt Text',
    passed: !hasImage || hasAlt,
    score: !hasImage ? 6 : hasAlt ? 10 : 2,
    importance: 'recommended',
    feedback: !hasImage
      ? 'No featured image selected.'
      : hasAlt
      ? `Alt text provided: "${input.altText}"`
      : 'Featured image is missing descriptive alt text for accessibility and image SEO.',
  });

  // 9. FAQ Section Schema
  const faqCount = (input.faqSchema || []).length;
  checks.push({
    id: 'faq_section',
    label: 'FAQ Schema Rich Snippets',
    passed: faqCount >= 2,
    score: faqCount >= 2 ? 10 : faqCount === 1 ? 5 : 0,
    importance: 'optional',
    feedback: faqCount === 0
      ? 'Add a FAQ section to qualify for Google rich search results snippet schema.'
      : `FAQ section includes ${faqCount} Q&As ready for Google FAQPage schema.`,
  });

  // 10. Keyword Density in Body
  let kwCount = 0;
  if (primaryKw && content) {
    const escaped = primaryKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = content.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, 'g'));
    kwCount = matches ? matches.length : 0;
  }
  const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
  const densityPassed = !primaryKw || (density >= 0.5 && density <= 3.5);
  checks.push({
    id: 'keyword_density',
    label: 'Primary Keyword Density (0.5% - 3.5%)',
    passed: densityPassed,
    score: !primaryKw ? 5 : densityPassed && kwCount > 0 ? 10 : kwCount > 0 ? 6 : 2,
    importance: 'recommended',
    feedback: !primaryKw
      ? 'Specify a primary keyword to evaluate keyword density.'
      : kwCount === 0
      ? `Keyword "${primaryKw}" not found in article body.`
      : `Keyword appears ${kwCount} times (${density.toFixed(1)}% density).`,
  });

  // Calculate Total Score (Weighted)
  const totalEarned = checks.reduce((sum, c) => sum + c.score, 0);
  const maxPossible = checks.length * 10;
  const score = Math.round((totalEarned / maxPossible) * 100);

  const grade: 'Good' | 'Needs Improvement' | 'Poor' =
    score >= 80 ? 'Good' : score >= 55 ? 'Needs Improvement' : 'Poor';

  const color: 'emerald' | 'amber' | 'rose' =
    grade === 'Good' ? 'emerald' : grade === 'Needs Improvement' ? 'amber' : 'rose';

  return {
    score,
    grade,
    color,
    wordCount,
    readingTimeMinutes,
    checks,
  };
}
