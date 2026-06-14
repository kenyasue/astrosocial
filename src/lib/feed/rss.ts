/**
 * RSS 2.0 feed generation for the latest published posts.
 */
import type { PostCard } from '../types';

/** Escape text for inclusion in XML. */
export function escapeXml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build an RSS 2.0 document for the given post cards.
 *
 * @param items - Published post cards, newest first
 * @param baseUrl - Absolute site origin (e.g. https://example.com), no trailing slash
 */
export function buildRssFeed(items: PostCard[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const entries = items
    .map((p) => {
      const link = `${base}${p.canonicalPath}`;
      const date = new Date(p.publishedAt ?? p.createdAt).toUTCString();
      return `    <item>
      <title>${escapeXml(p.title ?? 'Untitled')}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(date)}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AstroSocial</title>
    <link>${escapeXml(base)}/</link>
    <description>Latest posts on AstroSocial</description>
${entries}
  </channel>
</rss>`;
}
