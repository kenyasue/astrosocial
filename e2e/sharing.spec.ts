import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M8: reposts (+ timeline label), quote posts (embed), bookmarks,
 * and notifications.
 */

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

async function publish(page: Page, title: string): Promise<string> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('sharing body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  return page.url();
}

test('repost shows the post in followers timeline labeled as a repost', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  const title = `Repostable ${randomBytes(2).toString('hex')}`;
  const url = await publish(page, title);

  const reposter = unique();
  await login(page, reposter.email);
  await page.goto(`/@${author.username}`);
  await page.getByTestId('follow-button').click(); // follow author so timeline isn't needed... but reposter reposts
  await page.goto(url);
  await page.getByTestId('repost-button').click();
  await expect(page.getByTestId('repost-count')).toHaveText('1');

  // A third user follows the reposter → sees the repost in their timeline.
  const follower = unique();
  await login(page, follower.email);
  await page.goto(`/@${reposter.username}`);
  await page.getByTestId('follow-button').click();
  await page.goto('/timeline');
  const item = page.getByTestId('timeline-item').filter({ hasText: title });
  await expect(item).toHaveCount(1);
  await expect(item.getByTestId('repost-label')).toContainText(/reposted/);
});

test('quote post embeds the original', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  const title = `Quotable ${randomBytes(2).toString('hex')}`;
  const url = await publish(page, title);

  const quoter = unique();
  await login(page, quoter.email);
  await page.goto(url);
  await page.getByTestId('quote-link').click();
  await page.waitForURL(/\/compose\?quote=/);
  await expect(page.getByTestId('compose-quoted')).toContainText(title);

  await page.getByLabel('Body (Markdown)').fill('my commentary');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  await expect(page.getByTestId('quoted-embed')).toContainText(title);
});

test('bookmark a post and see it on the bookmarks page', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  const title = `Bookmarkable ${randomBytes(2).toString('hex')}`;
  const url = await publish(page, title);

  const reader = unique();
  await login(page, reader.email);
  await page.goto(url);
  await page.getByTestId('bookmark-button').click();
  await expect(page.getByTestId('bookmark-button')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/bookmarks');
  await expect(page.getByTestId('post-card').filter({ hasText: title })).toHaveCount(1);
});

test('interacting with a post notifies its author', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  const url = await publish(page, `Notify ${randomBytes(2).toString('hex')}`);

  // Another user likes the post.
  const fan = unique();
  await login(page, fan.email);
  await page.goto(url);
  await page.getByTestId('like-button').click();
  await expect(page.getByTestId('like-count')).toHaveText('1');

  // The author sees a notification and can mark all read.
  await login(page, author.email);
  await page.goto('/notifications');
  await expect(page.getByTestId('notification')).toHaveCount(1);
  await expect(page.getByTestId('notification')).toContainText(/liked your post/);
  await page.getByTestId('mark-all-read').click();
  await expect(page.locator('[data-testid="notification"].unread')).toHaveCount(0);
});
