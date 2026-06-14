/** Data access for emoji reactions. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';

export class ReactionRepository {
  constructor(private readonly db: DB) {}

  add(postId: string, userId: string, emoji: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO reactions (id, post_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), postId, userId, emoji, new Date().toISOString());
  }

  remove(postId: string, userId: string, emoji: string): void {
    this.db
      .prepare('DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?')
      .run(postId, userId, emoji);
  }

  /** Counts per emoji for a post. */
  countsByPost(postId: string): { emoji: string; count: number }[] {
    return this.db
      .prepare(
        `SELECT emoji, COUNT(*) AS count FROM reactions WHERE post_id = ? GROUP BY emoji`
      )
      .all(postId) as { emoji: string; count: number }[];
  }

  /** Emojis the given user has used on the post. */
  userReactions(postId: string, userId: string): string[] {
    const rows = this.db
      .prepare('SELECT emoji FROM reactions WHERE post_id = ? AND user_id = ?')
      .all(postId, userId) as { emoji: string }[];
    return rows.map((r) => r.emoji);
  }
}
