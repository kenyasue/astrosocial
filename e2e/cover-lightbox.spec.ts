import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E coverage for the post cover-photo lightbox + magnifier tool: open the
 * cover full-size, magnifier active by default (zoom-in cursor), click to zoom
 * in, Shift+click to zoom out, Space switches to the pan (grab) cursor.
 */

const PIN = '000000';

function uniqueEmail(): string {
  return `e2e${randomBytes(4).toString('hex')}@example.com`;
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 48, height: 32, channels: 3, background: '#6d28d9' } })
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
async function composeWithCover(page: Page): Promise<string> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Cover lightbox post');
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

test('clicking the cover opens the lightbox with the magnifier active by default', async ({ page }) => {
  await login(page, uniqueEmail());
  await composeWithCover(page);

  const lightbox = page.getByTestId('lightbox');
  const img = page.getByTestId('lightbox-img');
  await expect(lightbox).toBeHidden();

  // Open via the cover photo.
  await page.getByTestId('post-cover').click();
  await expect(lightbox).toBeVisible();
  await expect(img).toHaveAttribute('src', /\/media\/m_[0-9a-f]+\/original/);

  // Magnifier is the default tool → zoom-in cursor.
  await expect(img).toHaveCSS('cursor', 'zoom-in');

  // Click zooms in (centered → translate stays 0, scale grows).
  await img.click();
  await expect(img).toHaveAttribute('style', /scale\((?:1\.6|1\.[6-9]|[2-9])/);

  // Shift+click zooms back out toward 1×.
  await img.click({ modifiers: ['Shift'] });
  await expect(img).toHaveAttribute('style', /scale\(1\)/);

  // Escape closes.
  await page.keyboard.press('Escape');
  await expect(lightbox).toBeHidden();
});

test('cursor reflects the active tool (shift = zoom-out, space = grab)', async ({ page }) => {
  await login(page, uniqueEmail());
  await composeWithCover(page);

  const img = page.getByTestId('lightbox-img');
  await page.getByTestId('post-cover').click();
  await expect(img).toHaveCSS('cursor', 'zoom-in');

  // Holding Shift shows the zoom-out cursor.
  await page.keyboard.down('Shift');
  await expect(img).toHaveCSS('cursor', 'zoom-out');
  await page.keyboard.up('Shift');
  await expect(img).toHaveCSS('cursor', 'zoom-in');

  // Holding Space switches to the pan (grab) cursor.
  await page.keyboard.down('Space');
  await expect(img).toHaveCSS('cursor', 'grab');
  await page.keyboard.up('Space');
  await expect(img).toHaveCSS('cursor', 'zoom-in');
});

test('Space+drag pans the zoomed image', async ({ page }) => {
  await login(page, uniqueEmail());
  await composeWithCover(page);

  const img = page.getByTestId('lightbox-img');
  await page.getByTestId('post-cover').click();

  // Zoom in first so there is room to pan.
  await img.click();
  await img.click();

  const box = (await img.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Space + drag like the hand tool.
  await page.keyboard.down('Space');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy - 40, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');

  // The image was translated (non-zero translate in the transform).
  await expect(img).toHaveAttribute('style', /translate\((?!0px,\s*0px)/);
});
