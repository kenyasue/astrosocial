/** Full-text search over posts (FTS5). Parameterized SQL only. */
import type { DB } from '../connection';

export class SearchRepository {
  constructor(private readonly db: DB) {}

  /**
   * Return ids of published posts matching the FTS query, ranked by relevance.
   * `matchExpr` must already be a safe FTS5 MATCH expression (see SearchService).
   */
  searchPostIds(matchExpr: string, limit = 20): string[] {
    const rows = this.db
      .prepare(
        `SELECT f.post_id AS post_id
         FROM posts_fts f
         JOIN posts p ON p.id = f.post_id
         WHERE posts_fts MATCH ? AND p.status = 'published'
         ORDER BY rank
         LIMIT ?`
      )
      .all(matchExpr, limit) as { post_id: string }[];
    return rows.map((r) => r.post_id);
  }

  /** Ids of published posts matching the FTS query, newest first. */
  searchPostIdsLatest(matchExpr: string, limit = 20): string[] {
    const rows = this.db
      .prepare(
        `SELECT f.post_id AS post_id
         FROM posts_fts f
         JOIN posts p ON p.id = f.post_id
         WHERE posts_fts MATCH ? AND p.status = 'published'
         ORDER BY p.published_at DESC
         LIMIT ?`
      )
      .all(matchExpr, limit) as { post_id: string }[];
    return rows.map((r) => r.post_id);
  }
}
