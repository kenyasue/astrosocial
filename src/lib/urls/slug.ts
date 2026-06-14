/**
 * Slug generation for posts.
 *
 * Slugs are lowercase, alphanumeric-plus-hyphen, max 80 chars, unique per user.
 * They are generated from the post title, falling back to the public ID for
 * untitled posts, with a numeric (then public-id) suffix on collision.
 */

const MAX_SLUG_LENGTH = 80;
const MAX_NUMERIC_SUFFIX = 50;

/**
 * Convert an arbitrary string into a URL-safe slug base (no uniqueness applied).
 *
 * @param title - The source text, or null/empty
 * @returns A normalized slug base, possibly empty when there are no usable chars
 */
export function slugify(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Generate a slug that is unique per user.
 *
 * @param title - The post title (may be null for untitled posts)
 * @param publicId - The post public ID, used as a fallback and collision suffix
 * @param exists - Predicate returning true if a candidate slug already exists
 * @returns A slug guaranteed unique according to `exists`
 */
export function generateSlug(
  title: string | null,
  publicId: string,
  exists: (slug: string) => boolean
): string {
  const base = slugify(title);
  if (!base) return publicId;
  if (!exists(base)) return base;

  for (let n = 2; n <= MAX_NUMERIC_SUFFIX; n++) {
    const candidate = `${base}-${n}`;
    if (!exists(candidate)) return candidate;
  }

  // Fall back to appending a fragment of the public ID for guaranteed uniqueness.
  const fragment = publicId.split('_')[1]?.slice(0, 4) ?? '';
  const candidate = `${base}-${fragment}`;
  return exists(candidate) ? `${base}-${publicId}` : candidate;
}
