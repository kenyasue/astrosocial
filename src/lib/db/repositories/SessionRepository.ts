/**
 * Data access for sessions. All SQL is parameterized and lives here (no ORM).
 * Session tokens are stored hashed; only the hash is persisted.
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Session } from '../../types';

interface SessionRow {
  id: string;
  user_id: string;
  session_token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
}

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    sessionTokenHash: row.session_token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export interface CreateSessionInput {
  userId: string;
  sessionTokenHash: string;
  expiresAt: string;
}

export class SessionRepository {
  constructor(private readonly db: DB) {}

  create(input: CreateSessionInput): Session {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, last_used_at)
         VALUES (@id, @userId, @hash, @expiresAt, @now, @now)`
      )
      .run({ id, userId: input.userId, hash: input.sessionTokenHash, expiresAt: input.expiresAt, now });
    return this.findById(id)!;
  }

  findById(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  findByTokenHash(tokenHash: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE session_token_hash = ?').get(tokenHash) as
      | SessionRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  touch(id: string): void {
    this.db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  deleteByTokenHash(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE session_token_hash = ?').run(tokenHash);
  }

  deleteExpired(nowIso: string = new Date().toISOString()): number {
    const info = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso);
    return info.changes;
  }
}
