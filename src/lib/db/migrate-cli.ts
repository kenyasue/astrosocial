/**
 * CLI entry point for running migrations: `npm run migrate`.
 * Used by the Docker entrypoint and for manual operation.
 */
import { config } from '../config/env';
import { openDatabase } from './connection';
import { runMigrations } from './migrate';

function main(): void {
  const db = openDatabase(config.dbPath);
  try {
    const { applied } = runMigrations(db, config.migrationsDir);
    if (applied.length === 0) {
      console.log('Migrations: up to date.');
    } else {
      console.log(`Migrations applied (${applied.length}):`);
      for (const name of applied) console.log(`  - ${name}`);
    }
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
