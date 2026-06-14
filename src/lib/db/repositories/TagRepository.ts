/** Data access for tags and post-tag links. Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import { slugify } from '../../urls/slug';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  type: 'tag' | 'category';
}

interface TagRow {
  id: string;
  name: string;
  slug: string;
  type: string;
}

function mapRow(row: TagRow): Tag {
  return { id: row.id, name: row.name, slug: row.slug, type: row.type as 'tag' | 'category' };
}

export class TagRepository {
  constructor(private readonly db: DB) {}

  /** Find a tag by slug, or create it. */
  findOrCreate(name: string, type: 'tag' | 'category' = 'tag'): Tag {
    const slug = slugify(name) || 'tag';
    const existing = this.db.prepare('SELECT * FROM tags WHERE slug = ?').get(slug) as
      | TagRow
      | undefined;
    if (existing) return mapRow(existing);
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO tags (id, name, slug, type, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name.trim(), slug, type, new Date().toISOString());
    return { id, name: name.trim(), slug, type };
  }

  findBySlug(slug: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE slug = ?').get(slug) as TagRow | undefined;
    return row ? mapRow(row) : null;
  }

  attachToPost(postId: string, tagId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO post_tags (id, post_id, tag_id, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(randomUUID(), postId, tagId, new Date().toISOString());
  }

  /** Replace a post's tags with the given set (used on edit). */
  clearForPost(postId: string): void {
    this.db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  }

  listForPost(postId: string): Tag[] {
    const rows = this.db
      .prepare(
        `SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
         WHERE pt.post_id = ? ORDER BY t.name`
      )
      .all(postId) as TagRow[];
    return rows.map(mapRow);
  }

  /** Internal post ids tagged with a tag slug (published filtering happens upstream). */
  postIdsByTag(slug: string, limit = 30): string[] {
    const rows = this.db
      .prepare(
        `SELECT pt.post_id AS post_id
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         JOIN posts p ON p.id = pt.post_id
         WHERE t.slug = ? AND p.status = 'published'
         ORDER BY p.published_at DESC LIMIT ?`
      )
      .all(slug, limit) as { post_id: string }[];
    return rows.map((r) => r.post_id);
  }

  /** Tags whose name or slug matches the query (case-insensitive substring). */
  searchByName(query: string, limit = 20): { name: string; slug: string }[] {
    const like = `%${query}%`;
    return this.db
      .prepare(
        `SELECT name, slug FROM tags WHERE name LIKE ? OR slug LIKE ? ORDER BY name LIMIT ?`
      )
      .all(like, like, limit) as { name: string; slug: string }[];
  }

  /** Most-used tags (by number of published posts). */
  popularTags(limit = 20): { name: string; slug: string; count: number }[] {
    return this.db
      .prepare(
        `SELECT t.name, t.slug, COUNT(*) AS count
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
         GROUP BY t.id ORDER BY count DESC, t.name LIMIT ?`
      )
      .all(limit) as { name: string; slug: string; count: number }[];
  }
}
