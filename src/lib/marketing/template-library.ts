export interface ContentTemplate {
  id: string;
  category: 'social' | 'blog';
  type: string;
  name: string;
  description: string;
  structure: {
    sections: Array<{
      key: string;
      label: string;
      description: string;
      guidance: string;
    }>;
    suggestedCta: string;
    defaultHashtagSeed: string[];
  };
  defaultTone: 'engaging' | 'professional' | 'concise' | 'creative' | 'educational';
}

export const SOCIAL_TEMPLATES: ContentTemplate[] = [
  {
    id: 'soc_prod_promo',
    category: 'social',
    type: 'product_promotion',
    name: 'Product Promotion',
    description: 'Direct response formula emphasizing value proposition, problem solved, and immediate CTA.',
    structure: {
      sections: [
        { key: 'hook', label: 'Hook / Attention Grabber', description: 'Punchy headline calling out the primary pain point or desire', guidance: 'Use bold statement or relatable question.' },
        { key: 'problem', label: 'The Problem', description: 'Describe why current methods are failing or inefficient', guidance: 'Agitate the friction without being negative.' },
        { key: 'solution', label: 'The Solution', description: 'Introduce the product feature as the clean answer', guidance: 'Keep benefits tangible.' },
        { key: 'benefits', label: 'Key Highlights', description: '3 bullet points of tangible ROI or workflow speed', guidance: 'Use emoji bullets.' },
        { key: 'cta', label: 'Call to Action', description: 'Clear next step for the reader', guidance: 'Link in bio, comment below, or start trial.' },
      ],
      suggestedCta: 'Start your free trial today or click the link in bio to learn more!',
      defaultHashtagSeed: ['#Productivity', '#GrowthHacking', '#BusinessTools', '#SaaS'],
    },
    defaultTone: 'engaging',
  },
  {
    id: 'soc_educational',
    category: 'social',
    type: 'educational',
    name: 'Educational / How-To',
    description: 'Value-first actionable breakdown teaching a concept, workflow, or framework.',
    structure: {
      sections: [
        { key: 'hook', label: 'Educational Hook', description: 'Promise a valuable takeaway in under 2 minutes', guidance: 'e.g. "Here is how high-performing teams streamline..."' },
        { key: 'step1', label: 'Step 1: Diagnostic', description: 'Identify where most teams lose time or money', guidance: 'Actionable advice.' },
        { key: 'step2', label: 'Step 2: Implementation', description: 'Specific tool or process to fix it', guidance: 'Practical steps.' },
        { key: 'step3', label: 'Step 3: Verification', description: 'How to track results', guidance: 'Metric to monitor.' },
        { key: 'takeaway', label: 'Summary & CTA', description: 'Encourage bookmarking/saving for later', guidance: 'Save this post for your next planning session.' },
      ],
      suggestedCta: 'Save this post to implement with your team this week! 📌',
      defaultHashtagSeed: ['#Leadership', '#Operations', '#WorkflowOptimization', '#TipsAndTricks'],
    },
    defaultTone: 'educational',
  },
  {
    id: 'soc_announcement',
    category: 'social',
    type: 'announcement',
    name: 'Announcement / Launch',
    description: 'Exciting reveal for new releases, feature drops, milestones, or company events.',
    structure: {
      sections: [
        { key: 'hook', label: 'Big Reveal', description: 'Exciting teaser of what is new', guidance: 'e.g. "We are thrilled to announce..."' },
        { key: 'details', label: 'What Changed', description: 'Explain the new capability and what it unlocks', guidance: 'Focus on user benefit.' },
        { key: 'availability', label: 'Availability', description: 'Who gets access and when', guidance: 'Live right now for all users.' },
        { key: 'cta', label: 'Launch CTA', description: 'Invite users to test it out', guidance: 'Check the link to try it out!' },
      ],
      suggestedCta: 'Explore the new update in your dashboard today! 🚀',
      defaultHashtagSeed: ['#ProductLaunch', '#NewFeature', '#Innovation', '#TechNews'],
    },
    defaultTone: 'creative',
  },
  {
    id: 'soc_offer',
    category: 'social',
    type: 'offer',
    name: 'Limited-Time Offer',
    description: 'Urgency-driven promotional post for discounts, seasonal campaigns, and special deals.',
    structure: {
      sections: [
        { key: 'hook', label: 'Urgency Hook', description: 'Limited time discount or seasonal deal announcement', guidance: 'Highlight value.' },
        { key: 'terms', label: 'Offer Terms', description: 'Discount percentage, bonus inclusions, deadline', guidance: 'Be clear on deadlines.' },
        { key: 'cta', label: 'Claim CTA', description: 'Direct checkout or promo code instruction', guidance: 'Use code at checkout.' },
      ],
      suggestedCta: 'Claim your exclusive offer before midnight! ⏳',
      defaultHashtagSeed: ['#SpecialOffer', '#LimitedTime', '#DealOfTheDay', '#UpgradeNow'],
    },
    defaultTone: 'engaging',
  },
  {
    id: 'soc_testimonial',
    category: 'social',
    type: 'testimonial',
    name: 'Customer Story / Testimonial',
    description: 'Social proof showcasing real customer outcomes and transformational results.',
    structure: {
      sections: [
        { key: 'quote', label: 'Customer Quote', description: 'High-impact soundbite from a verified customer', guidance: 'Direct quote.' },
        { key: 'context', label: 'The Challenge', description: 'What problem the customer faced before', guidance: 'Relatable context.' },
        { key: 'result', label: 'The Outcome', description: 'Specific metrics achieved (e.g. 40% time saved)', guidance: 'Concrete numbers.' },
        { key: 'cta', label: 'CTA', description: 'Invite readers to achieve similar results', guidance: 'See full case study.' },
      ],
      suggestedCta: 'Read the full customer story and see how your team can achieve the same results.',
      defaultHashtagSeed: ['#CustomerSuccess', '#SocialProof', '#CaseStudy', '#ClientWins'],
    },
    defaultTone: 'professional',
  },
  {
    id: 'soc_industry_insight',
    category: 'social',
    type: 'industry_insight',
    name: 'Industry Insight / Thought Leadership',
    description: 'Authoritative analysis on industry trends, future outlooks, and strategic perspectives.',
    structure: {
      sections: [
        { key: 'observation', label: 'Market Observation', description: 'Emerging pattern or shift in consumer/B2B behavior', guidance: 'Bold point of view.' },
        { key: 'analysis', label: 'Why It Matters', description: 'Deep-dive into the strategic implications', guidance: 'Data-driven perspective.' },
        { key: 'recommendation', label: 'Strategic Advice', description: 'Action item for leaders to prepare', guidance: 'Proactive guidance.' },
        { key: 'question', label: 'Engagement Question', description: 'Prompt discussion in the comments', guidance: 'What is your take on this shift?' },
      ],
      suggestedCta: 'What is your take on this shift? Let us know in the comments below! 👇',
      defaultHashtagSeed: ['#IndustryTrends', '#ThoughtLeadership', '#FutureOfWork', '#Strategy'],
    },
    defaultTone: 'professional',
  },
];

