/** Data access for follows. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';

export class FollowRepository {
  constructor(private readonly db: DB) {}

  follow(followerUserId: string, followingUserId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO follows (id, follower_user_id, following_user_id, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(randomUUID(), followerUserId, followingUserId, new Date().toISOString());
  }

  unfollow(followerUserId: string, followingUserId: string): void {
    this.db
      .prepare('DELETE FROM follows WHERE follower_user_id = ? AND following_user_id = ?')
      .run(followerUserId, followingUserId);
  }

  isFollowing(followerUserId: string, followingUserId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM follows WHERE follower_user_id = ? AND following_user_id = ?')
        .get(followerUserId, followingUserId) !== undefined
    );
  }

  countFollowers(userId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM follows WHERE following_user_id = ?')
      .get(userId) as { c: number };
    return row.c;
  }

  countFollowing(userId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_user_id = ?')
      .get(userId) as { c: number };
    return row.c;
  }

  /** Ids of users that `userId` follows. */
  followingIds(userId: string): string[] {
    const rows = this.db
      .prepare('SELECT following_user_id FROM follows WHERE follower_user_id = ?')
      .all(userId) as { following_user_id: string }[];
    return rows.map((r) => r.following_user_id);
  }
}
