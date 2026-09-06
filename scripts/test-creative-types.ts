import {
  parseDynamicCreativeIntent,
  buildDetailedImagePrompt,
  stripLegalCompanySuffix,
  resolveBrandIdentity,
} from '../src/lib/marketing/ai-generator';

const TEST_CASES = [
  {
    id: 'T1',
    input: 'messi stats and trophies',
    brandContext: undefined,
    expectedType: 'Sports Information / Achievement Graphic',
    expectedBrand: null,
  },
  {
    id: 'T2',
    input: 'create an internship poster',
    brandContext: { businessName: 'Apex Innovations' },
    expectedType: 'Internship / Recruitment Poster',
    expectedBrand: 'Apex Innovations',
  },
  {
    id: 'T3',
    input: "promote our restaurant's new pizza",
    brandContext: { businessName: 'Bella Napoli Trattoria' },
    expectedType: 'Culinary Promotional Poster',
    expectedBrand: 'Bella Napoli Trattoria',
  },
  {
    id: 'T4',
    input: 'announce our office holiday',
    brandContext: { businessName: 'CloudScale Technologies' },
    expectedType: 'Office Holiday Announcement Poster',
    expectedBrand: 'CloudScale Technologies',
  },
  {
    id: 'T5',
    input: 'create a SaaS product feature graphic',
    brandContext: { businessName: 'DataPulse Analytics' },
    expectedType: 'SaaS Product Feature Graphic',
    expectedBrand: 'DataPulse Analytics',
  },
  {
    id: 'T6',
    input: 'make an educational post about cybersecurity',
    brandContext: undefined,
    expectedType: 'Educational Infographic',
    expectedBrand: null,
  },
  {
    id: 'T7',
    input: 'create a real-estate property poster',
    brandContext: { businessName: 'Skyline Luxury Living' },
    expectedType: 'Real Estate Poster',
    expectedBrand: 'Skyline Luxury Living',
  },
  {
    id: 'T8',
    input: 'daylink tech labs services poster',
    brandContext: undefined,
    expectedType: 'Services Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 'T9',
    input: 'make a poster for our CRM',
    brandContext: { businessName: 'Daylink Tech Labs Private Limited' },
    expectedType: 'CRM Product Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 'T10',
    input: 'pizza menu poster',
    brandContext: { businessName: 'Mama Mia Pizzeria' },
    expectedType: 'Menu Poster',
    expectedBrand: 'Mama Mia Pizzeria',
  },
];

console.log('\n================================================================');
console.log(' MARKETING AI CREATIVE PROMPT GENERATOR — VERIFICATION RUNNER');
console.log('================================================================\n');

let allPassed = true;

