/**
 * Password/secret hashing utilities.
 *
 * Used to hash login PINs and session tokens at rest. Uses scrypt with a
 * per-record random salt; the stored value is `salt:derivedKey` (both hex).
 * Verification is constant-time to avoid timing attacks.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Explicit scrypt cost parameters (Node's current defaults) so the chosen work
// factor is auditable and stable across Node versions.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Hash a secret (PIN or token) for storage.
 *
 * @param secret - The plaintext secret to hash
 * @returns A string of the form `salt:derivedKey` (hex), safe to persist
 */
export function hashSecret(secret: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derived = scryptSync(secret, salt, KEY_LENGTH, SCRYPT_PARAMS).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verify a secret against a stored hash in constant time.
 *
 * @param secret - The plaintext secret to check
 * @param stored - The stored `salt:derivedKey` value
 * @returns True if the secret matches the stored hash
 */
export function verifySecret(secret: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(':');
  if (!salt || !derivedHex) return false;

  const expected = Buffer.from(derivedHex, 'hex');
  const actual = scryptSync(secret, salt, expected.length, SCRYPT_PARAMS);
  // Lengths are equal by construction; timingSafeEqual still requires it.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
