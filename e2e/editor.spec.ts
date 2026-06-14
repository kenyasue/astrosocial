import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E coverage for M5 (editor & media library): formatting toolbar, live preview,
 * media insertion (inline upload), and auto-save.
 */

const PIN = '000000';

function uniqueEmail(): string {
  return `e2e${randomBytes(4).toString('hex')}@example.com`;
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 14, channels: 3, background: '#22aa88' } })
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

test('formatting toolbar wraps the selection (bold)', async ({ page }) => {
  await login(page, uniqueEmail());
  await page.goto('/compose');
  const body = page.getByLabel('Body (Markdown)');
  await body.fill('hello');
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 5);
  });
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue('**hello**');
});

test('preview tab renders sanitized HTML', async ({ page }) => {
  await login(page, uniqueEmail());
  await page.goto('/compose');
  await page.getByLabel('Body (Markdown)').fill('# Heading\n\n**bold**');
  await page.getByTestId('tab-preview').click();
  const preview = page.getByTestId('preview');
  await expect(preview.locator('h1')).toHaveText('Heading');
  await expect(preview.locator('strong')).toHaveText('bold');
});

test('session upload inserts an image and lists it in the session strip', async ({ page }) => {
  await login(page, uniqueEmail());
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Inline Image Post');

  // "Add photos" reveals the hidden multi-file input; uploading inserts the
  // image markdown and adds a clickable thumbnail to the session strip.
  await page.getByTestId('session-file').setInputFiles({
    name: 'inline.png',
    mimeType: 'image/png',
    buffer: await pngBuffer(),
  });
  await expect(page.getByLabel('Body (Markdown)')).toHaveValue(/!\[\]\(\/media\/m_[0-9a-f]+\/original\)/);
  await expect(page.getByTestId('session-media')).toBeVisible();
  await expect(page.getByTestId('session-media').locator('.session-thumb')).toHaveCount(1);

  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  await expect(page.getByTestId('post-content').locator('img')).toHaveCount(1);
});

test('uploading multiple photos in one go adds multiple session thumbnails', async ({ page }) => {
  await login(page, uniqueEmail());
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Multi Upload Post');

  await page.getByTestId('session-file').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: await pngBuffer() },
    { name: 'b.png', mimeType: 'image/png', buffer: await pngBuffer() },
  ]);
  await expect(page.getByTestId('session-media').locator('.session-thumb')).toHaveCount(2);

  // Clicking a session thumbnail re-inserts its markdown at the caret.
  const body = page.getByLabel('Body (Markdown)');
  const before = await body.inputValue();
  await page.getByTestId('session-media').locator('.session-thumb').first().click();
  await expect(body).not.toHaveValue(before);
});

test('auto-save persists a draft without an explicit save', async ({ page }) => {
  await login(page, uniqueEmail());
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Autosaved');
  await page.getByLabel('Body (Markdown)').fill('autosaved content');

  await expect(page.getByTestId('autosave-status')).toHaveText('Saved');
  await expect(page).toHaveURL(/\/compose\?id=/);

  await page.reload();
  await expect(page.getByLabel('Body (Markdown)')).toHaveValue('autosaved content');
});
