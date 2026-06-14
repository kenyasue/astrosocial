/**
 * Environment configuration loading and validation.
 *
 * All runtime configuration is read from environment variables once and frozen.
 * `testMode` (OPENMEOW_TEST_MODE=1) makes login PINs deterministic ("000000")
 * and routes email to the console so end-to-end tests can authenticate.
 */
import path from 'node:path';

export interface Config {
  /** When true, issued login PINs are always "000000" and email is not sent. */
  testMode: boolean;
  /** Whether we are running in production (affects Secure cookie flag). */
  isProduction: boolean;
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  /** Absolute path to the migrations directory. */
  migrationsDir: string;
  /** HTTP port for the server adapter. */
  port: number;
  /** Login PIN time-to-live in minutes. */
  pinTtlMinutes: number;
  /** Maximum PIN requests allowed per email within the rate-limit window. */
  pinMaxPerWindow: number;
  /** Rate-limit window for PIN requests, in minutes. */
  pinWindowMinutes: number;
  /** Maximum failed verification attempts before a PIN is locked. */
  pinMaxFailedAttempts: number;
  /** Session lifetime in days. */
  sessionTtlDays: number;
  /** Name of the session cookie. */
  sessionCookieName: string;
  /** Root directory for uploaded media. */
  uploadsDir: string;
  /** Maximum upload size for images, in bytes. */
  maxImageBytes: number;
  /** Maximum upload size for videos, in bytes. */
  maxVideoBytes: number;
  /** Admin console username (constant, from the environment). */
  adminUsername: string;
  /** Admin console password (constant, from the environment). */
  adminPassword: string;
  /** Name of the admin session cookie. */
  adminCookieName: string;
  /** Admin session lifetime in hours. */
  adminSessionTtlHours: number;
}

/** Allowed upload MIME types mapped to their canonical file extension + kind. */
export const ALLOWED_MEDIA_TYPES: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
};

/** Deterministic PIN used in test mode. */
export const TEST_MODE_PIN = '000000';

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid integer for environment variable ${name}: "${raw}"`);
  }
  return parsed;
}

const projectRoot = process.cwd();

export const config: Config = Object.freeze({
  testMode: process.env.OPENMEOW_TEST_MODE === '1',
  isProduction: process.env.NODE_ENV === 'production',
  dbPath: process.env.OPENMEOW_DB_PATH
    ? path.resolve(process.env.OPENMEOW_DB_PATH)
    : path.join(projectRoot, 'data', 'openmeow.db'),
  migrationsDir: process.env.OPENMEOW_MIGRATIONS_DIR
    ? path.resolve(process.env.OPENMEOW_MIGRATIONS_DIR)
    : path.join(projectRoot, 'migrations'),
  port: intFromEnv('PORT', 3000),
  pinTtlMinutes: intFromEnv('OPENMEOW_PIN_TTL_MINUTES', 10),
  pinMaxPerWindow: intFromEnv('OPENMEOW_PIN_MAX_PER_WINDOW', 5),
  pinWindowMinutes: intFromEnv('OPENMEOW_PIN_WINDOW_MINUTES', 15),
  pinMaxFailedAttempts: intFromEnv('OPENMEOW_PIN_MAX_FAILED_ATTEMPTS', 5),
  sessionTtlDays: intFromEnv('OPENMEOW_SESSION_TTL_DAYS', 30),
  sessionCookieName: 'om_session',
  uploadsDir: process.env.OPENMEOW_UPLOADS_DIR
    ? path.resolve(process.env.OPENMEOW_UPLOADS_DIR)
    : path.join(projectRoot, 'uploads'),
  maxImageBytes: intFromEnv('OPENMEOW_MAX_IMAGE_BYTES', 10 * 1024 * 1024),
  maxVideoBytes: intFromEnv('OPENMEOW_MAX_VIDEO_BYTES', 50 * 1024 * 1024),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  adminCookieName: 'as_admin',
  adminSessionTtlHours: intFromEnv('ADMIN_SESSION_TTL_HOURS', 12),
});
