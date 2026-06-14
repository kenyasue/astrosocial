import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { DB } from '../../db/connection';
import { makeTestDb } from '../../testing/testDb';
import { LocalStorageProvider } from '../../storage/localStorageProvider';
import { TagRepository } from '../../db/repositories/TagRepository';
import { UserRepository } from '../../db/repositories/UserRepository';
import { PostRepository } from '../../db/repositories/PostRepository';
import { ImportRepository } from './ImportRepository';
import { WordPressImporter } from './WordPressImporter';
import type { ImageFetcher } from './mediaFetcher';

/** A 2×2 red PNG, used as the bytes for every fetched image. */
async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

/** Fetcher that returns the tiny PNG for any URL and records what it fetched. */
class FakeFetcher implements ImageFetcher {
  readonly requested: string[] = [];
  constructor(private readonly png: Buffer) {}
  async fetch(url: string) {
    this.requested.push(url);
    return { buffer: this.png, mimeType: 'image/png' };
  }
}

/** A fetcher that always fails (simulates an unreachable site). */
class FailingFetcher implements ImageFetcher {
  async fetch() {
    return null;
  }
}

const DUMP = `
INSERT INTO \`wp_users\` (\`ID\`, \`user_login\`, \`user_pass\`, \`user_nicename\`, \`user_email\`, \`user_url\`, \`user_registered\`, \`display_name\`) VALUES
(2, 'sasa', 'HASH', 'sasa', 'sasa@astro.beer', 'https://sasa.example', '2020-12-01 21:02:54', 'Saša Nuić'),
(3, 'kenyasue', 'HASH', 'ken', 'ken@astro.beer', '', '2021-03-28 16:21:06', 'Ken Yasue');

INSERT INTO \`wp_posts\` (\`ID\`, \`post_author\`, \`post_date\`, \`post_content\`, \`post_title\`, \`post_excerpt\`, \`post_status\`, \`post_name\`, \`post_modified\`, \`guid\`, \`post_type\`, \`post_mime_type\`) VALUES
(196, 2, '2020-02-10 10:00:00', '', 'M42 full', '', 'inherit', 'm42', '2020-02-10 10:00:00', 'http://astro.beer/wp-content/uploads/2020/02/m42.jpg', 'attachment', 'image/jpeg'),
(500, 2, '2020-02-11 12:00:00', '<!-- wp:image {\\"id\\":196} -->\\n<figure class=\\"wp-block-image\\"><img src=\\"http://astro.beer/wp-content/uploads/2020/02/m42-1024x643.jpg\\" alt=\\"\\"/></figure>\\n<!-- /wp:image -->\\n<!-- wp:paragraph --><p>The Orion Nebula.</p><!-- /wp:paragraph -->', 'Orion Nebula', '', 'publish', 'orion-nebula', '2020-02-12 09:00:00', 'http://astro.beer/?p=500', 'post', ''),
(501, 3, '2020-03-01 12:00:00', '<p>A draft about Saturn.</p>', 'Saturn draft', 'Short excerpt', 'draft', 'saturn-draft', '2020-03-01 12:00:00', 'http://astro.beer/?p=501', 'post', ''),
(900, 2, '2020-01-01 00:00:00', 'should be ignored', 'A revision', '', 'inherit', 'rev', '2020-01-01 00:00:00', '', 'revision', '');

INSERT INTO \`wp_postmeta\` (\`meta_id\`, \`post_id\`, \`meta_key\`, \`meta_value\`) VALUES
(1, 500, '_thumbnail_id', '196');

INSERT INTO \`wp_terms\` (\`term_id\`, \`name\`, \`slug\`, \`term_group\`) VALUES
(34, 'Eastern Veil', 'eastern-veil', 0),
(40, 'Saturn', 'saturn', 0);

INSERT INTO \`wp_term_taxonomy\` (\`term_taxonomy_id\`, \`term_id\`, \`taxonomy\`, \`description\`, \`parent\`, \`count\`) VALUES
(34, 34, 'post_tag', '', 0, 1),
(40, 40, 'category', '', 0, 1);

INSERT INTO \`wp_term_relationships\` (\`object_id\`, \`term_taxonomy_id\`, \`term_order\`) VALUES
(500, 34, 0),
(500, 40, 0);
`;

