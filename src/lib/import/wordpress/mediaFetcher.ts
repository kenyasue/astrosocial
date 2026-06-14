/**
 * Image fetching for the WordPress import.
 *
 * The importer copies media from the live site. The fetch is abstracted behind
 * `ImageFetcher` so tests can supply bytes without touching the network.
 */

export interface FetchedImage {
  buffer: Buffer;
  mimeType: string;
}

export interface ImageFetcher {
  /** Fetch image bytes for a URL, or null if it cannot be retrieved. */
  fetch(url: string): Promise<FetchedImage | null>;
}

/** Map a response content-type / URL extension to a supported image MIME type. */
function resolveMimeType(contentType: string | null, url: string): string {
  const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (ct.startsWith('image/')) return ct === 'image/jpg' ? 'image/jpeg' : ct;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/** Fetches images over HTTP(S) using the global `fetch`, upgrading http→https. */
export class HttpImageFetcher implements ImageFetcher {
  constructor(
    private readonly timeoutMs = 20_000,
    private readonly log: (message: string) => void = () => {}
  ) {}

  async fetch(url: string): Promise<FetchedImage | null> {
    const target = url.startsWith('http://') ? 'https://' + url.slice('http://'.length) : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'AstroSocial-Importer/1.0' },
      });
      if (!res.ok) {
        this.log(`HTTP ${res.status} for ${target}`);
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) return null;
      return { buffer, mimeType: resolveMimeType(res.headers.get('content-type'), target) };
    } catch (error) {
      this.log(`fetch failed for ${target}: ${error instanceof Error ? error.message : error}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
