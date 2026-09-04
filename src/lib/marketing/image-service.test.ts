import { describe, it, expect } from 'vitest';
import {
  ImageGenerationService,
  sanitizePromptForGuardrails,
  mapImageProviderErrorToApplicationError,
} from './image-service';

describe('AI Image Generation & Guardrails Suite', () => {
  it('TEST 1: sanitizes high-risk trademark words to prevent OpenAI guardrails rejection', () => {
    const raw = 'Create a commercial photo of a Rolex watch on a marble desk with a Nike sports bag';
    const sanitized = sanitizePromptForGuardrails(raw);

    expect(sanitized).not.toMatch(/\brolex\b/i);
    expect(sanitized).not.toMatch(/\bnike\b/i);
    expect(sanitized).toContain('bespoke luxury handcrafted timepiece');
    expect(sanitized).toContain('premium athletic performance footwear');
  });

  it('TEST 2: converts raw OpenAI guardrails refusal into friendly application error', () => {
    const rawError = {
      status: 400,
      message:
        'We’re so sorry, but the image we created may violate our guardrails concerning similarity to third-party content. If you think we got it wrong, please retry or edit your prompt.',
    };

    const appErr = mapImageProviderErrorToApplicationError(rawError, {
      provider: 'openai_dalle3',
      model: 'dall-e-3',
      stage: 'generation',
    });

    expect(appErr.success).toBe(false);
    expect(appErr.code).toBe('PROVIDER_REJECTED');
    expect(appErr.suggestedAction).toBe('edit_prompt');
    // Must NOT contain raw guardrail apology string
    expect(appErr.message).not.toContain('We’re so sorry');
    expect(appErr.message).toContain('protected third-party brands or copyrighted material');
  });

  it('TEST 3: handles mock guardrails failure correctly', async () => {
    const res = await ImageGenerationService.generateImage({
      prompt: 'Cristiano Ronaldo wearing Nike boots holding an Apple iPhone',
      mockFailure: 'guardrails_rejection',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('PROVIDER_REJECTED');
      expect(res.suggestedAction).toBe('edit_prompt');
    }
  });

  it('TEST 4: generates high-resolution image asset cleanly for standard prompts', async () => {
    const res = await ImageGenerationService.generateImage({
      prompt: 'Minimalist artisan ceramic coffee mug on sunlit oak table',
      title: 'Artisan Coffee Mug',
      style: 'Product Photography',
      aspectRatio: '1:1',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.type).toBe('image');
      expect(res.url).toBeTruthy();
      expect(res.status).toBe('completed');
    }
  });
});
