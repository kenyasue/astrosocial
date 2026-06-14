/**
 * Data access for login PINs. All SQL is parameterized and lives here (no ORM).
 */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { LoginPin } from '../../types';

interface LoginPinRow {
  id: string;
  email: string;
  pin_hash: string;
  expires_at: string;
  consumed_at: string | null;
  failed_attempts: number;
  created_at: string;
}

function mapRow(row: LoginPinRow): LoginPin {
  return {
    id: row.id,
    email: row.email,
    pinHash: row.pin_hash,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    failedAttempts: row.failed_attempts,
    createdAt: row.created_at,
  };
}

export interface CreateLoginPinInput {
  email: string;
  pinHash: string;
  expiresAt: string;
}

export class LoginPinRepository {
  constructor(private readonly db: DB) {}

  create(input: CreateLoginPinInput): LoginPin {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO login_pins (id, email, pin_hash, expires_at, failed_attempts, created_at)
         VALUES (@id, @email, @pinHash, @expiresAt, 0, @now)`
      )
      .run({ id, email: input.email, pinHash: input.pinHash, expiresAt: input.expiresAt, now: new Date().toISOString() });
    return this.findById(id)!;
  }

  findById(id: string): LoginPin | null {
    const row = this.db.prepare('SELECT * FROM login_pins WHERE id = ?').get(id) as
      | LoginPinRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  /** The most recent unconsumed PIN for an email, if any. */
  findActiveByEmail(email: string): LoginPin | null {
    const row = this.db
      .prepare(
        `SELECT * FROM login_pins
         WHERE email = ? AND consumed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(email) as LoginPinRow | undefined;
    return row ? mapRow(row) : null;
  }

  /** Count PINs created for an email since the given ISO timestamp (rate limiting). */
  countCreatedSince(email: string, sinceIso: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM login_pins WHERE email = ? AND created_at >= ?')
      .get(email, sinceIso) as { c: number };
    return row.c;
  }

  incrementFailedAttempts(id: string): void {
    this.db.prepare('UPDATE login_pins SET failed_attempts = failed_attempts + 1 WHERE id = ?').run(id);
  }

  consume(id: string): void {
    this.db
      .prepare('UPDATE login_pins SET consumed_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }
}