export const BLOG_TEMPLATES: ContentTemplate[] = [
  {
    id: 'blog_how_to',
    category: 'blog',
    type: 'how_to',
    name: 'Step-by-Step How-To Guide',
    description: 'Comprehensive, search-optimized tutorial walking users through solving a complex problem.',
    structure: {
      sections: [
        { key: 'intro', label: 'Introduction & Problem Statement', description: 'Why this problem matters and what readers will learn', guidance: 'Hook readers and summarize the end goal.' },
        { key: 'prerequisites', label: 'Prerequisites & Tools Required', description: 'Everything needed before starting', guidance: 'Bullet list.' },
        { key: 'steps', label: 'Detailed Step-by-Step Walkthrough', description: '3-5 clear phases with actionable subheadings (H2/H3)', guidance: 'Include practical screenshots or code if applicable.' },
        { key: 'common_mistakes', label: 'Common Pitfalls & How to Avoid Them', description: 'Troubleshooting guide for edge cases', guidance: 'Save readers time.' },
        { key: 'faq', label: 'Frequently Asked Questions', description: '3-4 targeted Q&As for SEO rich snippet capture', guidance: 'Target long-tail queries.' },
        { key: 'conclusion', label: 'Conclusion & Next Steps', description: 'Summary with actionable CTA', guidance: 'Encourage product adoption or trial.' },
      ],
      suggestedCta: 'Ready to automate this workflow? Try our integrated platform for free today.',
      defaultHashtagSeed: ['#HowToGuide', '#Tutorial', '#StepByStep', '#BestPractices'],
    },
    defaultTone: 'educational',
  },
  {
    id: 'blog_listicle',
    category: 'blog',
    type: 'listicle',
    name: 'Curated Listicle / Round-Up',
    description: 'High-traffic list of strategies, tools, or best practices with clear headings.',
    structure: {
      sections: [
        { key: 'intro', label: 'Overview', description: 'Context on why this curation is essential right now', guidance: 'Quick hook.' },
        { key: 'items', label: 'List Items (1 to 7)', description: 'Each item features a strong H2 heading, overview, pros/cons, and ideal use case', guidance: 'Structured breakdowns.' },
        { key: 'evaluation', label: 'Comparison & Decision Matrix', description: 'How to choose the right option for your specific team', guidance: 'Practical decision guide.' },
        { key: 'conclusion', label: 'Final Recommendation', description: 'Closing verdict and CTA', guidance: 'Direct recommendation.' },
      ],
      suggestedCta: 'Explore how Daily CRM ranks across speed, omnichannel sync, and team automation.',
      defaultHashtagSeed: ['#TopTools', '#Roundup', '#SoftwareReview', '#TechStack'],
    },
    defaultTone: 'engaging',
  },
  {
    id: 'blog_comparison',
    category: 'blog',
    type: 'comparison',
    name: 'In-Depth Product / Strategy Comparison',
    description: 'High-intent buyer guide comparing alternative solutions, features, and pricing.',
    structure: {
      sections: [
        { key: 'intro', label: 'Executive Summary', description: 'Brief overview of both contenders and target evaluation criteria', guidance: 'Unbiased framing.' },
        { key: 'criteria1', label: 'Feature Breakdown & Capabilities', description: 'Head-to-head comparison of core features', guidance: 'Detailed matrix.' },
        { key: 'criteria2', label: 'Ease of Use & Onboarding', description: 'Setup time, learning curve, team adoption', guidance: 'Real-world usability.' },
        { key: 'criteria3', label: 'Pricing & ROI', description: 'Cost comparison, hidden fees, seat tiers', guidance: 'Transparency.' },
        { key: 'verdict', label: 'Final Verdict & Best For', description: 'Clear guidance on which option to pick depending on company stage', guidance: 'Clear winner breakdown.' },
      ],
      suggestedCta: 'See why teams switch to our unified workspace for unmatched productivity.',
      defaultHashtagSeed: ['#ProductComparison', '#BuyerGuide', '#SoftwareEvaluation', '#B2BSoftware'],
    },
    defaultTone: 'professional',
  },
  {
    id: 'blog_case_study',
    category: 'blog',
    type: 'case_study',
    name: 'Customer Case Study & ROI Deep-Dive',
    description: 'Data-rich narrative illustrating how a customer solved a problem and achieved massive ROI.',
    structure: {
      sections: [
        { key: 'summary', label: 'Key Metrics & Highlights', description: 'Executive snapshot of the results (e.g. 3.4x conversion, 60% faster response)', guidance: 'Stat callouts.' },
        { key: 'about', label: 'About the Client', description: 'Company size, industry, and previous tech stack', guidance: 'Context.' },
        { key: 'challenge', label: 'The Bottleneck', description: 'The operational roadblocks holding them back', guidance: 'Specific hurdles.' },
        { key: 'solution', label: 'Implementation Strategy', description: 'How our platform was rolled out across their team', guidance: 'Step-by-step rollout.' },
        { key: 'results', label: 'Measurable Outcomes', description: 'Detailed quantitative and qualitative metrics after 90 days', guidance: 'Hard data.' },
      ],
      suggestedCta: 'Book a demo to see how we can deliver similar results for your business.',
      defaultHashtagSeed: ['#CaseStudy', '#CustomerSuccess', '#ROIGrowth', '#EnterpriseGrowth'],
    },
    defaultTone: 'professional',
  },
];

export function getTemplateById(id: string): ContentTemplate | undefined {
  return [...SOCIAL_TEMPLATES, ...BLOG_TEMPLATES].find((t) => t.id === id);
}
