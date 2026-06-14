/** Data access for comments. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { CommentView } from '../../types';

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string | null;
  guest_name: string | null;
  body: string;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  avatar_public_id: string | null;
}

function mapRow(row: CommentRow): CommentView {
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    authorAvatarUrl: row.avatar_public_id ? `/media/${row.avatar_public_id}/thumbnail` : null,
    guestName: row.guest_name,
  };
}

/** Shared SELECT columns + joins for a comment view (author + avatar). */
const COMMENT_SELECT = `
  SELECT c.*, u.username AS author_username, u.display_name AS author_display_name,
         am.public_id AS avatar_public_id
  FROM comments c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN media am ON am.id = u.avatar_media_id`;

export interface RawComment {
  id: string;
  postId: string;
  userId: string | null;
}

export class CommentRepository {
  constructor(private readonly db: DB) {}

  create(postId: string, userId: string, body: string): CommentView {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO comments (id, post_id, user_id, body, status, created_at)
         VALUES (?, ?, ?, ?, 'approved', ?)`
      )
      .run(id, postId, userId, body, new Date().toISOString());
    return this.findView(id)!;
  }

  findRaw(id: string): RawComment | null {
    const row = this.db.prepare('SELECT id, post_id, user_id FROM comments WHERE id = ?').get(id) as
      | { id: string; post_id: string; user_id: string | null }
      | undefined;
    return row ? { id: row.id, postId: row.post_id, userId: row.user_id } : null;
  }

  findView(id: string): CommentView | null {
    const row = this.db
      .prepare(`${COMMENT_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`)
      .get(id) as CommentRow | undefined;
    return row ? mapRow(row) : null;
  }

  listByPost(postId: string): CommentView[] {
    const rows = this.db
      .prepare(`${COMMENT_SELECT} WHERE c.post_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC`)
      .all(postId) as CommentRow[];
    return rows.map(mapRow);
  }

  countByPost(postId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND deleted_at IS NULL')
      .get(postId) as { c: number };
    return row.c;
  }

  /** Soft-delete a comment. */
  delete(id: string): void {
    this.db.prepare('UPDATE comments SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }
}
