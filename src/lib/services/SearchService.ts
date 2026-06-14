/**
 * Search service: full-text post search (FTS5) + user search + tag listings.
 * Builds a safe FTS5 MATCH expression from raw user input (each token quoted),
 * so user text can never inject FTS operators or syntax errors.
 */
import type { PostCard } from '../types';
import type { SearchRepository } from '../db/repositories/SearchRepository';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { TagRepository } from '../db/repositories/TagRepository';

export type SearchTab = 'top' | 'latest' | 'people' | 'tags';

export interface UserResult {
  username: string;
  displayName: string;
}

export interface TagResult {
  name: string;
  slug: string;
}

/** Results for the active tab only (other arrays are empty). */
export interface SearchResults {
  tab: SearchTab;
  posts: PostCard[];
  users: UserResult[];
  tags: TagResult[];
}

export interface SearchSuggestions {
  tags: { name: string; slug: string; count: number }[];
  people: UserResult[];
}

/** Build a safe FTS5 MATCH expression: each token quoted, joined by AND (space). */
export function buildMatchExpression(query: string): string {
  const tokens = (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/["^*():]/g, '').trim())
    .filter(Boolean);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t}"`).join(' ');
}

function normalizeTab(tab: string | undefined): SearchTab {
  return tab === 'latest' || tab === 'people' || tab === 'tags' ? tab : 'top';
}

export class SearchService {
  constructor(
    private readonly search: SearchRepository,
    private readonly posts: PostRepository,
    private readonly users: UserRepository,
    private readonly tags: TagRepository
  ) {}

  /** Search for a free-text query, populating only the requested tab. */
  query(query: string, tabInput?: string, limit = 20): SearchResults {
    const tab = normalizeTab(tabInput);
    const trimmed = (query ?? '').trim();
    const empty: SearchResults = { tab, posts: [], users: [], tags: [] };
    if (!trimmed) return empty;

    const matchExpr = buildMatchExpression(trimmed);
    switch (tab) {
      case 'latest':
        return matchExpr
          ? { ...empty, posts: this.posts.cardsByIds(this.search.searchPostIdsLatest(matchExpr, limit)) }
          : empty;
      case 'people':
        return {
          ...empty,
          users: this.users
            .search(trimmed, limit)
            .map((u) => ({ username: u.username, displayName: u.displayName })),
        };
      case 'tags':
        return { ...empty, tags: this.tags.searchByName(trimmed, limit) };
      case 'top':
      default:
        return matchExpr
          ? { ...empty, posts: this.posts.cardsByIds(this.search.searchPostIds(matchExpr, limit)) }
          : empty;
    }
  }

  /** Suggestions shown when there is no query (trending tags + popular people). */
  suggestions(): SearchSuggestions {
    return {
      tags: this.tags.popularTags(10),
      people: this.users.whoToFollow(null, 5).map((u) => ({ username: u.username, displayName: u.displayName })),
    };
  }

  /** Published posts carrying a given tag slug. */
  postsByTag(slug: string, limit = 30): PostCard[] {
    return this.posts.cardsByIds(this.tags.postIdsByTag(slug, limit));
  }
}
