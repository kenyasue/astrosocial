/**
 * Data access for users. All SQL is parameterized and lives here (no ORM).
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { DmPolicy, User } from '../../types';

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_media_id: string | null;
  cover_media_id: string | null;
  website_url: string | null;
  location: string | null;
  dm_policy: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarMediaId: row.avatar_media_id,
    coverMediaId: row.cover_media_id,
    websiteUrl: row.website_url,
    location: row.location,
    dmPolicy: row.dm_policy as DmPolicy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateUserInput {
  email: string;
  username: string;
  displayName: string;
}

/** A user row for the public Users directory (identity + media public ids). */
export interface UserDirectoryRow {
  username: string;
  displayName: string;
  avatarPublicId: string | null;
  lastImagePublicId: string | null;
}

/** Raw directory query row (snake_case columns). */
interface DirectoryRow {
  username: string;
  display_name: string;
  avatar_public_id: string | null;
  last_image_public_id: string | null;
}

/** Columns a profile update may set, mapped to their DB column names. */
const PROFILE_COLUMNS: Record<string, string> = {
  displayName: 'display_name',
  bio: 'bio',
  websiteUrl: 'website_url',
  location: 'location',
  avatarMediaId: 'avatar_media_id',
  coverMediaId: 'cover_media_id',
  dmPolicy: 'dm_policy',
};

export class UserRepository {
  constructor(private readonly db: DB) {}

  create(input: CreateUserInput): User {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO users (id, email, username, display_name, dm_policy, created_at, updated_at)
         VALUES (@id, @email, @username, @displayName, 'everyone', @now, @now)`
      )
      .run({ id, email: input.email, username: input.username, displayName: input.displayName, now });
    return this.findById(id)!;
  }

  findById(id: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? mapRow(row) : null;
  }

  findByEmail(email: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | UserRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  findByUsername(username: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | UserRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  /**
   * Suggested users to follow: excludes the viewer and anyone they already follow,
   * ranked by follower count then recency. Pass null for an anonymous viewer.
   */
  whoToFollow(viewerId: string | null, limit = 3): User[] {
    const order = `ORDER BY (SELECT COUNT(*) FROM follows f WHERE f.following_user_id = u.id) DESC,
                   u.created_at DESC LIMIT ?`;
    const rows = (
      viewerId
        ? this.db
            .prepare(
              `SELECT u.* FROM users u
               WHERE u.id != ?
                 AND u.id NOT IN (SELECT following_user_id FROM follows WHERE follower_user_id = ?)
               ${order}`
            )
            .all(viewerId, viewerId, limit)
        : this.db.prepare(`SELECT u.* FROM users u ${order}`).all(limit)
    ) as UserRow[];
    return rows.map(mapRow);
  }

  /** Search users by username or display name (case-insensitive substring). */
  search(query: string, limit = 20): User[] {
    const like = `%${query}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM users WHERE username LIKE ? OR display_name LIKE ?
         ORDER BY username LIMIT ?`
      )
      .all(like, like, limit) as UserRow[];
    return rows.map(mapRow);
  }

  /**
   * All users for the public Users directory, newest-first, each with their
   * avatar and most-recent image (image MIME) resolved in a single query.
   */
  listDirectory(limit = 100): UserDirectoryRow[] {
    const rows = this.db
      .prepare(
        `SELECT u.username, u.display_name,
           (SELECT public_id FROM media WHERE id = u.avatar_media_id) AS avatar_public_id,
           (SELECT m.public_id FROM media m
              WHERE m.user_id = u.id AND m.mime_type LIKE 'image/%'
              ORDER BY m.created_at DESC LIMIT 1) AS last_image_public_id
         FROM users u
         ORDER BY u.created_at DESC
         LIMIT ?`
      )
      .all(limit) as DirectoryRow[];
    return rows.map((r) => ({
      username: r.username,
      displayName: r.display_name,
      avatarPublicId: r.avatar_public_id,
      lastImagePublicId: r.last_image_public_id,
    }));
  }

  usernameExists(username: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    return row !== undefined;
  }

  /**
   * Update editable profile fields. Only keys present in `fields` are changed.
   * Returns the updated user, or null if the user does not exist.
   */
  updateProfile(
    id: string,
    fields: Partial<Record<keyof typeof PROFILE_COLUMNS, string | null>>
  ): User | null {
    const assignments: string[] = [];
    const params: Record<string, unknown> = { id, now: new Date().toISOString() };

    for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
      if (key in fields) {
        assignments.push(`${column} = @${key}`);
        params[key] = fields[key as keyof typeof PROFILE_COLUMNS] ?? null;
      }
    }

    if (assignments.length > 0) {
      this.db
        .prepare(`UPDATE users SET ${assignments.join(', ')}, updated_at = @now WHERE id = @id`)
        .run(params);
    }

    return this.findById(id);
  }
}
