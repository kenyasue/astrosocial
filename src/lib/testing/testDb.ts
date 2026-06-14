/**
 * Test helper: build an isolated in-memory SQLite database with all project
 * migrations applied. Used by repository and service unit/integration tests.
 */
import path from 'node:path';
import { openDatabase, type DB } from '../db/connection';
import { runMigrations } from '../db/migrate';

const migrationsDir = path.join(process.cwd(), 'migrations');

export function makeTestDb(): DB {
  const db = openDatabase(':memory:');
  runMigrations(db, migrationsDir);
  return db;
}
