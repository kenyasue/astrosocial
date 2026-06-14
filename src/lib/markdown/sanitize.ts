/**
 * HTML sanitization for rendered Markdown and any imported HTML.
 *
 * Uses an allowlist: only known-safe tags/attributes survive. Scripts, event
 * handlers (on*), `javascript:` URLs, iframes, and inline styles are discarded.
 * External links are forced to `rel="noopener noreferrer"` and open in a new tab.
 */
import sanitize from 'sanitize-html';

const options: sanitize.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'ul', 'ol', 'li', 'blockquote',
    'code', 'pre', 'strong', 'em', 'del', 's', 'hr', 'br',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'input',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    input: ['type', 'checked', 'disabled'],
    th: ['align'],
    td: ['align'],
    code: ['class'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

/** Sanitize an HTML string against the AstroSocial allowlist. */
export function sanitizeHtml(html: string): string {
  return sanitize(html, options);
}
