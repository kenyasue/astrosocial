/**
 * Migration runner.
 *
 * Applies SQL migration files (`NNNN_*.sql`) in filename order, recording each
 * applied file in the `migrations` table. Already-applied files are skipped
 * (idempotent). Each migration runs inside a transaction; any failure aborts
 * the run so the application never starts against a half-migrated schema.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DB } from './connection';

function ensureMigrationsTable(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}

/** List `.sql` migration files in a directory, sorted by filename. */
export function listMigrationFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

export interface MigrationResult {
  /** Names of migrations applied during this run (excludes already-applied). */
  applied: string[];
}

/**
 * Run all pending migrations from `dir` against `db`.
 *
 * @param db - An open database connection
 * @param dir - Directory containing `NNNN_*.sql` files
 * @returns The list of newly applied migration names
 * @throws If any migration fails to apply (the run is aborted)
 */
export function runMigrations(db: DB, dir: string): MigrationResult {
  ensureMigrationsTable(db);

  const appliedRows = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
  const alreadyApplied = new Set(appliedRows.map((r) => r.name));
  const files = listMigrationFiles(dir);

  const insert = db.prepare('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)');
  const applied: string[] = [];

  for (const file of files) {
    if (alreadyApplied.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      insert.run(randomUUID(), file, new Date().toISOString());
    });

    try {
      apply();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration failed: ${file}: ${message}`);
    }

    applied.push(file);
  }

  return { applied };
}
