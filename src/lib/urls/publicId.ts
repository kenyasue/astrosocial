/**
 * Public ID generation.
 *
 * Public IDs are stable, opaque identifiers exposed in URLs (e.g. `p_8f3a9c21`
 * for posts, `m_7a2c91df` for media). They are distinct from the internal
 * primary key and safe to share publicly.
 */
import { randomBytes } from 'node:crypto';

export type PublicIdPrefix = 'p' | 'm';

const HEX_LENGTH = 8;

/**
 * Generate a public ID with the given prefix.
 *
 * @param prefix - Short type prefix (`p` post, `m` media)
 * @returns A public ID such as `p_8f3a9c21`
 */
export function generatePublicId(prefix: PublicIdPrefix): string {
  const hex = randomBytes(HEX_LENGTH).toString('hex').slice(0, HEX_LENGTH);
  return `${prefix}_${hex}`;
}

/** True if a string looks like a valid public ID (`prefix_` + 8 hex chars). */
export function isPublicId(value: string): boolean {
  return /^[pm]_[0-9a-f]{8}$/.test(value);
}
