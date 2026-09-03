import { describe, it, expect } from 'vitest';
import { validateMediaForPlatforms } from './media-validator';

describe('validateMediaForPlatforms', () => {
  it('passes when media URL is valid and size is within limits', () => {
    const res = validateMediaForPlatforms(
      {
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
        type: 'image',
        fileSizeMb: 2.5,
      },
      ['instagram', 'linkedin']
    );

    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('rejects oversized image for Instagram', () => {
    const res = validateMediaForPlatforms(
      {
        url: 'https://example.com/huge-image.png',
        type: 'image',
        fileSizeMb: 15,
      },
      ['instagram']
    );

    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('maximum file size');
  });

  it('fails on invalid URL format', () => {
    const res = validateMediaForPlatforms(
      {
        url: 'not-a-valid-url',
        type: 'image',
      },
      ['linkedin']
    );

    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('invalid');
  });
});
