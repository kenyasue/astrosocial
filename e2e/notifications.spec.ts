import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** E2E coverage for P2.3 — notifications tabs, per-item read, and the nav unread badge. */

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

test('a like creates a notification, shows a nav badge, and opening it marks read', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  await page.goto('/compose');
  await page.getByLabel('Title').fill(`Notif ${randomBytes(2).toString('hex')}`);
  await page.getByLabel('Body (Markdown)').fill('body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  const postUrl = page.url();

  // Another user likes the post.
  const fan = unique();
  await login(page, fan.email);
  await page.goto(postUrl);
  await page.getByTestId('like-button').click();
  await expect(page.getByTestId('like-count')).toHaveText('1');

  // The author sees an unread badge in the nav.
  await login(page, author.email);
  await page.goto('/');
  await expect(page.getByTestId('nav-notif-badge')).toBeVisible();

  // Open notifications; click the item → navigates to the post and marks it read.
  await page.goto('/notifications');
  await expect(page.getByTestId('notification')).toHaveCount(1);
  await page.getByTestId('notification').getByRole('link').click();
  await expect(page.getByTestId('post-title')).toBeVisible();

  // Badge cleared.
  await page.goto('/');
  await expect(page.getByTestId('nav-notif-badge')).toHaveCount(0);
});

test('Mentions tab filters to comment notifications', async ({ page }) => {
  const author = unique();
  await login(page, author.email);
  await page.goto('/compose');
  await page.getByLabel('Title').fill(`Mention ${randomBytes(2).toString('hex')}`);
  await page.getByLabel('Body (Markdown)').fill('body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  const postUrl = page.url();

  // A commenter (generates a comment notification) and a liker (a like notification).
  const other = unique();
  await login(page, other.email);
  await page.goto(postUrl);
  await page.getByTestId('like-button').click();
  await page.getByTestId('comment-input').fill('nice');
  await page.getByTestId('comment-submit').click();

  await login(page, author.email);
  await page.goto('/notifications?tab=all');
  await expect(page.getByTestId('notification')).toHaveCount(2);
  await page.goto('/notifications?tab=mentions');
  await expect(page.getByTestId('notification')).toHaveCount(1);
  await expect(page.getByTestId('notification')).toContainText(/commented/);
});
