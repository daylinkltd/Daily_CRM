import {
  parseDynamicCreativeIntent,
  buildDetailedImagePrompt,
  stripLegalCompanySuffix,
  resolveBrandIdentity,
} from '../src/lib/marketing/ai-generator';

const TEST_CASES = [
  {
    id: 1,
    input: 'daylink tech labs services poster',
    brandContext: undefined,
    expectedType: 'Services Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 2,
    input: 'daylink tech labs internship poster',
    brandContext: undefined,
    expectedType: 'Internship / Recruitment Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 3,
    input: 'daylink tech labs website development poster',
    brandContext: undefined,
    expectedType: 'Website Development Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 4,
    input: 'daylink tech labs AI automation poster',
    brandContext: undefined,
    expectedType: 'AI / Automation Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 5,
    input: 'make something for Daylink Tech Labs',
    brandContext: undefined,
    expectedType: 'Not specified',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 6,
    input: 'AI automation services',
    brandContext: undefined,
    expectedType: 'AI / Automation Services',
    expectedBrand: null,
  },
  {
    id: 7,
    input: 'create an Instagram post',
    brandContext: undefined,
    expectedType: 'Not specified',
    expectedBrand: null,
  },
  {
    id: 8,
    input: 'make a poster for our CRM',
    brandContext: { businessName: 'Daylink Tech Labs Private Limited' },
    expectedType: 'CRM Product Poster',
    expectedBrand: 'Daylink Tech Labs',
  },
  {
    id: 10,
    input: 'weekend pizza offer',
    brandContext: { businessName: 'ABC Pizza LLC' },
    expectedType: 'Sale Promotional Creative',
    expectedBrand: 'ABC Pizza',
  },
  {
    id: 11,
    input: '2BHK apartment launch poster',
    brandContext: { businessName: 'XYZ Properties' },
    expectedType: 'Property Launch Poster',
    expectedBrand: 'XYZ Properties',
  },
  {
    id: 12,
    input: 'summer collection poster',
    brandContext: { businessName: 'ABC Fashion' },
    expectedType: 'Product Collection Poster',
    expectedBrand: 'ABC Fashion',
  },
  {
    id: 13,
    input: 'employee hiring poster',
    brandContext: { businessName: 'Global Hospital Care' },
    expectedType: 'Recruitment Poster',
    expectedBrand: 'Global Hospital Care',
  },
  {
    id: 14,
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
console.log(` OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('================================================================\n');
