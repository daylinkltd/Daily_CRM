import { describe, it, expect } from 'vitest';
import {
  ImageGenerationService,
  sanitizePromptForGuardrails,
  mapImageProviderErrorToApplicationError,
  detectPublicFigureIntent,
  generateEditorialFallbackPrompt,
} from './image-service';

describe('AI Image Generation & Guardrails Suite', () => {
  it('TEST 1: sanitizes HTML/rich-text formatting and whitespace while preserving authentic intent without trick evasion', () => {
    const raw = '<div><p>Create a sports graphic for Lionel Messi stats and trophies</p></div>\n\n\t   ';
    const sanitized = sanitizePromptForGuardrails(raw);

    expect(sanitized).toBe('Create a sports graphic for Lionel Messi stats and trophies');
    expect(sanitized).not.toContain('<div>');
    expect(sanitized).not.toContain('<p>');
    // Authentic user terms preserved (no evasion tricks)
    expect(sanitized).toContain('Lionel Messi');
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

  it('TEST 3: detects public figure intents accurately without turning into marketing creatives', () => {
    // Messi stats and trophies -> sports infographic
    const messi = detectPublicFigureIntent('Messi stats and trophies');
    expect(messi.isPublicFigure).toBe(true);
    expect(messi.personName).toBe('Lionel Messi');
    expect(messi.intentCategory).toBe('sports_infographic');
    expect(messi.intentLabel).toBe('Sports Infographic');

    // Cristiano Ronaldo achievements -> achievement poster
    const ronaldo = detectPublicFigureIntent('Cristiano Ronaldo achievements');
    expect(ronaldo.isPublicFigure).toBe(true);
    expect(ronaldo.personName).toBe('Cristiano Ronaldo');
    expect(ronaldo.intentCategory).toBe('achievement_poster');
    expect(ronaldo.intentLabel).toBe('Achievement Poster');

    // Steve Jobs quote -> editorial graphic
    const jobs = detectPublicFigureIntent('Steve Jobs quote');
    expect(jobs.isPublicFigure).toBe(true);
    expect(jobs.personName).toBe('Steve Jobs');
    expect(jobs.intentCategory).toBe('editorial_quote_graphic');
    expect(jobs.intentLabel).toBe('Editorial Graphic');

    // Elon Musk AI quote -> editorial/business graphic
    const musk = detectPublicFigureIntent('Elon Musk AI quote');
    expect(musk.isPublicFigure).toBe(true);
    expect(musk.personName).toBe('Elon Musk');
    expect(musk.intentLabel).toBe('Editorial Graphic');

    // Generic prompt -> not a public figure
    const mug = detectPublicFigureIntent('Minimalist artisan ceramic coffee mug');
    expect(mug.isPublicFigure).toBe(false);
    expect(mug.personName).toBeNull();
  });

  it('TEST 4: generates proper editorial fallback prompt preserving user intent', () => {
    const messiPrompt = generateEditorialFallbackPrompt('Messi stats and trophies');
    expect(messiPrompt).toContain('editorial sports infographic');
    expect(messiPrompt).toContain('Lionel Messi');
    expect(messiPrompt).toContain('trophy icons');
    expect(messiPrompt).toContain('data visualization');
    // Must NOT contain commercial marketing pitch
    expect(messiPrompt).not.toContain('Lead Generation');
    expect(messiPrompt).not.toContain('Signups');
    expect(messiPrompt).not.toContain('Sales CTA');

    const jobsPrompt = generateEditorialFallbackPrompt('Steve Jobs quote');
    expect(jobsPrompt).toContain('editorial graphic inspired by Steve Jobs');
    expect(jobsPrompt).toContain('minimalist typography');
  });

  it('TEST 5: intercepts raw public figure provider error and maps to structured response with actions', () => {
    const rawError = {
      status: 400,
      message: "There are a lot of people I can help with, but I can't depict some public figures.",
    };

    const mapped = mapImageProviderErrorToApplicationError(rawError, {
      provider: 'openai_dalle3',
      model: 'dall-e-3',
      stage: 'generation',
      prompt: 'Messi stats and trophies',
    });

    expect(mapped.success).toBe(false);
    expect(mapped.code).toBe('PUBLIC_FIGURE_REFUSAL');
    expect(mapped.message).toBe("Image couldn't be generated with the current provider.");
    expect(mapped.reason).toBe('This request involves a public figure.');
    expect(mapped.description).toBe(
      'This request involves a public figure. We can generate an original editorial-style graphic instead.'
    );
    expect(mapped.suggestedAction).toBe('editorial_fallback');
    expect(mapped.availableActions).toEqual(['retry', 'editorial_fallback', 'edit_prompt']);
    expect(mapped.fallbackPrompt).toContain('Lionel Messi');
    // Raw provider message must never be shown directly in message
    expect(mapped.message).not.toContain("There are a lot of people I can help with");
  });

  it('TEST 6: handles mock public figure refusal correctly in ImageGenerationService', async () => {
    const res = await ImageGenerationService.generateImage({
      prompt: 'Cristiano Ronaldo achievements',
      mockFailure: 'public_figure_refusal',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('PUBLIC_FIGURE_REFUSAL');
      expect(res.message).toBe("Image couldn't be generated with the current provider.");
      expect(res.reason).toBe('This request involves a public figure.');
      expect(res.suggestedAction).toBe('editorial_fallback');
      expect(res.fallbackPrompt).toContain('Cristiano Ronaldo');
    }
  });

  it('TEST 7: handles mock guardrails failure correctly', async () => {
    const res = await ImageGenerationService.generateImage({
      prompt: 'A can of Coca-Cola with Nike swoosh and Apple logo in neon lights',
      mockFailure: 'guardrails_rejection',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('PROVIDER_REJECTED');
      expect(res.suggestedAction).toBe('edit_prompt');
    }
  });

  it('TEST 8: generates high-resolution image asset cleanly for standard prompts', async () => {
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

