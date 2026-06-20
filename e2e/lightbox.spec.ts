import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E coverage for the immersive lightbox redesign:
 * - an author/title caption overlay inside the viewer
 * - overlay chrome that auto-fades after the pointer is idle and returns on
 *   movement
 * - mobile touch: tap-to-zoom and one-finger pan of the zoomed image
 */

const PIN = '000000';

function uniqueEmail(): string {
  return `e2e${randomBytes(4).toString('hex')}@example.com`;
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: '#6d28d9' } })
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

/** Compose + publish a post with a cover image; returns the post URL. */
async function composeWithCover(page: Page, title = 'Immersive lightbox post'): Promise<string> {
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

test('the lightbox shows an author + title caption overlay', async ({ page }) => {
  await login(page, uniqueEmail());
  await composeWithCover(page, 'Caption test post');

  await page.getByTestId('post-cover').click();
  await expect(page.getByTestId('lightbox')).toBeVisible();

  const chrome = page.getByTestId('lightbox-chrome');
  await expect(chrome).toBeVisible();
  await expect(page.getByTestId('lightbox-caption')).toHaveText('Caption test post');
  await expect(page.getByTestId('lightbox-author')).toBeVisible();
  // The caption links to the author profile.
  await expect(page.getByTestId('lightbox-meta')).toHaveAttribute('href', /^\/@/);
});

test('overlay chrome fades after the pointer is idle and returns on movement', async ({ page }) => {
  await login(page, uniqueEmail());
  await composeWithCover(page);

  const lightbox = page.getByTestId('lightbox');
  await page.getByTestId('post-cover').click();
  await expect(lightbox).toBeVisible();

  // Visible immediately after opening.
  await expect(lightbox).not.toHaveClass(/is-idle/);

  // Fades to the idle state after the 2s idle window with no pointer movement.
  await expect(lightbox).toHaveClass(/is-idle/, { timeout: 4000 });

  // Any pointer movement brings the overlay back.
  const box = (await page.getByTestId('lightbox-img').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(lightbox).not.toHaveClass(/is-idle/);
});

test.describe('touch gestures', () => {
  test.use({ hasTouch: true });

  test('tap zooms the image in, and again resets it', async ({ page }) => {
    await login(page, uniqueEmail());
    await composeWithCover(page);

    const img = page.getByTestId('lightbox-img');
    await page.getByTestId('post-cover').click();
    await expect(page.getByTestId('lightbox')).toBeVisible();

    const box = (await img.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Default is the cover fit (scale 1, fills the screen with no black margins).
    await expect(img).toHaveAttribute('style', /scale\(1\)/);

    // Tap to zoom in past the cover fit.
    await page.touchscreen.tap(cx, cy);
    await expect(img).toHaveAttribute('style', /scale\((?!1\))/);

    // Tap again to reset back to the cover fit.
    await page.touchscreen.tap(cx, cy);
    await expect(img).toHaveAttribute('style', /scale\(1\)/);
  });
});
