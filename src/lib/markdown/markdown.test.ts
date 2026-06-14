import { describe, it, expect } from 'vitest';
import { renderMarkdown, excerptFromMarkdown } from './render';
import { sanitizeHtml } from './sanitize';

describe('renderMarkdown', () => {
  it('renders headings, bold, italic', () => {
    const html = renderMarkdown('# Title\n\n**bold** and *italic*');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders lists, code, blockquote, and tables', () => {
    const html = renderMarkdown(
      '- a\n- b\n\n`inline`\n\n```\nblock\n```\n\n> quote\n\n| h |\n| - |\n| c |'
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
  });

  it('renders links and forces safe rel/target', () => {
    const html = renderMarkdown('[x](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});

describe('sanitizeHtml / XSS protection', () => {
  it('removes script tags', () => {
    expect(renderMarkdown('hello <script>alert(1)</script>')).not.toContain('<script');
  });

  it('removes event handler attributes', () => {
    const html = sanitizeHtml('<img src="x" onerror="alert(1)" />');
    expect(html).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('discards iframes and inline styles', () => {
    const html = sanitizeHtml('<iframe src="https://evil"></iframe><p style="x">hi</p>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('style=');
  });

  it('keeps safe formatting tags', () => {
    const html = sanitizeHtml('<strong>x</strong><a href="https://a.com">l</a>');
    expect(html).toContain('<strong>x</strong>');
    expect(html).toContain('href="https://a.com"');
  });
});

describe('excerptFromMarkdown', () => {
  it('strips markdown syntax to plain text', () => {
    expect(excerptFromMarkdown('# Hi\n\n**bold** [link](http://x)')).toBe('Hi bold link');
  });

  it('truncates long text with an ellipsis', () => {
    const long = 'word '.repeat(100);
    const out = excerptFromMarkdown(long, 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
  });
});
