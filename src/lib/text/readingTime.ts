/**
 * Estimated reading time helpers (~200 words per minute).
 *
 * Two variants so list/feed queries never need the full post body: cards estimate
 * from the stored body length, detail pages compute from the actual text.
 */
const WORDS_PER_MINUTE = 200;
const CHARS_PER_WORD = 5;

/** Reading time in whole minutes from the post text (min 1). */
export function readingMinutesFromText(text: string): number {
  const words = (text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Reading time in whole minutes estimated from a character count (min 1). */
export function readingMinutesFromLength(charLength: number): number {
  const words = Math.max(0, charLength) / CHARS_PER_WORD;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
