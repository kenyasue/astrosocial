import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** E2E coverage for P2.2 — search tabs (Top/Latest/People/Tags) + states. */

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

test('search tabs return the right results and empty states', async ({ page }) => {
  const u = unique();
  const token = `srch${randomBytes(3).toString('hex')}`;
  await login(page, u.email);

  await page.goto('/compose');
  await page.getByLabel('Title').fill(`Findable ${token}`);
  await page.getByLabel('Body (Markdown)').fill(`a body with ${token}`);
  await page.getByTestId('tags-input').fill(token);
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  // Top tab → finds the post.
  await page.goto(`/search?q=${token}`);
  await expect(page.getByTestId('tab-top')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('search-posts').getByTestId('post-card')).toHaveCount(1);

  // Latest tab → also the post.
  await page.goto(`/search?q=${token}&tab=latest`);
  await expect(page.getByTestId('search-posts').getByTestId('post-card')).toHaveCount(1);

  // People tab → finds the author by username.
  await page.goto(`/search?q=${u.username}&tab=people`);
  await expect(page.getByTestId('search-users')).toContainText(u.username);

  // Tags tab → finds the tag.
  await page.goto(`/search?q=${token}&tab=tags`);
  await expect(page.getByTestId('search-tags')).toContainText(token);

  // Empty state for a nonsense query.
  await page.goto('/search?q=zzznotapostxyz&tab=top');
  await expect(page.getByTestId('search-empty')).toBeVisible();
});

test('no-query search shows suggestions', async ({ page }) => {
  await login(page, unique().email);
  await page.goto('/search');
  await expect(page.getByTestId('search-suggestions')).toBeVisible();
});
