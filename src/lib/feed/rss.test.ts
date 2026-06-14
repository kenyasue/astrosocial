import { describe, it, expect } from 'vitest';
import { buildRssFeed, escapeXml } from './rss';
import type { PostCard } from '../types';

function card(over: Partial<PostCard> = {}): PostCard {
  return {
    publicId: 'p_1',
    title: 'Hello',
    slug: 'hello',
    canonicalPath: '/@ken/posts/hello',
    excerpt: 'an excerpt',
    status: 'published',
    publishedAt: '2026-06-13T00:00:00.000Z',
    createdAt: '2026-06-13T00:00:00.000Z',
    authorUsername: 'ken',
    authorDisplayName: 'Ken',
    coverUrl: null,
    readingMinutes: 1,
    likeCount: 0,
    commentCount: 0,
    ...over,
  };
}

describe('escapeXml', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('buildRssFeed', () => {
  it('produces a valid RSS document with absolute item links', () => {
    const xml = buildRssFeed([card()], 'https://example.com');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<title>Hello</title>');
    expect(xml).toContain('<link>https://example.com/@ken/posts/hello</link>');
    expect(xml).toContain('<pubDate>');
  });

  it('escapes post titles to keep the XML well-formed', () => {
    const xml = buildRssFeed([card({ title: 'Tom & Jerry <x>' })], 'https://example.com');
    expect(xml).toContain('<title>Tom &amp; Jerry &lt;x&gt;</title>');
    expect(xml).not.toContain('<title>Tom & Jerry');
  });

  it('handles an empty feed', () => {
    const xml = buildRssFeed([], 'https://example.com');
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });
});
