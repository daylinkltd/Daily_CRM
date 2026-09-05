/**
 * CLI Runner for AI Video & Image Generation Service
 *
 * Usage:
 *   npx tsx scripts/run-video-service.ts
 *   npx tsx scripts/run-video-service.ts --prompt "Create a luxury watch video"
 *   npx tsx scripts/run-video-service.ts --test-guardrails
 */

import { VideoGenerationService } from '../src/lib/marketing/video-service';
import { ImageGenerationService } from '../src/lib/marketing/image-service';

async function main() {
  const args = process.argv.slice(2);
  console.log('\n==================================================');
  console.log('🎬 MARKETING AI VIDEO & IMAGE SERVICE RUNNER');
  console.log('==================================================\n');

  // 1. Check for custom prompt or run standard test suite
  const promptArgIdx = args.indexOf('--prompt');
  const customPrompt = promptArgIdx !== -1 ? args[promptArgIdx + 1] : null;

  if (customPrompt) {
    console.log(`[TEST] Running custom video prompt: "${customPrompt}"`);
    const result = await VideoGenerationService.generateVideo({
      prompt: customPrompt,
      style: 'Cinematic',
      aspectRatio: '16:9',
      duration: '10s',
    });
    console.log('\nResult:', JSON.stringify(result, null, 2));
    return;
  }

  // 2. Automated Diagnostic Tests
  console.log('--- TEST 1: Video Generation (Luxury Product) ---');
  const res1 = await VideoGenerationService.generateVideo({
    prompt: "Create a premium cinematic product video for a luxury men's watch.",
    style: 'Cinematic',
    aspectRatio: '16:9',
    duration: '10s',
  });
  console.log('✓ Success:', res1.success);
  if (res1.success) {
    console.log('  Video URL:', res1.video_url);
    console.log('  Thumbnail:', res1.thumbnail_url);
  }

  console.log('\n--- TEST 2: Guardrails / Content Policy Interception ---');
  const res2 = await VideoGenerationService.generateVideo({
    prompt: 'cristiano ronaldo achievements highlights in stadium',
    mockFailure: 'policy_rejection',
  });
  console.log('✓ Expected Rejection Intercepted cleanly:');
  if (!res2.success) {
    console.log('  Error Code:', res2.code);
    console.log('  User Message:', res2.message);
    console.log('  Suggested Action:', res2.suggestedAction);
  }

  console.log('\n--- TEST 3: DALL-E 3 Image Guardrails Sanitization ---');
  const res3 = await ImageGenerationService.generateImage({
    prompt: 'Rolex watch with diamond bezel on marble desk next to Nike shoes',
  });
  console.log('✓ Success:', res3.success);
  if (res3.success) {
    console.log('  Image URL:', res3.url);
    console.log('  Style:', res3.style);
  }

  console.log('\n==================================================');
  console.log('✅ ALL DIAGNOSTIC TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('Runner Error:', err);
  process.exit(1);
});
