import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** E2E coverage for P2.5 — bookmarks filter, unbookmark, and empty state. */

const PIN = '000000';

function unique(): { email: string; username: string } {
  const u = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${u}@example.com`, username: u };
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

async function publishAndBookmark(page: Page, title: string): Promise<void> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  await page.getByTestId('bookmark-button').click();
  await expect(page.getByTestId('bookmark-button')).toHaveAttribute('aria-pressed', 'true');
}

test('empty state shows when there are no bookmarks', async ({ page }) => {
  await login(page, unique().email);
  await page.goto('/bookmarks');
  await expect(page.getByTestId('bookmarks-empty')).toBeVisible();
});

test('filter narrows the list and unbookmark removes an item', async ({ page }) => {
  await login(page, unique().email);
  const tag = randomBytes(3).toString('hex');
  await publishAndBookmark(page, `Alpha ${tag}`);
  await publishAndBookmark(page, `Beta ${tag}`);

  await page.goto('/bookmarks');
  await expect(page.getByTestId('bookmark-item')).toHaveCount(2);

  // Filter to just "Alpha".
  await page.getByTestId('bookmark-filter').fill('alpha');
  await expect(page.getByTestId('bookmark-item').filter({ hasText: 'Alpha' })).toBeVisible();
  await expect(page.getByTestId('bookmark-item').filter({ hasText: 'Beta' })).toBeHidden();

  // Clear filter, then unbookmark Alpha → it disappears and stays gone after reload.
  await page.getByTestId('bookmark-filter').fill('');
  await page
    .getByTestId('bookmark-item')
    .filter({ hasText: 'Alpha' })
    .getByTestId('unbookmark')
    .click();
  await expect(page.getByTestId('bookmark-item')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('bookmark-item')).toHaveCount(1);
});
