/** Read-side queries for trends (computed live). Parameterized SQL only. */
import type { DB } from '../connection';

export interface PopularUser {
  username: string;
  displayName: string;
  followers: number;
}

export class TrendRepository {
  constructor(private readonly db: DB) {}

  /**
   * Published post ids ordered by engagement score:
   * likes + reactions + 2*comments + 3*reposts + 2*bookmarks.
   */
  popularPostIds(limit = 20, sinceIso?: string): string[] {
    const score = `((SELECT COUNT(*) FROM likes WHERE likes.post_id = p.id)
            + (SELECT COUNT(*) FROM reactions WHERE reactions.post_id = p.id)
            + 2 * (SELECT COUNT(*) FROM comments WHERE comments.post_id = p.id AND comments.deleted_at IS NULL)
            + 3 * (SELECT COUNT(*) FROM reposts WHERE reposts.post_id = p.id)
            + 2 * (SELECT COUNT(*) FROM bookmarks WHERE bookmarks.post_id = p.id))`;
    const sql = `SELECT p.id AS id, ${score} AS score
         FROM posts p
         WHERE p.status = 'published'${sinceIso ? ' AND p.published_at >= ?' : ''}
         ORDER BY score DESC, p.published_at DESC
         LIMIT ?`;
    const rows = (
      sinceIso ? this.db.prepare(sql).all(sinceIso, limit) : this.db.prepare(sql).all(limit)
    ) as { id: string; score: number }[];
    return rows.map((r) => r.id);
  }

  /** Users ordered by follower count (only those with at least one follower). */
  popularUsers(limit = 10): PopularUser[] {
    return this.db
      .prepare(
        `SELECT u.username, u.display_name AS displayName, COUNT(f.id) AS followers
         FROM users u JOIN follows f ON f.following_user_id = u.id
         GROUP BY u.id
         ORDER BY followers DESC, u.username
         LIMIT ?`
      )
      .all(limit) as PopularUser[];
  }
}
