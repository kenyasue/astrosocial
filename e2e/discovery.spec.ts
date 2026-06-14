import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M10 (search, tags, trends).
 */

const PIN = '000000';

function unique(): { email: string; username: string; tag: string } {
  const tag = randomBytes(4).toString('hex');
  return { email: `e2e${tag}@example.com`, username: `e2e${tag}`, tag };
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

test('full-text search finds a post by content and a user by name', async ({ page }) => {
  const u = unique();
  await login(page, u.email);
  const token = `srch${u.tag}`;
  await page.goto('/compose');
  await page.getByLabel('Title').fill(`Searchable ${token}`);
  await page.getByLabel('Body (Markdown)').fill(`a body containing ${token} keyword`);
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await page.goto(`/search?q=${token}`);
  await expect(page.getByTestId('search-posts').getByTestId('post-card')).toHaveCount(1);

  await page.goto(`/search?q=${u.username}&tab=people`);
  await expect(page.getByTestId('search-users')).toContainText(u.username);
});

test('tag page lists posts carrying that tag', async ({ page }) => {
  const u = unique();
  await login(page, u.email);
  const tag = `topic${u.tag}`; // already lowercase-safe → slug equals tag
  const title = `Tagged ${u.tag}`;
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('tagged body');
  await page.getByTestId('tags-input').fill(`${tag}, misc`);
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  // The post detail shows the tag.
  await expect(page.getByTestId('post-tags')).toContainText(tag);

  await page.goto(`/tags/${tag}`);
  await expect(page.getByTestId('tag-posts').getByTestId('post-card').filter({ hasText: title })).toHaveCount(1);
});

test('/trends redirects to Explore which lists users', async ({ page }) => {
  const u = unique();
  await login(page, u.email);

  await page.goto('/trends');
  await page.waitForURL(/\/explore/);
  // Explore is now the Users directory; the logged-in user appears in the grid.
  await expect(page.getByTestId('users-grid')).toBeVisible();
  await expect(
    page.getByTestId('user-card').filter({ hasText: `@${u.username}` }).first()
  ).toBeVisible();
});
