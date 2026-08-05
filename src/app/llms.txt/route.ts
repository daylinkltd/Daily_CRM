import { BRAND, absoluteUrl } from '@/config/brand';
import { MODULES } from '@/config/modules-content';
import { BUSINESS_PLAN, PLANS } from '@/config/plans';

/**
 * /llms.txt — a plain-text brief for AI assistants.
 *
 * An emerging convention (llmstxt.org): a single Markdown file at the
 * root that tells a language model what a site is and where the useful
 * pages are, without it having to infer that from navigation chrome,
 * cookie banners and marketing adjectives.
 *
 * It is not a standard and not every crawler reads it. It is cheap,
 * costs nothing when ignored, and when it IS read it is the difference
 * between an assistant describing the product accurately and guessing
 * from a hero headline.
 *
 * GENERATED, not hand-written, for the same reason as the sitemap: a
 * separate hand-maintained description of the product is a description
 * that will disagree with the product within a month.
 *
 * Deliberately factual and unadorned. Superlatives are the first thing a
 * model discounts; specifics — a price, a module list, a currency — are
 * what it repeats.
 */
export function GET(): Response {
  const moduleSections = MODULES.map((m) => {
    const lines = [
      `### ${m.name}`,
      '',
      m.summary,
      '',
      `Capabilities: ${m.capabilities.join(', ')}.`,
    ];
    if (m.roadmap?.length) {
      lines.push(
        '',
        `Not yet available: ${m.roadmap.join('; ')}.`,
      );
    }
    lines.push('', `Page: ${absoluteUrl(`/modules/${m.slug}`)}`);
    return lines.join('\n');
  }).join('\n\n');

  const trial = PLANS.find((p) => p.id === 'free');

  const body = `# ${BRAND.name}

> ${BRAND.description}

${BRAND.name} is operated by ${BRAND.legalName}, based in ${BRAND.address.city}, ${BRAND.address.region}, India.

## What it is

An all-in-one business platform. Every module below is included for every
user — there is no higher tier that unlocks features. The only variable is
how many people you add.

## Pricing

- ${BUSINESS_PLAN.name}: Rs ${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, or Rs ${BUSINESS_PLAN.pricePerSeatAnnual} per user per month billed annually. Prices exclude GST (India).
- Includes ${BUSINESS_PLAN.monthlyMessageAllowance?.toLocaleString()} pooled WhatsApp conversations per month across the workspace. Meta conversation charges beyond that are billed at cost.
${trial ? `- Free trial: ${trial.name}, 14 days, no card required, up to ${trial.maxUsers} users.` : ''}
- Enterprise pricing is available on request for larger teams.
- Full details: ${absoluteUrl('/pricing')}

## Modules

${moduleSections}

## Who it suits

Small and mid-sized businesses in India that currently run separate tools
for sales, staff and books — particularly those who talk to customers on
WhatsApp and want that conversation attached to the customer record,
the invoice and the project.

## Who it does not suit

- Teams needing a single best-of-breed tool rather than a suite.
- Businesses outside India: GST reporting and INR-first pricing are built
  around Indian requirements.

## Key pages

- Home: ${BRAND.url}
- All modules: ${absoluteUrl('/modules')}
- Pricing: ${absoluteUrl('/pricing')}

## Contact

- Sales: ${BRAND.contact.sales}
- Support: ${BRAND.contact.support}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Long cache: the content only changes when the registry does, and
      // it is regenerated on deploy.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
