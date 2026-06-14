/**
 * Profile service: public profile retrieval and editing of own profile,
 * including avatar/cover images.
 */
import type { ProfileView, UpdateProfileInput, User } from '../types';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { FollowRepository } from '../db/repositories/FollowRepository';
import type { MediaRepository } from '../db/repositories/MediaRepository';

const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 500;
const MAX_LOCATION = 120;
const MAX_URL = 300;

export class ProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly posts: PostRepository,
    private readonly follows: FollowRepository,
    private readonly media: MediaRepository
  ) {}

  /** Public profile by username. @throws NotFoundError if no such user */
  getPublicProfile(username: string): ProfileView {
    const user = this.users.findByUsername(username);
    if (!user) throw new NotFoundError('User not found');
    return {
      ...toProfileView(user),
      postCount: this.posts.countPublishedByUser(user.id),
      followerCount: this.follows.countFollowers(user.id),
      followingCount: this.follows.countFollowing(user.id),
      avatarUrl: this.mediaUrl(user.avatarMediaId, 'thumbnail'),
      coverUrl: this.mediaUrl(user.coverMediaId, 'original'),
    };
  }

  /**
   * Update the authenticated user's editable profile fields. Avatar/cover are sent as
   * media public ids and resolved to internal ids (ownership-checked) here.
   * @throws ValidationError on invalid input; PermissionError if media isn't owned
   */
  updateProfile(userId: string, input: UpdateProfileInput): User {
    const fields = validateAndNormalize(input);
    if ('avatarMediaId' in input) fields.avatarMediaId = this.resolveOwnedMedia(input.avatarMediaId, userId);
    if ('coverMediaId' in input) fields.coverMediaId = this.resolveOwnedMedia(input.coverMediaId, userId);
    const updated = this.users.updateProfile(userId, fields);
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }

  private mediaUrl(internalId: string | null, variant: 'thumbnail' | 'original'): string | null {
    if (!internalId) return null;
    const m = this.media.findById(internalId);
    return m ? `/media/${m.publicId}/${variant}` : null;
  }

  /** Resolve a client-sent media public id → internal id, verifying ownership. */
  private resolveOwnedMedia(publicId: string | null | undefined, userId: string): string | null {
    if (!publicId) return null;
    const m = this.media.findByPublicId(publicId);
    if (!m) throw new ValidationError('Image not found', 'media');
    if (m.userId !== userId) throw new PermissionError('You do not own that image');
    return m.id;
  }
}

export function toProfileView(user: User): ProfileView {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarMediaId: user.avatarMediaId,
    coverMediaId: user.coverMediaId,
    websiteUrl: user.websiteUrl,
    location: user.location,
    dmPolicy: user.dmPolicy,
    createdAt: user.createdAt,
    postCount: 0,
    followerCount: 0,
    followingCount: 0,
    avatarUrl: null,
    coverUrl: null,
  };
}

function validateAndNormalize(input: UpdateProfileInput): Record<string, string | null> {
  const fields: Record<string, string | null> = {};

  if ('displayName' in input) {
    const value = (input.displayName ?? '').trim();
    if (value.length === 0) throw new ValidationError('Display name cannot be empty', 'displayName');
    if (value.length > MAX_DISPLAY_NAME) {
      throw new ValidationError('Display name is too long', 'displayName');
    }
    fields.displayName = value;
  }

  if ('bio' in input) {
    const value = input.bio?.trim() ?? null;
    if (value && value.length > MAX_BIO) throw new ValidationError('Bio is too long', 'bio');
    fields.bio = value || null;
  }

  if ('location' in input) {
    const value = input.location?.trim() ?? null;
    if (value && value.length > MAX_LOCATION) {
      throw new ValidationError('Location is too long', 'location');
    }
    fields.location = value || null;
  }

  if ('websiteUrl' in input) {
    const value = input.websiteUrl?.trim() ?? null;
    if (value) {
      if (value.length > MAX_URL) throw new ValidationError('Website URL is too long', 'websiteUrl');
      if (!/^https?:\/\//i.test(value)) {
        throw new ValidationError('Website URL must start with http:// or https://', 'websiteUrl');
      }
    }
    fields.websiteUrl = value || null;
  }

  if ('dmPolicy' in input) {
    const value = input.dmPolicy;
    if (!value || !['everyone', 'following', 'mutual', 'nobody'].includes(value)) {
      throw new ValidationError('Invalid DM policy', 'dmPolicy');
    }
    fields.dmPolicy = value;
  }

  return fields;
}