describe('WordPressImporter', () => {
  let db: DB;
  let uploadsDir: string;
  let png: Buffer;

  beforeEach(async () => {
    db = makeTestDb();
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-import-'));
    png = await tinyPng();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  function build(fetcher: ImageFetcher): WordPressImporter {
    return new WordPressImporter(
      new ImportRepository(db),
      new TagRepository(db),
      new UserRepository(db),
      new PostRepository(db),
      new LocalStorageProvider(uploadsDir),
      fetcher
    );
  }

  it('reports a plan and per-phase progress before/while importing', async () => {
    const fetcher = new FakeFetcher(png);
    let plan: import('./WordPressImporter').WordPressImportPlan | undefined;
    const progress: import('./WordPressImporter').ImportProgress[] = [];

    const result = await build(fetcher).run(DUMP, {
      onPlan: (p) => {
        plan = p;
      },
      onProgress: (p) => progress.push(p),
    });

    // The plan is computed up front and matches what actually happened.
    expect(plan).toEqual({ users: 2, posts: 2, media: 2, tags: 2, comments: 0 });
    expect(result.plan).toEqual(plan);

    // Each phase reports done/total, ending at done === total.
    const media = progress.filter((p) => p.phase === 'media');
    expect(media.at(-1)).toEqual({ phase: 'media', done: 2, total: 2 });
    const posts = progress.filter((p) => p.phase === 'posts');
    expect(posts.at(-1)).toEqual({ phase: 'posts', done: 2, total: 2 });
    expect(progress.filter((p) => p.phase === 'users').at(-1)?.done).toBe(2);
  });

  it('imports users, posts, media, tags and rewrites image URLs', async () => {
    const fetcher = new FakeFetcher(png);
    const result = await build(fetcher).run(DUMP, { sourceName: 'fixture' });

    expect(result.users).toBe(2);
    expect(result.posts).toBe(2); // the post + the draft; revision/attachment excluded
    expect(result.media).toBe(2); // in-content image + featured guid
    expect(result.tags).toBe(2); // a post_tag + a category
    expect(result.comments).toBe(0);

    const users = new UserRepository(db);
    const sasa = users.findByEmail('sasa@astro.beer');
    expect(sasa?.username).toBe('sasa');
    expect(sasa?.displayName).toBe('Saša Nuić');
    expect(sasa?.createdAt).toBe(new Date('2020-12-01T21:02:54Z').toISOString());

    const posts = new PostRepository(db);
    const orion = posts.findByCanonicalPath('/@sasa/posts/orion-nebula');
    expect(orion).not.toBeNull();
    expect(orion!.status).toBe('published');
    expect(orion!.publishedAt).toBe(new Date('2020-02-11T12:00:00Z').toISOString());
    // The in-content image URL was rewritten to a local media URL …
    expect(orion!.markdownBody).toContain('/media/m_');
    expect(orion!.markdownBody).toContain('/original');
    expect(orion!.markdownBody).not.toContain('astro.beer');
    // … block comments stripped, paragraph kept.
    expect(orion!.markdownBody).not.toContain('<!--');
    expect(orion!.markdownBody).toContain('The Orion Nebula.');
    // Featured image became the cover.
    expect(orion!.coverMediaId).not.toBeNull();

    // Media keeps the referencing post's date, not the import-run time.
    const mediaDates = (db.prepare('SELECT created_at FROM media').all() as { created_at: string }[])
      .map((r) => r.created_at);
    expect(mediaDates).toContain(new Date('2020-02-11T12:00:00Z').toISOString());

    // The draft keeps draft status and its supplied excerpt.
    const draft = posts.findByCanonicalPath('/@ken/posts/saturn-draft');
    expect(draft!.status).toBe('draft');
    expect(draft!.publishedAt).toBeNull();
    expect(draft!.excerpt).toBe('Short excerpt');
  });

  it('keeps remote URLs when media download fails', async () => {
    const result = await build(new FailingFetcher()).run(DUMP);
    expect(result.media).toBe(0);
    expect(result.mediaFailed).toBeGreaterThan(0);
    const orion = new PostRepository(db).findByCanonicalPath('/@sasa/posts/orion-nebula');
    // Remote URL retained (upgraded to https) so the image still renders.
    expect(orion!.markdownBody).toContain('https://astro.beer/wp-content/uploads/2020/02/m42-1024x643.jpg');
    expect(orion!.coverMediaId).toBeNull();
  });

  it('can skip media entirely with importMedia=false', async () => {
    const fetcher = new FakeFetcher(png);
    const result = await build(fetcher).run(DUMP, { importMedia: false });
    expect(fetcher.requested).toHaveLength(0);
    expect(result.media).toBe(0);
    const orion = new PostRepository(db).findByCanonicalPath('/@sasa/posts/orion-nebula');
    expect(orion!.markdownBody).toContain('https://astro.beer/wp-content/uploads');
  });

  it('does not create duplicate users when re-run against the same database', async () => {
    await build(new FakeFetcher(png)).run(DUMP);
    const before = new UserRepository(db).findByEmail('sasa@astro.beer')!.id;
    const second = await build(new FakeFetcher(png)).run(DUMP);
    expect(second.users).toBe(0); // both users already existed
    const after = new UserRepository(db).findByEmail('sasa@astro.beer')!.id;
    expect(after).toBe(before);
  });
});
