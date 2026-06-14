import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M7 (social core): likes, emoji reactions, comments (+ delete),
 * follow/unfollow, and the following timeline.
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
  await page.getByLabel('Body (Markdown)').fill('social test body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  return page.url();
}

test('like toggles and the count updates', async ({ page }) => {
  await login(page, unique().email);
  const url = await publish(page, `Likeable ${randomBytes(2).toString('hex')}`);
  await page.goto(url);

  const like = page.getByTestId('like-button');
  await expect(page.getByTestId('like-count')).toHaveText('0');
  await like.click();
  await expect(page.getByTestId('like-count')).toHaveText('1');
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await like.click();
  await expect(page.getByTestId('like-count')).toHaveText('0');
});

test('emoji reaction toggles and counts', async ({ page }) => {
  await login(page, unique().email);
  const url = await publish(page, `Reactable ${randomBytes(2).toString('hex')}`);
  await page.goto(url);

  const fire = page.locator('.reaction[data-emoji="🔥"]');
  await fire.click();
  await expect(fire.locator('.rc')).toHaveText('1');
  await expect(fire).toHaveAttribute('data-reacted', 'true');
});

test('comments can be added and deleted by the author', async ({ page }) => {
  await login(page, unique().email);
  const url = await publish(page, `Commentable ${randomBytes(2).toString('hex')}`);
  await page.goto(url);

  await page.getByTestId('comment-input').fill('first comment');
  await page.getByTestId('comment-submit').click();
  await expect(page.getByTestId('comment')).toHaveCount(1);
  await expect(page.getByTestId('comment-body')).toHaveText('first comment');
  await expect(page.getByTestId('comment-count')).toHaveText('1');

  await page.getByTestId('comment-delete').click();
  await expect(page.getByTestId('comment')).toHaveCount(0);
});

test('follow then see the author posts in the timeline', async ({ page }) => {
  // Author publishes a post.
  const author = unique();
  await login(page, author.email);
  const title = `Followed ${randomBytes(2).toString('hex')}`;
  await publish(page, title);

  // A second user follows the author and sees the post in their timeline.
  const follower = unique();
  await login(page, follower.email);
  await page.goto(`/@${author.username}`);
  const followBtn = page.getByTestId('follow-button');
  await expect(followBtn).toHaveText('Follow');
  await followBtn.click();
  await expect(followBtn).toHaveText('Following');

  await page.goto('/timeline');
  await expect(page.getByTestId('timeline')).toBeVisible();
  await expect(page.getByTestId('post-card').filter({ hasText: title })).toHaveCount(1);

  // Unfollow → timeline empties of that author's post.
  await page.goto(`/@${author.username}`);
  await page.getByTestId('follow-button').click();
  await expect(page.getByTestId('follow-button')).toHaveText('Follow');
  await page.goto('/timeline');
  await expect(page.getByTestId('post-card').filter({ hasText: title })).toHaveCount(0);
});

test('anonymous visitors cannot like (button disabled)', async ({ page, browser }) => {
  await login(page, unique().email);
  const url = await publish(page, `Anon ${randomBytes(2).toString('hex')}`);

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(url);
  await expect(anonPage.getByTestId('like-button')).toBeDisabled();
  await anon.close();
});
