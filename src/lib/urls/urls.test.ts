import { describe, it, expect } from 'vitest';
import { generatePublicId, isPublicId } from './publicId';
import { slugify, generateSlug } from './slug';
import { profilePath, postCanonicalPath, mediaCanonicalPath } from './canonicalPath';

describe('publicId', () => {
  it('generatePublicId_postPrefix_matchesFormat', () => {
    const id = generatePublicId('p');
    expect(id).toMatch(/^p_[0-9a-f]{8}$/);
    expect(isPublicId(id)).toBe(true);
  });

  it('generatePublicId_isUnique', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePublicId('m')));
    expect(ids.size).toBe(100);
  });

  it('isPublicId_invalid_returnsFalse', () => {
    expect(isPublicId('nope')).toBe(false);
    expect(isPublicId('x_1234')).toBe(false);
  });
});

describe('slugify', () => {
  it('slugify_titleWithSpacesAndCaps_returnsKebab', () => {
    expect(slugify('AstroSocial Design Notes')).toBe('astrosocial-design-notes');
  });

  it('slugify_punctuationAndSymbols_areStripped', () => {
    expect(slugify('Hello, World! @#$ 2024')).toBe('hello-world-2024');
  });

  it('slugify_empty_returnsEmpty', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });

  it('slugify_truncatesToEightyChars', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});

describe('generateSlug', () => {
  it('generateSlug_noCollision_returnsBase', () => {
    expect(generateSlug('AstroSocial Design', 'p_8f3a9c21', () => false)).toBe('astrosocial-design');
  });

  it('generateSlug_collision_appendsNumericSuffix', () => {
    const taken = new Set(['astrosocial-design']);
    expect(generateSlug('AstroSocial Design', 'p_8f3a9c21', (s) => taken.has(s))).toBe(
      'astrosocial-design-2'
    );
  });

  it('generateSlug_multipleCollisions_incrementsSuffix', () => {
    const taken = new Set(['astrosocial-design', 'astrosocial-design-2', 'astrosocial-design-3']);
    expect(generateSlug('AstroSocial Design', 'p_8f3a9c21', (s) => taken.has(s))).toBe(
      'astrosocial-design-4'
    );
  });

  it('generateSlug_noTitle_usesPublicId', () => {
    expect(generateSlug(null, 'p_8f3a9c21', () => false)).toBe('p_8f3a9c21');
  });
});

describe('canonicalPath', () => {
  it('profilePath_buildsAtUsername', () => {
    expect(profilePath('ken')).toBe('/@ken');
  });

  it('postCanonicalPath_buildsPostPath', () => {
    expect(postCanonicalPath('ken', 'astrosocial-design')).toBe('/@ken/posts/astrosocial-design');
  });

  it('mediaCanonicalPath_buildsMediaPath', () => {
    expect(mediaCanonicalPath('ken', 'm_7a2c91df')).toBe('/@ken/media/m_7a2c91df');
  });
});
