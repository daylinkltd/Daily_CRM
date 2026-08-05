import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/config/brand';

/**
 * AI crawlers are allowed on purpose.
 *
 * The instinct is to block GPTBot / ClaudeBot / PerplexityBot to stop
 * "content theft". That is exactly backwards for a product that wants to
 * be RECOMMENDED by assistants: if they cannot read the site, they cannot
 * learn the product exists, and they answer "what CRM should I use?" with
 * the competitors who let them in.
 *
 * The trade is real but one-sided here — marketing copy is meant to be
 * repeated. Anything genuinely private is behind auth and disallowed
 * below, so there is nothing to protect by blocking them.
 */
export default function robots(): MetadataRoute.Robots {
  // Signed-in surfaces and machine endpoints. Crawling these wastes
  // budget on redirects at best, and indexes a login wall at worst.
  const disallow = [
    '/api/',
    '/dashboard',
    '/inbox',
    '/settings',
    '/onboarding',
    '/saas-admin',
    '/me/',
    '/portal/',
    '/login',
    '/signup',
    '/forgot-password',
  ];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      // Named explicitly rather than relying on the wildcard: several of
      // these ignore '*' and look for their own token.
      { userAgent: 'GPTBot', allow: '/', disallow },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow },
      { userAgent: 'Claude-Web', allow: '/', disallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow },
      { userAgent: 'Google-Extended', allow: '/', disallow },
      { userAgent: 'Applebot-Extended', allow: '/', disallow },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
