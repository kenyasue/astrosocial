/**
 * Pure Markdown text-editing transforms used by the editor toolbar.
 *
 * Each returns the new text plus the new selection range so the caller can
 * restore the caret. Kept dependency-free and pure so it is unit-testable; the
 * compose page mirrors this logic in an inline script.
 */
export interface EditResult {
  value: string;
  selStart: number;
  selEnd: number;
}

/** Wrap the current selection (or caret) with `before`/`after` markers. */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string = before
): EditResult {
  const selected = text.slice(start, end);
  const value = text.slice(0, start) + before + selected + after + text.slice(end);
  return { value, selStart: start + before.length, selEnd: start + before.length + selected.length };
}

/**
 * Toggle a line prefix (e.g. "## ", "> ", "- ") on every line touched by the
 * selection. If all touched lines already have the prefix, it is removed.
 */
export function toggleLinePrefix(
  text: string,
  start: number,
  end: number,
  prefix: string
): EditResult {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const newLines = lines.map((l) =>
    allPrefixed ? l.slice(prefix.length) : prefix + l
  );
  const newBlock = newLines.join('\n');
  const value = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);
  return { value, selStart: lineStart, selEnd: lineStart + newBlock.length };
}

/** Insert a snippet at the caret position. */
export function insertAtCaret(text: string, pos: number, snippet: string): EditResult {
  const value = text.slice(0, pos) + snippet + text.slice(pos);
  return { value, selStart: pos + snippet.length, selEnd: pos + snippet.length };
}

/** Markdown/HTML snippet to embed a media item by its serving URL. */
export function mediaSnippet(input: {
  mimeType: string;
  originalUrl: string;
  altText?: string | null;
  canonicalPath: string;
}): string {
  const alt = (input.altText ?? '').replace(/[[\]]/g, '');
  if (input.mimeType.startsWith('image/')) {
    return `\n\n![${alt}](${input.originalUrl})\n\n`;
  }
  // Videos: link to the media page (the post sanitizer allows links, not <video>).
  return `\n\n[${alt || 'video'}](${input.canonicalPath})\n\n`;
}
