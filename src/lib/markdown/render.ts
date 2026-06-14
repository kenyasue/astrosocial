/**
 * Markdown rendering.
 *
 * Parses GitHub-flavored Markdown to HTML with `marked`, then runs the result
 * through the sanitizer so the stored output is always XSS-safe.
 */
import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';

marked.setOptions({ gfm: true, breaks: false });

/** Render a Markdown string to sanitized HTML. */
export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md ?? '', { async: false }) as string;
  return sanitizeHtml(rawHtml);
}

/**
 * Build a short plain-text excerpt from Markdown (for cards/meta).
 *
 * @param md - Markdown source
 * @param maxLength - Maximum excerpt length (default 200)
 */
export function excerptFromMarkdown(md: string, maxLength = 200): string {
  const text = (md ?? '')
    // Strip code fences, HTML tags, then common Markdown punctuation.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}
