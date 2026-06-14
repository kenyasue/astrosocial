/**
 * Email-address helpers shared across services (auth, admin moderation).
 *
 * A single source of truth for how the app validates and canonicalises email
 * addresses so login lookups and admin edits agree on the stored form.
 */

/** Pragmatic email shape check: one `@`, a dot in the domain, no whitespace. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonical stored form: trimmed and lower-cased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when `email` matches {@link EMAIL_RE}. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
