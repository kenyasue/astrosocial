/** Data access for bookmarks. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';

export class BookmarkRepository {
  constructor(private readonly db: DB) {}

  add(postId: string, userId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO bookmarks (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(randomUUID(), postId, userId, new Date().toISOString());
  }

  remove(postId: string, userId: string): void {
    this.db.prepare('DELETE FROM bookmarks WHERE post_id = ? AND user_id = ?').run(postId, userId);
  }

  exists(postId: string, userId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM bookmarks WHERE post_id = ? AND user_id = ?')
        .get(postId, userId) !== undefined
    );
  }

  /** Post ids the user has bookmarked, newest-first. */
  postIdsByUser(userId: string): string[] {
    const rows = this.db
      .prepare('SELECT post_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as { post_id: string }[];
    return rows.map((r) => r.post_id);
  }
}
