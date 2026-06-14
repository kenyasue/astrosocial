/**
 * Trend service: popular posts (by engagement score), popular tags, and popular
 * users. Computed live for the MVP (snapshotting is a future optimization).
 */
import type { PostCard } from '../types';
import type { TrendRepository, PopularUser } from '../db/repositories/TrendRepository';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { TagRepository } from '../db/repositories/TagRepository';

export interface PopularTag {
  name: string;
  slug: string;
  count: number;
}

export type TrendWindow = '24h' | '7d' | '30d' | 'all';

const WINDOW_MS: Record<TrendWindow, number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export class TrendService {
  constructor(
    private readonly trends: TrendRepository,
    private readonly posts: PostRepository,
    private readonly tags: TagRepository
  ) {}

  popularPosts(limit = 12, window: TrendWindow = 'all'): PostCard[] {
    const ms = WINDOW_MS[window];
    const sinceIso = ms === null ? undefined : new Date(Date.now() - ms).toISOString();
    return this.posts.cardsByIds(this.trends.popularPostIds(limit, sinceIso));
  }

  popularTags(limit = 20): PopularTag[] {
    return this.tags.popularTags(limit);
  }

  popularUsers(limit = 10): PopularUser[] {
    return this.trends.popularUsers(limit);
  }
}
