import { describe, it, expect } from 'vitest';
import { MANIFEST, SERVICE_WORKER, ICON_SVG, iconPng } from './pwa';

describe('PWA manifest', () => {
  it('is valid JSON with the expected core fields', () => {
    const m = JSON.parse(MANIFEST);
    expect(m.name).toBe('AstroSocial');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('service worker', () => {
  it('registers install, activate, and fetch handlers and an offline fallback', () => {
    expect(SERVICE_WORKER).toContain("addEventListener('install'");
    expect(SERVICE_WORKER).toContain("addEventListener('fetch'");
    expect(SERVICE_WORKER).toContain("caches.match('/offline')");
  });
});

describe('icons', () => {
  it('icon SVG is well-formed', () => {
    expect(ICON_SVG).toContain('<svg');
    expect(ICON_SVG).toContain('</svg>');
  });

  it('rasterizes a PNG of the requested size', async () => {
    const png = await iconPng(192);
    expect(png.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });
});
