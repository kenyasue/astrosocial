/**
 * Data access for the admin console: cross-table listings for moderation and a
 * transactional cascade delete of a user and everything that references them.
 * All SQL is parameterized and lives here (no ORM).
 */
import type { DB } from '../connection';

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string;
  postCount: number;
}

export interface AdminPostRow {
  id: string;
  publicId: string;
  title: string | null;
  status: string;
  authorUsername: string;
  createdAt: string;
  commentCount: number;
}

export interface AdminCommentRow {
  id: string;
  body: string;
  authorLabel: string;
  postTitle: string | null;
  postCanonicalPath: string;
  createdAt: string;
}

export class AdminRepository {
  constructor(private readonly db: DB) {}

  listUsers(limit = 200): AdminUserRow[] {
    const rows = this.db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.email, u.created_at,
                (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count
         FROM users u
         ORDER BY u.created_at DESC
         LIMIT ?`
      )
      .all(limit) as {
      id: string;
      username: string;
      display_name: string;
      email: string;
      created_at: string;
      post_count: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      email: r.email,
      createdAt: r.created_at,
      postCount: r.post_count,
    }));
  }

  listPosts(limit = 200): AdminPostRow[] {
    const rows = this.db
      .prepare(
        `SELECT p.id, p.public_id, p.title, p.status, p.created_at,
                u.username AS author_username,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count
         FROM posts p
         JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT ?`
      )
      .all(limit) as {
      id: string;
      public_id: string;
      title: string | null;
      status: string;
      created_at: string;
      author_username: string;
      comment_count: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      publicId: r.public_id,
      title: r.title,
      status: r.status,
      authorUsername: r.author_username,
      createdAt: r.created_at,
      commentCount: r.comment_count,
    }));
  }

  listComments(limit = 200): AdminCommentRow[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.body, c.created_at,
                COALESCE(u.username, c.guest_name, 'guest') AS author_label,
                p.title AS post_title, p.canonical_path AS post_canonical_path
         FROM comments c
         JOIN posts p ON p.id = c.post_id
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT ?`
      )
      .all(limit) as {
      id: string;
      body: string;
      created_at: string;
      author_label: string;
      post_title: string | null;
      post_canonical_path: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      authorLabel: r.author_label,
      postTitle: r.post_title,
      postCanonicalPath: r.post_canonical_path,
      createdAt: r.created_at,
    }));
  }

  /**
   * Delete a user and every row that references them, in one transaction:
   * their posts (and each post's dependents), then user-level rows (DMs,
   * notifications, social rows, comments, follows, sessions, login PINs, media).
   * Media files on disk are not removed (orphaned blobs are harmless).
   */
  deleteUserCascade(userId: string, email: string): void {
    const tx = this.db.transaction(() => {
      const postIds = (
        this.db.prepare('SELECT id FROM posts WHERE user_id = ?').all(userId) as { id: string }[]
      ).map((r) => r.id);

      for (const postId of postIds) {
        for (const sql of [
          // Notifications first: they may reference a comment (comment_id FK), so
          // remove them before the comments those notifications point at.
          'DELETE FROM notifications WHERE post_id = ?',
          'DELETE FROM notifications WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)',
          'DELETE FROM likes WHERE post_id = ?',
          'DELETE FROM reactions WHERE post_id = ?',
          'DELETE FROM comments WHERE post_id = ?',
          'DELETE FROM reposts WHERE post_id = ?',
          'DELETE FROM bookmarks WHERE post_id = ?',
          'DELETE FROM post_media WHERE post_id = ?',
          'DELETE FROM post_tags WHERE post_id = ?',
          'UPDATE posts SET quote_post_id = NULL WHERE quote_post_id = ?',
        ]) {
          this.db.prepare(sql).run(postId);
        }
      }
      this.db.prepare('DELETE FROM posts WHERE user_id = ?').run(userId);

      // User-level dependents.
      this.db.prepare('DELETE FROM dm_messages WHERE sender_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM dm_conversation_members WHERE user_id = ?').run(userId);
      // Drop conversations and their messages once they have no members left.
      this.db
        .prepare(
          `DELETE FROM dm_messages WHERE conversation_id IN (
             SELECT id FROM dm_conversations WHERE id NOT IN
               (SELECT conversation_id FROM dm_conversation_members))`
        )
        .run();
      this.db
        .prepare(
          `DELETE FROM dm_conversations WHERE id NOT IN
             (SELECT conversation_id FROM dm_conversation_members)`
        )
        .run();
      this.db
        .prepare('DELETE FROM notifications WHERE user_id = ? OR actor_user_id = ?')
        .run(userId, userId);
      this.db.prepare('DELETE FROM bookmarks WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM reposts WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM reactions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM likes WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
      this.db
        .prepare('DELETE FROM follows WHERE follower_user_id = ? OR following_user_id = ?')
        .run(userId, userId);
      this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM login_pins WHERE email = ?').run(email);
      this.db.prepare('DELETE FROM media WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
    tx();
  }
}
