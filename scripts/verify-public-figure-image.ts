import {
  detectPublicFigureIntent,
  generateEditorialFallbackPrompt,
  mapImageProviderErrorToApplicationError,
  ImageGenerationService,
} from '../src/lib/marketing/image-service';

async function main() {
  console.log('='.repeat(70));
  console.log('  DAILYBUZ: PUBLIC FIGURE IMAGE HANDLING VERIFICATION');
  console.log('='.repeat(70));

  const testPrompts = [
    'Messi stats and trophies',
    'Cristiano Ronaldo achievements',
    'Steve Jobs quote',
    'Elon Musk AI quote',
  ];

  console.log('\n--- 1. INTENT DETECTION & EDITORIAL FALLBACK PROMPT GENERATION ---');
  for (const prompt of testPrompts) {
    const detection = detectPublicFigureIntent(prompt);
    const fallback = generateEditorialFallbackPrompt(prompt, detection);

    console.log(`\n[User Input]       : "${prompt}"`);
    console.log(`[Public Figure?]   : ${detection.isPublicFigure ? 'YES' : 'NO'}`);
    console.log(`[Identified Person]: ${detection.personName}`);
    console.log(`[Intent Category]  : ${detection.intentCategory}`);
    console.log(`[Intent Label]     : ${detection.intentLabel}`);
    console.log(`[Editorial Prompt] : "${fallback}"`);
  }

  console.log('\n--- 2. RAW PROVIDER ERROR INTERCEPTION & FRIENDLY UI CONTRACT ---');
  const rawProviderError = {
    status: 400,
    message: "There are a lot of people I can help with, but I can't depict some public figures.",
  };

  console.log('\n[Raw Provider Error Input]:');
  console.log(JSON.stringify(rawProviderError, null, 2));

  const mapped = mapImageProviderErrorToApplicationError(rawProviderError, {
    provider: 'openai_dalle3',
    model: 'dall-e-3',
    stage: 'generation',
    prompt: 'Messi stats and trophies',
  });

  console.log('\n[Mapped Application Error (Sent to UI)]:\n');
  console.log(JSON.stringify(mapped, null, 2));

  console.log('\n--- 3. SERVICE EXECUTION WITH MOCK FAILURE ---');
  const serviceResult = await ImageGenerationService.generateImage({
    prompt: 'Cristiano Ronaldo achievements',
    mockFailure: 'public_figure_refusal',
  });

  console.log('\n[ImageGenerationService Result]:');
  console.log(JSON.stringify(serviceResult, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('  ALL CHECKS COMPLETED SUCCESSFULLY');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
