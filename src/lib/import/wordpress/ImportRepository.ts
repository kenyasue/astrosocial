/**
 * Data access for the import subsystem. All SQL lives here (no ORM).
 *
 * Covers the bookkeeping tables (`import_jobs`, `import_logs`, `import_mappings`)
 * and timestamp-preserving inserts for `users`, `media`, and `posts`. The
 * regular repositories set `created_at = now`; an import must keep the original
 * WordPress timestamps, so it writes through these dedicated methods instead.
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../../db/connection';
import type { MediaVisibility, PostStatus } from '../../types';

export type ImportLogLevel = 'info' | 'warn' | 'error';

export interface InsertUserRow {
  email: string;
  username: string;
  displayName: string;
  websiteUrl: string | null;
  createdAt: string;
}

export interface InsertMediaRow {
  publicId: string;
  userId: string;
  canonicalPath: string;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  storagePath: string;
  thumbnailPath: string | null;
  altText: string | null;
  caption: string | null;
  visibility: MediaVisibility;
  createdAt: string;
}

export interface InsertPostRow {
  publicId: string;
  userId: string;
  title: string | null;
  slug: string;
  canonicalPath: string;
  markdownBody: string;
  excerpt: string | null;
  coverMediaId: string | null;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ImportRepository {
  constructor(private readonly db: DB) {}

  /**
   * Run a synchronous unit of work inside a single SQLite transaction. Used to
   * batch the hundreds of inserts an import performs (far faster than the
   * implicit per-statement transactions, and atomic on crash).
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // --- jobs -----------------------------------------------------------------

  createJob(sourceType: string, sourceName: string | null, optionsJson: string | null): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO import_jobs
           (id, source_type, source_name, status, options_json, started_at, created_at, updated_at)
         VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`
      )
      .run(id, sourceType, sourceName, optionsJson, now, now, now);
    return id;
  }

  finishJob(
    id: string,
    status: 'completed' | 'failed',
    counts: { total: number; processed: number; failed: number }
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE import_jobs
           SET status = ?, total_items = ?, processed_items = ?, failed_items = ?,
               finished_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(status, counts.total, counts.processed, counts.failed, now, now, id);
  }

  // --- logs -----------------------------------------------------------------

  log(jobId: string, level: ImportLogLevel, message: string, sourceRef: string | null = null): void {
    this.db
      .prepare(
        `INSERT INTO import_logs (id, import_job_id, level, message, source_ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), jobId, level, message, sourceRef, new Date().toISOString());
  }

  // --- mappings -------------------------------------------------------------

  addMapping(
    jobId: string,
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string
  ): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO import_mappings
           (id, import_job_id, source_type, source_id, target_type, target_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), jobId, sourceType, sourceId, targetType, targetId, new Date().toISOString());
  }

  getMappingTargetId(jobId: string, sourceType: string, sourceId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT target_id FROM import_mappings
         WHERE import_job_id = ? AND source_type = ? AND source_id = ?`
      )
      .get(jobId, sourceType, sourceId) as { target_id: string } | undefined;
    return row?.target_id ?? null;
  }

  // --- entity inserts (timestamp-preserving) --------------------------------

  insertUser(row: InsertUserRow): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO users
           (id, email, username, display_name, website_url, dm_policy, created_at, updated_at)
         VALUES (@id, @email, @username, @displayName, @websiteUrl, 'everyone', @createdAt, @createdAt)`
      )
      .run({ id, ...row });
    return id;
  }

  insertMedia(row: InsertMediaRow): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO media
           (id, public_id, user_id, canonical_path, file_name, original_file_name, mime_type,
            file_size, width, height, duration_seconds, storage_path, thumbnail_path,
            alt_text, caption, visibility, created_at)
         VALUES
           (@id, @publicId, @userId, @canonicalPath, @fileName, @originalFileName, @mimeType,
            @fileSize, @width, @height, NULL, @storagePath, @thumbnailPath,
            @altText, @caption, @visibility, @createdAt)`
      )
      .run({ id, ...row });
    return id;
  }

  insertPost(row: InsertPostRow): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO posts
           (id, public_id, user_id, title, slug, canonical_path, markdown_body, excerpt,
            cover_media_id, quote_post_id, status, published_at, created_at, updated_at)
         VALUES
           (@id, @publicId, @userId, @title, @slug, @canonicalPath, @markdownBody, @excerpt,
            @coverMediaId, NULL, @status, @publishedAt, @createdAt, @updatedAt)`
      )
      .run({ id, ...row });
    return id;
  }

  /** Insert a comment with a preserved timestamp (used when a dump has comments). */
  insertComment(row: {
    postId: string;
    userId: string | null;
    guestName: string | null;
    body: string;
    createdAt: string;
  }): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO comments (id, post_id, user_id, guest_name, body, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'approved', ?)`
      )
      .run(id, row.postId, row.userId, row.guestName, row.body, row.createdAt);
    return id;
  }
}
