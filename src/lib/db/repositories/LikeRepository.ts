/** Data access for post likes. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';

export class LikeRepository {
  constructor(private readonly db: DB) {}

  /** Like a post (idempotent — unique on post+user). */
  add(postId: string, userId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO likes (id, post_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(randomUUID(), postId, userId, new Date().toISOString());
  }

  remove(postId: string, userId: string): void {
    this.db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
  }

  exists(postId: string, userId: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(postId, userId) !==
      undefined
    );
  }

  countByPost(postId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(postId) as {
      c: number;
    };
    return row.c;
  }
}
