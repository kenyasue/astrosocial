import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E for per-image deep links in the post lightbox: each image has a unique
 * `#image-<id>` URL, the lightbox shows the absolute URL with a Copy link button,
 * closing (X) returns to the post, and loading the deep link auto-opens the image.
 */

const PIN = '000000';

function uniqueEmail(): string {
  return `e2e${randomBytes(4).toString('hex')}@example.com`;
}

async function pngBuffer(color: string): Promise<Buffer> {
  return sharp({ create: { width: 24, height: 18, channels: 3, background: color } })
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

/** Upload two distinct images in the composer and publish; returns the post URL. */
async function publishTwoImagePost(page: Page): Promise<string> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Deep link gallery');
  await page.getByLabel('Body (Markdown)').fill('Two photos:');
  await page.getByTestId('session-file').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: await pngBuffer('#cc3344') },
    { name: 'b.png', mimeType: 'image/png', buffer: await pngBuffer('#3344cc') },
  ]);
  // Both images inserted as /media/<id>/original snippets.
  await expect(page.getByLabel('Body (Markdown)')).toHaveValue(
    /!\[\]\(\/media\/m_[0-9a-f]+\/original\)[\s\S]*!\[\]\(\/media\/m_[0-9a-f]+\/original\)/
  );
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  return page.url();
}

test('opening an image deep-links the URL and shows a copyable absolute link', async ({ page }) => {
  await login(page, uniqueEmail());
  const postUrl = await publishTwoImagePost(page);

  const lightbox = page.getByTestId('lightbox');
  await expect(lightbox).toBeHidden();

  // Click the first in-content image → lightbox opens and the URL gets a fragment.
  await page.locator('[data-testid="post-content"] img').first().click();
  await expect(lightbox).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#image-m_[0-9a-f]+$/);

  // The share field holds the absolute URL ending with that same fragment.
  const hash = new URL(page.url()).hash;
  await expect(page.getByTestId('lightbox-url')).toHaveValue(
    new RegExp('^https?://.*' + hash.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$')
  );

  // Copy link confirms.
  await page.getByTestId('lightbox-copy').click();
  await expect(page.getByTestId('lightbox-copy')).toHaveText('Copied!');

  // Next image gives a different fragment (unique per image).
  await page.getByTestId('lightbox-next').click();
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#image-m_[0-9a-f]+$/);
  expect(new URL(page.url()).hash).not.toBe(hash);

  // X closes the lightbox and returns to the bare post URL (no fragment).
  await page.getByTestId('lightbox-close').click();
  await expect(lightbox).toBeHidden();
  await expect.poll(() => page.url()).toBe(postUrl);
});

test('loading an image deep link auto-opens the lightbox on that image', async ({ page }) => {
  await login(page, uniqueEmail());
  const postUrl = await publishTwoImagePost(page);

  // Capture the second image's deep link by opening it, then reload it fresh.
  await page.locator('[data-testid="post-content"] img').first().click();
  await page.getByTestId('lightbox-next').click();
  const deepLink = page.url();
  expect(deepLink).toMatch(/#image-m_[0-9a-f]+$/);

  await page.goto(postUrl); // reset
  await expect(page.getByTestId('lightbox')).toBeHidden();

  await page.goto(deepLink); // deep link → auto-open
  await expect(page.getByTestId('lightbox')).toBeVisible();
  await expect(page.getByTestId('lightbox-url')).toHaveValue(new RegExp(deepLink.split('#')[1] + '$'));
});
