/**
 * PWA assets: web app manifest, service worker, and app icon.
 *
 * The icon is an inline SVG monogram; PNG sizes are rasterized on demand with
 * sharp (and cached) for the manifest's icon entries.
 */
import sharp from 'sharp';

export const MANIFEST = JSON.stringify({
  name: 'AstroSocial',
  short_name: 'AstroSocial',
  description: 'A self-hostable open-source social publishing platform.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#0f1115',
  theme_color: '#0f1115',
  icons: [
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
});

/** App icon as an SVG monogram ("OM" on the brand accent). */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#8b7cff" />
  <text x="256" y="330" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif"
    font-size="240" font-weight="800" fill="#ffffff">OM</text>
</svg>`;

/**
 * Service worker: keep static assets fresh with a network-first strategy and
 * only fall back to the cache when offline. The cache is purely an offline
 * safety net — it never shadows a newer version of the CSS/icon while online.
 * (A previous cache-first strategy served stale CSS until a hard reload.)
 *
 * Bump CACHE whenever this logic changes so the activate step purges stale
 * caches from older service workers.
 */
export const SERVICE_WORKER = `
const CACHE = 'openmeow-v2';
const ASSETS = ['/styles.css', '/offline', '/icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
// Network-first for cacheable static assets: always try the network, refresh
// the cache on success, and only use the cache when the network is unavailable.
function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })
    .catch(() => caches.match(req));
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname === '/styles.css' || url.pathname === '/icon.svg') {
    e.respondWith(networkFirst(req));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline')));
  }
});
`;

const iconCache = new Map<number, Buffer>();

/** Rasterize the SVG icon to a PNG of the given size (cached). */
export async function iconPng(size: number): Promise<Buffer> {
  const cached = iconCache.get(size);
  if (cached) return cached;
  const png = await sharp(Buffer.from(ICON_SVG)).resize(size, size).png().toBuffer();
  iconCache.set(size, png);
  return png;
}
