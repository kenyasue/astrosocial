/**
 * Discovery service: data for the right-sidebar "Discover" widget — trending tags
 * and who-to-follow suggestions.
 */
import type { PopularTag } from './TrendService';
import type { TagRepository } from '../db/repositories/TagRepository';
import type { UserRepository } from '../db/repositories/UserRepository';

export interface FollowSuggestion {
  username: string;
  displayName: string;
}

export interface Suggestions {
  trendingTags: PopularTag[];
  whoToFollow: FollowSuggestion[];
}

/** One entry in the public Users directory (Explore page). */
export interface UserDirectoryEntry {
  username: string;
  displayName: string;
  /** Avatar thumbnail URL, or null when the user has no avatar. */
  avatarUrl: string | null;
  /** Thumbnail URL of the user's most recent image, or null when none. */
  lastImageUrl: string | null;
}

export class DiscoveryService {
  constructor(
    private readonly tags: TagRepository,
    private readonly users: UserRepository
  ) {}

  suggestions(viewerId: string | null): Suggestions {
    return {
      trendingTags: this.tags.popularTags(5),
      whoToFollow: this.users
        .whoToFollow(viewerId, 3)
        .map((u) => ({ username: u.username, displayName: u.displayName })),
    };
  }

  /** All users for the Explore directory, each with avatar + last-image URLs. */
  userDirectory(limit = 100): UserDirectoryEntry[] {
    return this.users.listDirectory(limit).map((u) => ({
      username: u.username,
      displayName: u.displayName,
      avatarUrl: thumbnailUrl(u.avatarPublicId),
      lastImageUrl: thumbnailUrl(u.lastImagePublicId),
    }));
  }
}

/** Build a media thumbnail serving URL from a public id, or null. */
function thumbnailUrl(publicId: string | null): string | null {
  return publicId ? `/media/${publicId}/thumbnail` : null;
}
