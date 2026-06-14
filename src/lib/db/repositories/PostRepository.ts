/**
 * Data access for posts. All SQL is parameterized and lives here (no ORM).
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Post, PostCard, PostStatus } from '../../types';
import { readingMinutesFromLength } from '../../text/readingTime';

interface PostRow {
  id: string;
  public_id: string;
  user_id: string;
  title: string | null;
  slug: string | null;
  canonical_path: string;
  markdown_body: string;
  excerpt: string | null;
  cover_media_id: string | null;
  quote_post_id: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PostRow): Post {
  return {
    id: row.id,
    publicId: row.public_id,
    userId: row.user_id,
    title: row.title,
    slug: row.slug,
    canonicalPath: row.canonical_path,
    markdownBody: row.markdown_body,
    excerpt: row.excerpt,
    coverMediaId: row.cover_media_id,
    quotePostId: row.quote_post_id,
    status: row.status as PostStatus,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePostRow {
  publicId: string;
  userId: string;
  title: string | null;
  slug: string;
  canonicalPath: string;
  markdownBody: string;
  excerpt: string | null;
  status: PostStatus;
  publishedAt: string | null;
  coverMediaId?: string | null;
  quotePostId?: string | null;
}

interface CardRow {
  public_id: string;
  title: string | null;
  slug: string | null;
  canonical_path: string;
  excerpt: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  author_username: string;
  author_display_name: string;
  cover_public_id: string | null;
  body_len: number;
  like_count: number;
  comment_count: number;
}

function mapCard(row: CardRow): PostCard {
  return {
    publicId: row.public_id,
    title: row.title,
    slug: row.slug,
    canonicalPath: row.canonical_path,
    excerpt: row.excerpt,
    status: row.status as PostStatus,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    coverUrl: row.cover_public_id ? `/media/${row.cover_public_id}/thumbnail` : null,
    readingMinutes: readingMinutesFromLength(row.body_len),
    likeCount: row.like_count,
    commentCount: row.comment_count,
  };
}

const CARD_FROM = `
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN media cm ON cm.id = p.cover_media_id`;

const CARD_COLUMNS = `
  p.public_id, p.title, p.slug, p.canonical_path, p.excerpt, p.status,
  p.published_at, p.created_at,
  u.username AS author_username, u.display_name AS author_display_name,
  cm.public_id AS cover_public_id, LENGTH(p.markdown_body) AS body_len,
  (SELECT COUNT(*) FROM likes WHERE likes.post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM comments WHERE comments.post_id = p.id AND comments.deleted_at IS NULL) AS comment_count`;

export class PostRepository {
  constructor(private readonly db: DB) {}

  create(input: CreatePostRow): Post {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO posts
           (id, public_id, user_id, title, slug, canonical_path, markdown_body, excerpt,
            cover_media_id, quote_post_id, status, published_at, created_at, updated_at)
         VALUES
           (@id, @publicId, @userId, @title, @slug, @canonicalPath, @markdownBody, @excerpt,
            @coverMediaId, @quotePostId, @status, @publishedAt, @now, @now)`
      )
      .run({
        id,
        now,
        ...input,
        coverMediaId: input.coverMediaId ?? null,
        quotePostId: input.quotePostId ?? null,
      });
    return this.findById(id)!;
  }

  findById(id: string): Post | null {
    const row = this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByPublicId(publicId: string): Post | null {
    const row = this.db.prepare('SELECT * FROM posts WHERE public_id = ?').get(publicId) as
      | PostRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  findByCanonicalPath(path: string): Post | null {
    const row = this.db.prepare('SELECT * FROM posts WHERE canonical_path = ?').get(path) as
      | PostRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  slugExistsForUser(userId: string, slug: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM posts WHERE user_id = ? AND slug = ?')
      .get(userId, slug);
    return row !== undefined;
  }

  /** Update mutable content fields. Only provided keys are changed. */
  update(
    id: string,
    fields: Partial<{
      title: string | null;
      markdownBody: string;
      excerpt: string | null;
      coverMediaId: string | null;
    }>
  ): Post | null {
    const columnByKey: Record<string, string> = {
      title: 'title',
      markdownBody: 'markdown_body',
      excerpt: 'excerpt',
      coverMediaId: 'cover_media_id',
    };
    const assignments: string[] = [];
    const params: Record<string, unknown> = { id, now: new Date().toISOString() };
    for (const [key, column] of Object.entries(columnByKey)) {
      if (key in fields) {
        assignments.push(`${column} = @${key}`);
        params[key] = (fields as Record<string, unknown>)[key] ?? null;
      }
    }
    if (assignments.length > 0) {
      this.db
        .prepare(`UPDATE posts SET ${assignments.join(', ')}, updated_at = @now WHERE id = @id`)
        .run(params);
    }
    return this.findById(id);
  }

  setStatus(id: string, status: PostStatus, publishedAt: string | null): Post | null {
    this.db
      .prepare('UPDATE posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?')
      .run(status, publishedAt, new Date().toISOString(), id);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  }

  /**
   * Delete a post and all rows that reference it (likes, reactions, comments,
   * reposts, bookmarks, post_media, notifications), and null out quote references
   * from other posts — all in one transaction to satisfy foreign keys.
   */
  deleteWithDependents(id: string): void {
    const tx = this.db.transaction((postId: string) => {
      for (const sql of [
        'DELETE FROM likes WHERE post_id = ?',
        'DELETE FROM reactions WHERE post_id = ?',
        'DELETE FROM comments WHERE post_id = ?',
        'DELETE FROM reposts WHERE post_id = ?',
        'DELETE FROM bookmarks WHERE post_id = ?',
        'DELETE FROM post_media WHERE post_id = ?',
        'DELETE FROM notifications WHERE post_id = ?',
        'UPDATE posts SET quote_post_id = NULL WHERE quote_post_id = ?',
      ]) {
        this.db.prepare(sql).run(postId);
      }
      this.db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    });
    tx(id);
  }

  /** Null out the cover on any posts referencing the given media id. */
  clearCoverMedia(mediaId: string): void {
    this.db.prepare('UPDATE posts SET cover_media_id = NULL WHERE cover_media_id = ?').run(mediaId);
  }

  /** Published posts newest-first (cursor = published_at ISO of the last item). */
  listPublished(limit = 20, cursor?: string): PostCard[] {
    const rows = (
      cursor
        ? this.db
            .prepare(
              `SELECT ${CARD_COLUMNS} ${CARD_FROM}
               WHERE p.status = 'published' AND p.published_at < ?
               ORDER BY p.published_at DESC LIMIT ?`
            )
            .all(cursor, limit)
        : this.db
            .prepare(
              `SELECT ${CARD_COLUMNS} ${CARD_FROM}
               WHERE p.status = 'published'
               ORDER BY p.published_at DESC LIMIT ?`
            )
            .all(limit)
    ) as CardRow[];
    return rows.map(mapCard);
  }

  /** Published posts by any of the given user ids, newest-first (following timeline). */
  listTimeline(userIds: string[], limit = 20, cursor?: string): PostCard[] {
    if (userIds.length === 0) return [];
    const placeholders = userIds.map(() => '?').join(', ');
    const cursorClause = cursor ? 'AND p.published_at < ?' : '';
    const params: unknown[] = [...userIds];
    if (cursor) params.push(cursor);
    params.push(limit);
    const rows = this.db
      .prepare(
        `SELECT ${CARD_COLUMNS} ${CARD_FROM}
         WHERE p.status = 'published' AND p.user_id IN (${placeholders}) ${cursorClause}
         ORDER BY p.published_at DESC LIMIT ?`
      )
      .all(...params) as CardRow[];
    return rows.map(mapCard);
  }

  /** A single post card by internal id (any status). */
  cardById(id: string): PostCard | null {
    const row = this.db
      .prepare(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p.id = ?`)
      .get(id) as CardRow | undefined;
    return row ? mapCard(row) : null;
  }

  /** Post cards for the given internal ids, preserving the input order. */
  cardsByIds(ids: string[]): PostCard[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p.id IN (${placeholders})`)
      .all(...ids) as CardRow[];
    const byId = new Map(rows.map((r) => [r.public_id, mapCard(r)]));
    // Re-map preserving input order via a lookup on internal id.
    const orderRows = this.db
      .prepare(`SELECT id, public_id FROM posts WHERE id IN (${placeholders})`)
      .all(...ids) as { id: string; public_id: string }[];
    const publicById = new Map(orderRows.map((r) => [r.id, r.public_id]));
    return ids
      .map((id) => byId.get(publicById.get(id) ?? ''))
      .filter((c): c is PostCard => c !== undefined);
  }

  /** Count a user's published posts. */
  countPublishedByUser(userId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM posts WHERE user_id = ? AND status = 'published'")
      .get(userId) as { c: number };
    return row.c;
  }

  /** A user's published posts, newest-first (for the public profile grid). */
  listPublishedByUser(userId: string, limit = 30): PostCard[] {
    const rows = this.db
      .prepare(
        `SELECT ${CARD_COLUMNS} ${CARD_FROM}
         WHERE p.user_id = ? AND p.status = 'published'
         ORDER BY p.published_at DESC LIMIT ?`
      )
      .all(userId, limit) as CardRow[];
    return rows.map(mapCard);
  }

  /** All of a user's posts (any status), newest-first. */
  listByUser(userId: string): PostCard[] {
    const rows = this.db
      .prepare(
        `SELECT ${CARD_COLUMNS} ${CARD_FROM}
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(userId) as CardRow[];
    return rows.map(mapCard);
  }
}
