import { describe, it, expect } from 'vitest';
import { wrapSelection, toggleLinePrefix, insertAtCaret, mediaSnippet } from './markdownEdit';

describe('wrapSelection', () => {
  it('wraps a selection with markers and keeps the selection on the text', () => {
    const r = wrapSelection('a bold c', 2, 6, '**');
    expect(r.value).toBe('a **bold** c');
    expect('a bold c'.slice(2, 6)).toBe('bold');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('bold');
  });

  it('wraps an empty caret (start === end)', () => {
    const r = wrapSelection('xy', 1, 1, '*');
    expect(r.value).toBe('x**y');
  });

  it('supports different before/after (e.g. link)', () => {
    const r = wrapSelection('text', 0, 4, '[', '](url)');
    expect(r.value).toBe('[text](url)');
  });
});

describe('toggleLinePrefix', () => {
  it('adds a prefix to the current line', () => {
    const r = toggleLinePrefix('hello', 0, 0, '## ');
    expect(r.value).toBe('## hello');
  });

  it('removes the prefix when already present', () => {
    const r = toggleLinePrefix('## hello', 0, 0, '## ');
    expect(r.value).toBe('hello');
  });

  it('applies across multiple selected lines', () => {
    const text = 'a\nb';
    const r = toggleLinePrefix(text, 0, text.length, '- ');
    expect(r.value).toBe('- a\n- b');
  });
});

describe('insertAtCaret', () => {
  it('inserts a snippet at the caret', () => {
    const r = insertAtCaret('ab', 1, 'X');
    expect(r.value).toBe('aXb');
    expect(r.selStart).toBe(2);
  });
});

describe('mediaSnippet', () => {
  it('builds Markdown image syntax for images', () => {
    expect(
      mediaSnippet({ mimeType: 'image/png', originalUrl: '/media/m_1/original', altText: 'cat', canonicalPath: '/@k/media/m_1' })
    ).toContain('![cat](/media/m_1/original)');
  });

  it('links to the media page for non-images', () => {
    expect(
      mediaSnippet({ mimeType: 'video/mp4', originalUrl: '/media/m_2/original', altText: null, canonicalPath: '/@k/media/m_2' })
    ).toContain('[video](/@k/media/m_2)');
  });

  it('strips brackets from alt text', () => {
    expect(
      mediaSnippet({ mimeType: 'image/png', originalUrl: '/u', altText: 'a[b]c', canonicalPath: '/c' })
    ).toContain('![abc](/u)');
  });
});
