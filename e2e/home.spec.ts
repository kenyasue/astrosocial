import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M4 (home grid & discovery): published posts appear on the
 * public home page as cards (with reading time), drafts are excluded, the card
 * links to the post, and the profile shows the author's published posts.
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

async function publish(page: Page, title: string, body = 'home feed body'): Promise<void> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill(body);
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
}

test('published posts appear on the public home page with reading time', async ({ page, browser }) => {
  const { email } = unique();
  const title = `Home Post ${randomBytes(3).toString('hex')}`;
  await login(page, email);
  await publish(page, title);

  // Visible to an anonymous visitor.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto('/');
  await expect(anonPage.getByTestId('feed')).toBeVisible();
  const card = anonPage.getByTestId('post-card').filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(/min read/);

  // Card links to the post.
  await card.click();
  await expect(anonPage.getByTestId('post-title')).toHaveText(title);
  await anon.close();
});

test('drafts do not appear on the home feed', async ({ page }) => {
  const { email } = unique();
  const draftTitle = `Draft ${randomBytes(3).toString('hex')}`;
  await login(page, email);

  await page.goto('/compose');
  await page.getByLabel('Title').fill(draftTitle);
  await page.getByLabel('Body (Markdown)').fill('secret draft');
  await page.getByTestId('save-draft').click();
  await page.waitForURL(/\/posts\//);

  await page.goto('/');
  await expect(page.getByTestId('post-card').filter({ hasText: draftTitle })).toHaveCount(0);
});

test('profile shows the author published posts as a grid', async ({ page }) => {
  const { email, username } = unique();
  const title = `Profile Post ${randomBytes(3).toString('hex')}`;
  await login(page, email);
  await publish(page, title);

  await page.goto(`/@${username}`);
  await expect(page.getByTestId('profile-posts')).toBeVisible();
  await expect(page.getByTestId('post-card').filter({ hasText: title })).toHaveCount(1);
});
