/**
 * Canonical path construction for users, posts, and media.
 *
 * - Profile:     /@username
 * - Post:        /@username/posts/slug   (slug falls back to the post public ID)
 * - Media:       /@username/media/mediaPublicId
 */

/** Build the canonical path for a user's public profile. */
export function profilePath(username: string): string {
  return `/@${username}`;
}

/** Build the canonical path for a post. */
export function postCanonicalPath(username: string, slugOrPublicId: string): string {
  return `/@${username}/posts/${slugOrPublicId}`;
}

/** Build the canonical path for a media item. */
export function mediaCanonicalPath(username: string, mediaPublicId: string): string {
  return `/@${username}/media/${mediaPublicId}`;
}
