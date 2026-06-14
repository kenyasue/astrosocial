/**
 * Pure HTML transforms for WordPress post bodies.
 *
 * WordPress (Gutenberg) bodies are HTML peppered with block-marker comments
 * (`<!-- wp:image … -->`) and absolute upload URLs. We strip the comments and
 * rewrite the upload URLs to AstroSocial's local media URLs so the body — stored
 * verbatim as the post's `markdown_body` and later run through
 * `marked → sanitizeHtml` — renders almost exactly like the original.
 */

/** Remove all HTML comments (Gutenberg block markers and any others). */
export function stripBlockComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');
}

/**
 * Find every absolute upload URL referenced by an `src`/`href` attribute whose
 * host is one of `hosts` and whose path contains `/wp-content/uploads/`.
 *
 * @returns Unique URLs in first-seen order.
 */
export function extractUploadUrls(html: string, hosts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const attr = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attr.exec(html)) !== null) {
    const url = m[1];
    if (isUploadUrl(url, hosts) && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** True if `url` is an absolute upload URL on one of the given hosts. */
export function isUploadUrl(url: string, hosts: string[]): boolean {
  if (!/\/wp-content\/uploads\//.test(url)) return false;
  return hosts.some((h) => url.includes(`//${h}/`) || url.includes(`//${h}\\`));
}

/**
 * Rewrite URLs in `src`/`href` attributes.
 *
 * - URLs present in `map` are replaced with the mapped (local) URL.
 * - Other upload URLs on `hosts` are normalised to `https` so the image still
 *   loads from the original site when it was not copied locally.
 */
export function rewriteUrls(html: string, map: Map<string, string>, hosts: string[]): string {
  return html.replace(/(src|href)\s*=\s*["']([^"']+)["']/gi, (full, attr: string, url: string) => {
    const mapped = map.get(url);
    if (mapped) return `${attr}="${mapped}"`;
    if (isUploadUrl(url, hosts) && url.startsWith('http://')) {
      return `${attr}="${'https://' + url.slice('http://'.length)}"`;
    }
    return full;
  });
}

/**
 * Build a short plain-text excerpt from an HTML body (tags and entities
 * stripped, whitespace collapsed).
 */
export function htmlToExcerpt(html: string, maxLength = 200): string {
  const text = stripBlockComments(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?[a-z0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}
