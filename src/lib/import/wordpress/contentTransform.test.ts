import { describe, it, expect } from 'vitest';
import {
  stripBlockComments,
  extractUploadUrls,
  isUploadUrl,
  rewriteUrls,
  htmlToExcerpt,
} from './contentTransform';

const HOSTS = ['astro.beer', 'www.astro.beer'];

const SAMPLE =
  '<!-- wp:image {"id":196} -->\n' +
  '<figure class="wp-block-image"><a href="https://astro.beer/wp-content/uploads/2020/02/m42.jpg">' +
  '<img src="http://astro.beer/wp-content/uploads/2020/02/m42-1024x643.jpg" alt=""/></a></figure>\n' +
  '<!-- /wp:image -->\n<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->';

describe('stripBlockComments', () => {
  it('removes Gutenberg block-marker comments but keeps content', () => {
    const out = stripBlockComments(SAMPLE);
    expect(out).not.toContain('<!--');
    expect(out).toContain('<figure');
    expect(out).toContain('<p>Hello</p>');
  });
});

describe('isUploadUrl', () => {
  it('matches uploads URLs on the configured hosts only', () => {
    expect(isUploadUrl('http://astro.beer/wp-content/uploads/x.jpg', HOSTS)).toBe(true);
    expect(isUploadUrl('https://other.com/wp-content/uploads/x.jpg', HOSTS)).toBe(false);
    expect(isUploadUrl('https://astro.beer/about', HOSTS)).toBe(false);
  });
});

describe('extractUploadUrls', () => {
  it('collects unique src/href upload URLs in order', () => {
    const urls = extractUploadUrls(SAMPLE, HOSTS);
    expect(urls).toEqual([
      'https://astro.beer/wp-content/uploads/2020/02/m42.jpg',
      'http://astro.beer/wp-content/uploads/2020/02/m42-1024x643.jpg',
    ]);
  });
});

describe('rewriteUrls', () => {
  it('rewrites mapped URLs to local media and upgrades unmapped uploads to https', () => {
    const map = new Map([
      ['http://astro.beer/wp-content/uploads/2020/02/m42-1024x643.jpg', '/media/m_abc123/original'],
    ]);
    const out = rewriteUrls(SAMPLE, map, HOSTS);
    expect(out).toContain('src="/media/m_abc123/original"');
    // The unmapped href (http) is normalised to https so it still loads.
    expect(out).toContain('href="https://astro.beer/wp-content/uploads/2020/02/m42.jpg"');
    expect(out).not.toContain('http://astro.beer');
  });

  it('leaves non-upload URLs untouched', () => {
    const html = '<a href="https://example.com/page">x</a>';
    expect(rewriteUrls(html, new Map(), HOSTS)).toBe(html);
  });
});

describe('htmlToExcerpt', () => {
  it('strips tags/comments and collapses whitespace', () => {
    expect(htmlToExcerpt(SAMPLE)).toBe('Hello');
  });

  it('truncates long text on a word boundary with an ellipsis', () => {
    const long = '<p>' + 'word '.repeat(80) + '</p>';
    const out = htmlToExcerpt(long, 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
  });
});
