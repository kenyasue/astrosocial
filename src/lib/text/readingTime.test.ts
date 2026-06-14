import { describe, it, expect } from 'vitest';
import { readingMinutesFromText, readingMinutesFromLength } from './readingTime';

describe('readingMinutesFromText', () => {
  it('returns at least 1 minute for short text', () => {
    expect(readingMinutesFromText('a few words here')).toBe(1);
    expect(readingMinutesFromText('')).toBe(1);
  });

  it('scales with word count (~200 wpm)', () => {
    const text = Array.from({ length: 600 }, () => 'word').join(' ');
    expect(readingMinutesFromText(text)).toBe(3);
  });
});

describe('readingMinutesFromLength', () => {
  it('returns at least 1 minute', () => {
    expect(readingMinutesFromLength(0)).toBe(1);
    expect(readingMinutesFromLength(50)).toBe(1);
  });

  it('estimates from character length (~5 chars/word, 200 wpm)', () => {
    // 6000 chars ≈ 1200 words ≈ 6 minutes
    expect(readingMinutesFromLength(6000)).toBe(6);
  });
});
