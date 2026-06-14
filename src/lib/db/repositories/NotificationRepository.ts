/** Data access for notifications. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { NotificationType, NotificationView } from '../../types';

interface NotificationRow {
  id: string;
  type: string;
  actor_username: string | null;
  actor_display_name: string | null;
  post_canonical_path: string | null;
  post_title: string | null;
  read_at: string | null;
  created_at: string;
}

function mapRow(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type as NotificationType,
    actorUsername: row.actor_username,
    actorDisplayName: row.actor_display_name,
    postCanonicalPath: row.post_canonical_path,
    postTitle: row.post_title,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}

export interface CreateNotificationInput {
  userId: string;
  actorUserId: string | null;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
}

export class NotificationRepository {
  constructor(private readonly db: DB) {}

  create(input: CreateNotificationInput): void {
    this.db
      .prepare(
        `INSERT INTO notifications (id, user_id, actor_user_id, type, post_id, comment_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        input.userId,
        input.actorUserId ?? null,
        input.type,
        input.postId ?? null,
        input.commentId ?? null,
        new Date().toISOString()
      );
  }

  /**
   * List a user's notifications, optionally filtered by type and paginated by a
   * `created_at` cursor (returns rows strictly older than the cursor).
   */
  listByUser(
    userId: string,
    opts: { types?: string[]; limit?: number; cursor?: string } = {}
  ): NotificationView[] {
    const limit = opts.limit ?? 30;
    const conditions: string[] = ['n.user_id = ?'];
    const params: unknown[] = [userId];
    if (opts.types && opts.types.length > 0) {
      conditions.push(`n.type IN (${opts.types.map(() => '?').join(', ')})`);
      params.push(...opts.types);
    }
    if (opts.cursor) {
      conditions.push('n.created_at < ?');
      params.push(opts.cursor);
    }
    params.push(limit);
    const rows = this.db
      .prepare(
        `SELECT n.id, n.type, n.read_at, n.created_at,
                a.username AS actor_username, a.display_name AS actor_display_name,
                p.canonical_path AS post_canonical_path, p.title AS post_title
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_user_id
         LEFT JOIN posts p ON p.id = n.post_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY n.created_at DESC LIMIT ?`
      )
      .all(...params) as NotificationRow[];
    return rows.map(mapRow);
  }

  /** A single owned notification's view (for resolving its click-through target). */
  findOwned(userId: string, id: string): NotificationView | null {
    const row = this.db
      .prepare(
        `SELECT n.id, n.type, n.read_at, n.created_at,
                a.username AS actor_username, a.display_name AS actor_display_name,
                p.canonical_path AS post_canonical_path, p.title AS post_title
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_user_id
         LEFT JOIN posts p ON p.id = n.post_id
         WHERE n.id = ? AND n.user_id = ?`
      )
      .get(id, userId) as NotificationRow | undefined;
    return row ? mapRow(row) : null;
  }

  unreadCount(userId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .get(userId) as { c: number };
    return row.c;
  }

  markRead(userId: string, id: string): void {
    this.db
      .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
      .run(new Date().toISOString(), id, userId);
  }

  markAllRead(userId: string): void {
    this.db
      .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
      .run(new Date().toISOString(), userId);
  }
}
