/** Data access for reposts. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';

export interface RepostEntry {
  postId: string;
  userId: string;
  createdAt: string;
}

export class RepostRepository {
  constructor(private readonly db: DB) {}

  add(postId: string, userId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO reposts (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(randomUUID(), postId, userId, new Date().toISOString());
  }

  remove(postId: string, userId: string): void {
    this.db.prepare('DELETE FROM reposts WHERE post_id = ? AND user_id = ?').run(postId, userId);
  }

  exists(postId: string, userId: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM reposts WHERE post_id = ? AND user_id = ?').get(postId, userId) !==
      undefined
    );
  }

  countByPost(postId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM reposts WHERE post_id = ?').get(postId) as {
      c: number;
    };
    return row.c;
  }

  /** Reposts made by any of the given user ids (for the following timeline). */
  byUsers(userIds: string[], limit = 50): { postId: string; userId: string; createdAt: string }[] {
    if (userIds.length === 0) return [];
    const placeholders = userIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT post_id, user_id, created_at FROM reposts
         WHERE user_id IN (${placeholders})
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(...userIds, limit) as { post_id: string; user_id: string; created_at: string }[];
    return rows.map((r) => ({ postId: r.post_id, userId: r.user_id, createdAt: r.created_at }));
  }
}
