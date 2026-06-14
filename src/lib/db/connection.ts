/**
 * SQLite connection management.
 *
 * Opens a `better-sqlite3` database configured for self-hosted use:
 * WAL journaling, a busy timeout, and enforced foreign keys. A process-wide
 * singleton is used by the running server; tests open isolated databases.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/env';

export type DB = Database.Database;

/**
 * Open a SQLite database at the given path with AstroSocial's pragmas applied.
 * Pass ':memory:' for an ephemeral in-memory database (used in tests).
 *
 * @param dbPath - Filesystem path or ':memory:'
 * @returns A configured better-sqlite3 Database instance
 */
export function openDatabase(dbPath: string): DB {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

let singleton: DB | null = null;

/** Get (or lazily open) the process-wide database singleton. */
export function getDatabase(): DB {
  if (!singleton) {
    singleton = openDatabase(config.dbPath);
  }
  return singleton;
}

/** Close and clear the singleton (primarily for graceful shutdown). */
export function closeDatabase(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
