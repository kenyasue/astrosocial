/**
 * CLI for importing a WordPress dump into AstroSocial.
 *
 *   npm run import:wordpress -- <dump.sql> [options]
 *
 * Options:
 *   --no-media          Do not download media; keep remote image URLs.
 *   --max-media <n>     Cap the number of media files downloaded.
 *   --limit-posts <n>   Cap the number of posts imported (dry runs).
 *   --media-base <h>    Comma-separated media hosts (default astro.beer).
 *   --db <path>         SQLite database path (default config / OPENMEOW_DB_PATH).
 *   --uploads <path>    Uploads directory (default config / OPENMEOW_UPLOADS_DIR).
 */
import fs from 'node:fs';
import { config } from '../../config/env';
import { openDatabase } from '../../db/connection';
import { runMigrations } from '../../db/migrate';
import { LocalStorageProvider } from '../../storage/localStorageProvider';
import { TagRepository } from '../../db/repositories/TagRepository';
import { UserRepository } from '../../db/repositories/UserRepository';
import { PostRepository } from '../../db/repositories/PostRepository';
import { ImportRepository } from './ImportRepository';
import { HttpImageFetcher } from './mediaFetcher';
import { WordPressImporter, type WordPressImportOptions } from './WordPressImporter';

interface CliArgs {
  dumpPath: string;
  dbPath: string;
  uploadsDir: string;
  options: WordPressImportOptions;
}

function parseArgs(argv: string[]): CliArgs {
  // Note: "wordress_export" (no 'd') matches the actual export directory in the
  // repo — intentional, do not "correct" the spelling here.
  let dumpPath = 'wordress_export/wordpress.sql';
  let dbPath = config.dbPath;
  let uploadsDir = config.uploadsDir;
  const options: WordPressImportOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--no-media':
        options.importMedia = false;
        break;
      case '--max-media':
        options.maxMedia = Number.parseInt(argv[++i], 10);
        break;
      case '--limit-posts':
        options.limitPosts = Number.parseInt(argv[++i], 10);
        break;
      case '--media-base':
        options.mediaHosts = argv[++i].split(',').map((h) => h.trim()).filter(Boolean);
        break;
      case '--db':
        dbPath = argv[++i];
        break;
      case '--uploads':
        uploadsDir = argv[++i];
        break;
      default:
        if (!arg.startsWith('--')) dumpPath = arg;
    }
  }
  options.sourceName = dumpPath;
  return { dumpPath, dbPath, uploadsDir, options };
}

async function main(): Promise<void> {
  const { dumpPath, dbPath, uploadsDir, options } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump file not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');

  const db = openDatabase(dbPath);
  runMigrations(db, config.migrationsDir);

  const storage = new LocalStorageProvider(uploadsDir);
  const fetcher = new HttpImageFetcher(20_000, (m) => console.warn(`  media: ${m}`));
  const importer = new WordPressImporter(
    new ImportRepository(db),
    new TagRepository(db),
    new UserRepository(db),
    new PostRepository(db),
    storage,
    fetcher
  );

  console.log(
    `Importing (media=${options.importMedia !== false ? 'on' : 'off'}` +
      `${options.limitPosts ? `, limitPosts=${options.limitPosts}` : ''}` +
      `${options.maxMedia ? `, maxMedia=${options.maxMedia}` : ''})…`
  );

  const PHASE_LABEL = { users: 'Users', media: 'Media', posts: 'Posts' } as const;
  const isTty = Boolean(process.stdout.isTTY);
  let currentPhase: string | null = null;
  let lastPct = -1;

  const result = await importer.run(sql, {
    ...options,
    onPlan: (plan) => {
      console.log('\nPlan (to import):');
      console.log(`  users:    ${plan.users}`);
      console.log(`  posts:    ${plan.posts}`);
      console.log(`  media:    ${plan.media} image(s) to download`);
      console.log(`  tags:     ${plan.tags} post-tag link(s)`);
      console.log(`  comments: ${plan.comments}`);
      console.log('');
    },
    onProgress: ({ phase, done, total }) => {
      if (phase !== currentPhase) {
        currentPhase = phase;
        lastPct = -1;
      }
      const label = PHASE_LABEL[phase];
      const pct = total > 0 ? Math.floor((done / total) * 100) : 100;
      if (isTty) {
        // Overwrite the same line as the phase advances.
        process.stdout.write(`\r  ${label}: ${done}/${total} (${pct}%)   `);
        if (done >= total) process.stdout.write('\n');
      } else if (pct !== lastPct && (pct % 10 === 0 || done >= total)) {
        // Non-TTY (piped/CI): log at 10% milestones to avoid flooding output.
        lastPct = pct;
        console.log(`  ${label}: ${done}/${total} (${pct}%)`);
      }
    },
  });

  console.log('Import complete:');
  console.log(`  job:           ${result.jobId}`);
  console.log(`  users:         ${result.users}`);
  console.log(`  posts:         ${result.posts} (skipped ${result.postsSkipped})`);
  console.log(`  media:         ${result.media} (failed ${result.mediaFailed})`);
  console.log(`  tags:          ${result.tags}`);
  console.log(`  comments:      ${result.comments}`);
  db.close();
}

main().catch((error) => {
  console.error('Import failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
