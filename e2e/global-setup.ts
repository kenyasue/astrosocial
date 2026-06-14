/**
 * Playwright global setup: remove the isolated E2E database before the run so
 * each `npm run test:e2e` starts from a clean, migrated schema.
 */
import fs from 'node:fs';
import { E2E_DB_PATH, E2E_UPLOADS_DIR } from './config';

export default function globalSetup(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${E2E_DB_PATH}${suffix}`;
    try {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    } catch {
      // Best-effort: a stale lock from a prior run should not block startup.
      // The server opens/creates the DB fresh; tests use unique emails anyway.
    }
  }
  try {
    fs.rmSync(E2E_UPLOADS_DIR, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of uploaded media from a prior run.
  }
}
