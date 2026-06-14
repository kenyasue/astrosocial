/**
 * Data access for the generic `app_settings` key/value store (e.g. SMTP config).
 * All SQL is parameterized and lives here (no ORM).
 */
import type { DB } from '../connection';

export class SettingsRepository {
  constructor(private readonly db: DB) {}

  /** Read a single setting value, or null when unset. */
  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  /** Read every setting whose key starts with `prefix` (default: all). */
  getMany(prefix = ''): Record<string, string> {
    const rows = this.db
      .prepare('SELECT key, value FROM app_settings WHERE key LIKE ?')
      .all(`${prefix}%`) as { key: string; value: string }[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  /** Insert or update a single setting. */
  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, new Date().toISOString());
  }

  /** Insert or update many settings in one transaction. */
  setMany(values: Record<string, string>): void {
    const tx = this.db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) this.set(key, value);
    });
    tx(Object.entries(values));
  }
}
