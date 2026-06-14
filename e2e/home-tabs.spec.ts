import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** E2E coverage for P2.6 — Home "For you / Following" tabs. */

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

test('logged-out home has no Following tab', async ({ browser }) => {
  const anon = await browser.newContext();
  const page = await anon.newPage();
  await page.goto('/');
  await expect(page.getByTestId('tab-following')).toHaveCount(0);
  await anon.close();
});

test('Following tab shows posts from followed users', async ({ page }) => {
  // Author publishes.
  const author = unique();
  await login(page, author.email);
  const title = `Followed ${randomBytes(2).toString('hex')}`;
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  // Follower follows the author.
  const follower = unique();
  await login(page, follower.email);
  await page.goto(`/@${author.username}`);
  await page.getByTestId('follow-button').click();

  // Home → Following tab shows the author's post.
  await page.goto('/');
  await expect(page.getByTestId('tab-foryou')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('tab-following').click();
  await page.waitForURL(/tab=following/);
  await expect(page.getByTestId('tab-following')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('post-card').filter({ hasText: title })).toHaveCount(1);
});