for (const tc of TEST_CASES) {
  const intent = parseDynamicCreativeIntent({
    rawInput: tc.input,
    brandContext: tc.brandContext,
    platform: 'instagram',
  });

  const prompt = buildDetailedImagePrompt({
    topic: tc.input,
    brandContext: tc.brandContext,
    platforms: ['instagram'],
  });

  const headerMatch = prompt.match(/^CREATE A PREMIUM [^\n.]+\./m);
  const promptHeader = headerMatch ? headerMatch[0] : 'N/A';

  const typeMatches = intent.creativeType.label === tc.expectedType;
  const brandMatches =
    tc.expectedBrand === null
      ? intent.brand.name === null
      : intent.brand.name === tc.expectedBrand;

  const passed = typeMatches && brandMatches;
  if (!passed) allPassed = false;

  console.log(`[TEST ${tc.id}] Input: "${tc.input}"`);
  console.log(`  • Brand:         ${intent.brand.name || 'None'} (Source: ${intent.brand.source})`);
  if (intent.brand.legalName && intent.brand.legalName !== intent.brand.name) {
    console.log(`  • Legal Name:    ${intent.brand.legalName}`);
  }
  console.log(`  • Creative Type: ${intent.creativeType.label} (Source: ${intent.creativeType.source})`);
  console.log(`  • Platform:      ${intent.platform.toUpperCase()} (${intent.aspectRatio})`);
  console.log(`  • Quick Starter: ${intent.quickStarter || 'None'}`);
  console.log(`  • Prompt Header: "${promptHeader}"`);
  console.log(`  • Status:        ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
}

console.log('================================================================');
console.log(` IMAGE CREATIVES RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('================================================================\n');

import { resolveVideoIntent, buildDetailedVideoPrompt } from '../src/lib/marketing/ai-generator';

console.log('================================================================');
console.log(' DYNAMIC VIDEO INTENT & GENERATION — VERIFICATION RUNNER');
console.log('================================================================\n');

const VIDEO_TEST_CASES = [
  {
    id: 'V1',
    input: 'messi stats and trophies',
    expectedCategory: 'sports_statistics',
    expectedLabel: 'Sports / Statistics Video',
    forbiddenTerms: ['Lead Generation & Signups', 'Discerning customers', 'Daylink Tech Labs', '10-SECOND'],
  },
  {
    id: 'V2',
    input: '2BHK apartment walkthrough',
    expectedCategory: 'real_estate_walkthrough',
    expectedLabel: 'Real Estate Walkthrough',
    forbiddenTerms: ['Lead Generation & Signups', 'AI CRM', 'Messi', 'Daylink Tech Labs'],
  },
  {
    id: 'V3',
    input: 'summer collection video',
    expectedCategory: 'fashion_collection',
    expectedLabel: 'Fashion / Collection Video',
    forbiddenTerms: ['Lead Generation & Signups', 'Daylink Tech Labs', 'software'],
  },
  {
    id: 'V4',
    input: 'company introduction video',
    brandContext: { businessName: 'Apex Health Systems' },
    expectedCategory: 'corporate_introduction',
    expectedLabel: 'Corporate Introduction',
    forbiddenTerms: ['Daylink Tech Labs', 'Lead Generation & Signups'],
  },
  {
    id: 'V5',
    input: '10 second instagram ad for our pizza',
    expectedCategory: 'promotional_advertisement',
    expectedLabel: 'Promotional Advertisement',
    expectedDuration: '10 seconds',
    expectedPlatform: 'instagram',
    forbiddenTerms: ['Daylink Tech Labs', 'Discerning customers'],
  },
  {
    id: 'V6',
    input: 'show our services in a video',
    brandContext: { businessName: 'Veloce Logistics' },
    expectedCategory: 'services_showcase',
    expectedLabel: 'Services Showcase',
    forbiddenTerms: ['Daylink Tech Labs', 'Lead Generation & Signups'],
  },
];

let allVideoPassed = true;

for (const vtc of VIDEO_TEST_CASES) {
  const intent = resolveVideoIntent({
    rawRequest: vtc.input,
    brandContext: vtc.brandContext,
  });

  const prompt = buildDetailedVideoPrompt({
    topic: vtc.input,
    brandContext: vtc.brandContext,
  });

  const categoryMatches = intent.videoType.category === vtc.expectedCategory;
  const labelMatches = intent.videoType.label === vtc.expectedLabel;
  const durationMatches = vtc.expectedDuration ? intent.duration === vtc.expectedDuration : true;
  const platformMatches = vtc.expectedPlatform ? intent.platform === vtc.expectedPlatform : true;
  const cleanOfForbidden = vtc.forbiddenTerms.every(t => !prompt.includes(t));

  const passed = categoryMatches && labelMatches && durationMatches && platformMatches && cleanOfForbidden;
  if (!passed) allVideoPassed = false;

  console.log(`[VIDEO TEST ${vtc.id}] Input: "${vtc.input}"`);
  console.log(`  • Video Type:    ${intent.videoType.label} (${intent.videoType.category})`);
  console.log(`  • Subject:       ${intent.subject}`);
  console.log(`  • Objective:     ${intent.objective || 'None'}`);
  console.log(`  • Brand:         ${intent.brandName || 'None'}`);
  console.log(`  • Duration:      ${intent.duration || 'Dynamic / Unspecified'}`);
  console.log(`  • Platform:      ${intent.platform || 'Dynamic / Unspecified'}`);
  console.log(`  • Status:        ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
}

console.log('================================================================');
console.log(` OVERALL RESULT: ${allPassed && allVideoPassed ? '✅ ALL SUITES PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('================================================================\n');
