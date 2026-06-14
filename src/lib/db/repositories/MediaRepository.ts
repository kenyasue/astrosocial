/**
 * Data access for media. All SQL is parameterized and lives here (no ORM).
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Media, MediaVisibility } from '../../types';

interface MediaRow {
  id: string;
  public_id: string;
  user_id: string;
  canonical_path: string;
  file_name: string;
  original_file_name: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  storage_path: string;
  thumbnail_path: string | null;
  alt_text: string | null;
  caption: string | null;
  visibility: string;
  created_at: string;
}

function mapRow(row: MediaRow): Media {
  return {
    id: row.id,
    publicId: row.public_id,
    userId: row.user_id,
    canonicalPath: row.canonical_path,
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    storagePath: row.storage_path,
    thumbnailPath: row.thumbnail_path,
    altText: row.alt_text,
    caption: row.caption,
    visibility: row.visibility as MediaVisibility,
    createdAt: row.created_at,
  };
}

export interface CreateMediaRow {
  publicId: string;
  userId: string;
  canonicalPath: string;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  storagePath: string;
  thumbnailPath: string | null;
  visibility: MediaVisibility;
}

export class MediaRepository {
  constructor(private readonly db: DB) {}

  create(input: CreateMediaRow): Media {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO media
          (id, public_id, user_id, canonical_path, file_name, original_file_name, mime_type,
           file_size, width, height, duration_seconds, storage_path, thumbnail_path, visibility, created_at)
         VALUES
          (@id, @publicId, @userId, @canonicalPath, @fileName, @originalFileName, @mimeType,
           @fileSize, @width, @height, @durationSeconds, @storagePath, @thumbnailPath, @visibility, @now)`
      )
      .run({ id, now: new Date().toISOString(), ...input });
    return this.findById(id)!;
  }

  findById(id: string): Media | null {
    const row = this.db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByPublicId(publicId: string): Media | null {
    const row = this.db.prepare('SELECT * FROM media WHERE public_id = ?').get(publicId) as
      | MediaRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  listByUser(userId: string): Media[] {
    const rows = this.db
      .prepare('SELECT * FROM media WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as MediaRow[];
    return rows.map(mapRow);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM media WHERE id = ?').run(id);
  }
}
