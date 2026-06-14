import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/** E2E coverage for the Users directory (the repurposed Explore page). */

const PIN = '000000';

function unique(): { email: string; username: string } {
  const u = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${u}@example.com`, username: u };
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 24, height: 16, channels: 3, background: '#3b82f6' } })
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

test('Explore lists users with avatar, username, and their last image', async ({ page }) => {
  const u = unique();
  await login(page, u.email);

  // Publish a post with a cover image so the user has a "last image".
  await page.goto('/compose');
  await page.getByLabel('Title').fill(`Explorer ${u.username}`);
  await page.getByLabel('Body (Markdown)').fill('explore body');
  await page.getByTestId('cover-file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: await pngBuffer(),
  });
  await expect(page.getByTestId('cover-preview')).toBeVisible();
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await page.goto('/explore');
  await expect(page.getByTestId('users-grid')).toBeVisible();

  // The current user's card shows their @username and links to their profile.
  const card = page
    .getByTestId('user-card')
    .filter({ hasText: `@${u.username}` })
    .first();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('href', `/@${u.username}`);

  // The card shows the user's last image as its cover, and it actually loads.
  const cover = card.locator('.cover img');
  await expect(cover).toBeVisible();
  const loaded = await cover.evaluate(
    (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0
  );
  expect(loaded).toBe(true);

  // Clicking the card opens the profile.
  await card.click();
  await page.waitForURL(`/@${u.username}`);
});

test('a user without images still appears with a placeholder cover', async ({ page }) => {
  const u = unique();
  await login(page, u.email);

  await page.goto('/explore');
  const card = page
    .getByTestId('user-card')
    .filter({ hasText: `@${u.username}` })
    .first();
  await expect(card).toBeVisible();
  // No image uploaded → placeholder cover (no <img> inside .cover).
  await expect(card.locator('.cover.no-cover')).toBeVisible();
});

test('the Users nav item points at /explore; /trends still redirects there', async ({ page }) => {
  await login(page, unique().email);
  await page.goto('/');
  await page.getByTestId('nav-users').click();
  await page.waitForURL(/\/explore/);
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  await page.goto('/trends');
  await page.waitForURL(/\/explore/);
});
