import { test, expect } from '@playwright/test';
import path from 'node:path';
import sharp from 'sharp';
import { E2E_DB_PATH, E2E_UPLOADS_DIR, E2E_SCREENSHOT_DIR } from './config';
import { openDatabase } from '../src/lib/db/connection';
import { runMigrations } from '../src/lib/db/migrate';
import { LocalStorageProvider } from '../src/lib/storage/localStorageProvider';
import { TagRepository } from '../src/lib/db/repositories/TagRepository';
import { UserRepository } from '../src/lib/db/repositories/UserRepository';
import { PostRepository } from '../src/lib/db/repositories/PostRepository';
import { ImportRepository } from '../src/lib/import/wordpress/ImportRepository';
import { WordPressImporter } from '../src/lib/import/wordpress/WordPressImporter';
import type { ImageFetcher } from '../src/lib/import/wordpress/mediaFetcher';

/**
 * E2E coverage for the WordPress import: import a small fixture dump into the
 * E2E database (with a fake image fetcher), then load the imported post page and
 * confirm the body image and cover render and are served by AstroSocial.
 */

const FIXTURE = `
INSERT INTO \`wp_users\` (\`ID\`, \`user_login\`, \`user_nicename\`, \`user_email\`, \`user_url\`, \`user_registered\`, \`display_name\`) VALUES
(91, 'wpauthor', 'wpauthor', 'wpauthor@astro.beer', '', '2021-01-01 00:00:00', 'WP Author');

INSERT INTO \`wp_posts\` (\`ID\`, \`post_author\`, \`post_date\`, \`post_content\`, \`post_title\`, \`post_excerpt\`, \`post_status\`, \`post_name\`, \`post_modified\`, \`guid\`, \`post_type\`, \`post_mime_type\`) VALUES
(196, 91, '2021-02-10 10:00:00', '', 'Cover full', '', 'inherit', 'cover', '2021-02-10 10:00:00', 'http://astro.beer/wp-content/uploads/2021/02/cover.jpg', 'attachment', 'image/jpeg'),
(700, 91, '2021-02-11 12:00:00', '<!-- wp:image --><figure class=\\"wp-block-image\\"><img src=\\"http://astro.beer/wp-content/uploads/2021/02/orion-1024x643.jpg\\" alt=\\"Orion\\"/></figure><!-- /wp:image --><!-- wp:paragraph --><p>An imported nebula.</p><!-- /wp:paragraph -->', 'Imported Nebula', '', 'publish', 'imported-nebula', '2021-02-11 12:00:00', 'http://astro.beer/?p=700', 'post', '');

INSERT INTO \`wp_postmeta\` (\`meta_id\`, \`post_id\`, \`meta_key\`, \`meta_value\`) VALUES
(1, 700, '_thumbnail_id', '196');

INSERT INTO \`wp_terms\` (\`term_id\`, \`name\`, \`slug\`, \`term_group\`) VALUES (5, 'Nebula', 'nebula', 0);
INSERT INTO \`wp_term_taxonomy\` (\`term_taxonomy_id\`, \`term_id\`, \`taxonomy\`, \`description\`, \`parent\`, \`count\`) VALUES (5, 5, 'post_tag', '', 0, 1);
INSERT INTO \`wp_term_relationships\` (\`object_id\`, \`term_taxonomy_id\`, \`term_order\`) VALUES (700, 5, 0);
`;

class FakeFetcher implements ImageFetcher {
  constructor(private readonly png: Buffer) {}
  async fetch() {
    return { buffer: this.png, mimeType: 'image/png' };
  }
}

/** Canonical path of the post imported in `beforeAll` (captured from the DB). */
let importedPostPath: string;

test.beforeAll(async () => {
  const png = await sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 10, g: 20, b: 90 } },
  })
    .png()
    .toBuffer();

  const db = openDatabase(E2E_DB_PATH);
  runMigrations(db, path.join(process.cwd(), 'migrations'));
  const importer = new WordPressImporter(
    new ImportRepository(db),
    new TagRepository(db),
    new UserRepository(db),
    new PostRepository(db),
    new LocalStorageProvider(E2E_UPLOADS_DIR),
    new FakeFetcher(png)
  );
  const result = await importer.run(FIXTURE, { sourceName: 'e2e-fixture' });
  expect(result.posts).toBe(1);
  expect(result.media).toBe(2);

  // Capture the exact post created by THIS import (the most recently inserted
  // post for the author) so the test is robust even if a stale DB from a prior
  // run left earlier copies behind — the latest post references this run's media.
  const row = db
    .prepare(
      `SELECT p.canonical_path AS path FROM posts p JOIN users u ON u.id = p.user_id
       WHERE u.username = 'wpauthor' ORDER BY p.rowid DESC LIMIT 1`
    )
    .get() as { path: string } | undefined;
  importedPostPath = row!.path;
  db.close();
});

test('an imported WordPress post renders with its body image and cover', async ({ page }) => {
  await page.goto(importedPostPath);

  await expect(page.getByTestId('post-title')).toHaveText('Imported Nebula');
  await expect(page.getByTestId('post-content')).toContainText('An imported nebula.');

  // Cover image (from the WordPress featured image) is served locally.
  const cover = page.getByTestId('post-cover');
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('src', /^\/media\/m_/);

  // The in-body image was rewritten to a local AstroSocial media URL …
  const bodyImg = page.getByTestId('post-content').locator('img');
  await expect(bodyImg).toHaveAttribute('src', /^\/media\/m_.*\/original$/);

  // … and the bytes are actually served (HTTP 200, image content-type).
  const src = await bodyImg.getAttribute('src');
  const resp = await page.request.get(src!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toContain('image/');

  await page.screenshot({
    path: path.join(E2E_SCREENSHOT_DIR, 'wordpress-import-post.png'),
    fullPage: true,
  });
});
