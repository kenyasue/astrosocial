/**
 * Load variables from a local `.env` file into `process.env` before any
 * configuration is read.
 *
 * This is a deliberately tiny, dependency-free `.env` reader (no `dotenv`):
 * it parses `KEY=value` lines, ignores blanks and `#` comments, and strips a
 * single layer of surrounding quotes. Variables already present in the real
 * environment take precedence — the file only fills in what is unset — so an
 * explicit `PORT=...` from PM2/Docker/the shell always wins over `.env`.
 *
 * Imported for its side effect at the top of `env.ts`, so every entrypoint
 * (server, migrate, seed, importer) sees the same configuration.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), process.env.OPENMEOW_ENV_FILE ?? '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // Skip empty keys and never override a variable already set in the environment.
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
