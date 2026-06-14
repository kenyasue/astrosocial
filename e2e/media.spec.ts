import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E coverage for M3 (media & cover images): upload a cover, see it on the post
 * and in the library, serve the bytes, reject bad types, delete media, and hide
 * owner controls from non-owners.
 */

const PIN = '000000';

function uniqueEmail(): { email: string; username: string } {
  const username = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${username}@example.com`, username };
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 24, height: 16, channels: 3, background: '#e8552d' } })
    .png()
    .toBuffer();
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);
}

async function composeWithCover(page: Page, title: string): Promise<string> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('post body');
  await page.getByTestId('cover-file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: await pngBuffer(),
  });
  await expect(page.getByTestId('cover-preview')).toBeVisible();
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  return page.url();
}

test('upload a cover image; it shows on the post and serves correctly', async ({ page }) => {
  await login(page, uniqueEmail().email);
  await composeWithCover(page, 'Post With Cover');

  const cover = page.getByTestId('post-cover');
  await expect(cover).toBeVisible();
  const loaded = await cover.evaluate(
    (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0
  );
  expect(loaded).toBe(true);
});

test('uploaded media appears in the library and has a detail page', async ({ page }) => {
  await login(page, uniqueEmail().email);
  await composeWithCover(page, 'Library Post');

  await page.goto('/library');
  await expect(page.getByTestId('media-grid')).toBeVisible();
  await expect(page.getByTestId('media-item')).toHaveCount(1);

  await page.getByTestId('media-item').click();
  await page.waitForURL(/\/media\//);
  await expect(page.getByTestId('media-image')).toBeVisible();
});

test('rejects a non-image upload with an error', async ({ page }) => {
  await login(page, uniqueEmail().email);
  await page.goto('/compose');
  await page.getByTestId('cover-file').setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByTestId('error')).toContainText(/unsupported/i);
  await expect(page.getByTestId('cover-preview')).toBeHidden();
});

test('owner can delete media from its detail page', async ({ page }) => {
  await login(page, uniqueEmail().email);
  await composeWithCover(page, 'Deletable Media');

  await page.goto('/library');
  await page.getByTestId('media-item').click();
  await page.waitForURL(/\/media\//);
  await page.getByTestId('delete-media').click();
  await page.waitForURL('/library');
  await expect(page.getByTestId('empty')).toBeVisible();
});

test('non-owners can view public media but see no owner controls', async ({ page }) => {
  await login(page, uniqueEmail().email);
  await composeWithCover(page, 'Shared Media');
  await page.goto('/library');
  const href = await page.getByTestId('media-item').getAttribute('href');
  expect(href).toBeTruthy();

  await login(page, uniqueEmail().email); // switch user
  await page.goto(href!);
  await expect(page.getByTestId('media-image')).toBeVisible();
  await expect(page.getByTestId('media-owner-controls')).toHaveCount(0);
});
