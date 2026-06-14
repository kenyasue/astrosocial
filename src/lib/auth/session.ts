/**
 * Session token generation, hashing, and cookie helpers.
 *
 * The raw session token is returned to the client in an HttpOnly cookie; only
 * its hash is stored server-side. Secure is enabled outside dev/test.
 */
import { randomBytes, createHash } from 'node:crypto';
import { config } from '../config/env';

/** Generate a new random session token (raw value sent to the client). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a session token for storage/lookup. A fast SHA-256 is appropriate here
 * (the token is high-entropy, unlike a low-entropy PIN/password).
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Absolute expiry timestamp (ISO) for a new session. */
export function sessionExpiryIso(now: Date = new Date()): string {
  return new Date(now.getTime() + config.sessionTtlDays * 86_400_000).toISOString();
}

/** Build the Set-Cookie header value that establishes a session. */
export function buildSessionCookie(token: string): string {
  const attrs = [
    `${config.sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.sessionTtlDays * 86_400}`,
  ];
  if (config.isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

/** Build the Set-Cookie header value that clears the session cookie. */
export function buildClearSessionCookie(): string {
  const attrs = [`${config.sessionCookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (config.isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

/** Extract the session token from a raw Cookie header, if present. */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, config.sessionCookieName);
}

/** Build the Set-Cookie header that establishes an admin session. */
export function buildAdminCookie(token: string): string {
  const attrs = [
    `${config.adminCookieName}=${token}`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.adminSessionTtlHours * 3_600}`,
  ];
  if (config.isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

/** Build the Set-Cookie header that clears the admin session cookie. */
export function buildClearAdminCookie(): string {
  const attrs = [`${config.adminCookieName}=`, 'Path=/admin', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (config.isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

/** Extract the admin session token from a raw Cookie header, if present. */
export function readAdminCookie(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, config.adminCookieName);
}

/** Read a named cookie value from a raw Cookie header. */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=') || null;
    }
  }
  return null;
}
