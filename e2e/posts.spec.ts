import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M2 (posts & markdown): compose/publish/render, edit, delete,
 * Markdown rendering, XSS sanitization, draft visibility, and ownership.
 */

const PIN = '000000';

function uniqueEmail(): { email: string; username: string } {
  const username = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${username}@example.com`, username };
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

async function compose(page: Page, title: string, body: string, publish = false): Promise<string> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill(body);
  await page.getByTestId(publish ? 'publish-post' : 'save-draft').click();
  await page.waitForURL(/\/posts\//);
  return page.url();
}

test('create a draft, render Markdown, then publish', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  await compose(
    page,
    'My First Post',
    '# Heading\n\n**bold** and [link](https://example.com)\n\n- one\n- two'
  );

  await expect(page).toHaveURL(/\/posts\/my-first-post$/);
  await expect(page.getByTestId('post-title')).toHaveText('My First Post');
  await expect(page.getByTestId('post-status')).toHaveText('draft');

  const content = page.getByTestId('post-content');
  await expect(content.locator('h1')).toHaveText('Heading');
  await expect(content.locator('strong')).toHaveText('bold');
  await expect(content.locator('li')).toHaveCount(2);
  const link = content.locator('a');
  await expect(link).toHaveAttribute('rel', /noopener/);

  // Publish via the owner control; the draft badge disappears.
  await page.getByTestId('publish-post').click();
  await expect(page.getByTestId('post-status')).toHaveCount(0);
});

test('sanitizes dangerous Markdown/HTML', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  await compose(
    page,
    'XSS Test',
    'Safe **text** <script>window.__pwned = true;</script> [bad](javascript:alert(1))',
    true
  );

  const content = page.getByTestId('post-content');
  await expect(content.locator('script')).toHaveCount(0);
  await expect(content.locator('a[href^="javascript"]')).toHaveCount(0);
  expect(await page.evaluate(() => '__pwned' in window)).toBe(false);
});

test('edit an existing post updates its content', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  const url = await compose(page, 'Editable', 'original body');
  await page.getByTestId('edit-post-link').click();
  await page.waitForURL(/\/compose\?id=/);
  await expect(page.getByLabel('Body (Markdown)')).toHaveValue('original body');

  await page.getByLabel('Body (Markdown)').fill('# Updated content');
  await page.getByTestId('save-draft').click();
  await page.waitForURL(url);
  await expect(page.getByTestId('post-content').locator('h1')).toHaveText('Updated content');
});

test('delete a post makes its URL return 404', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  const url = await compose(page, 'Doomed', 'bye', true);
  await page.getByTestId('delete-post').click();
  await page.waitForURL(/\/@[^/]+$/); // redirected to profile

  const resp = await page.goto(url);
  expect(resp?.status()).toBe(404);
});

test('drafts are hidden from anonymous visitors', async ({ page, browser }) => {
  const { email } = uniqueEmail();
  await login(page, email);
  const url = await compose(page, 'Secret Draft', 'hidden text');

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const resp = await anonPage.goto(url);
  expect(resp?.status()).toBe(404);
  await anon.close();
});

test('non-owners cannot see post owner controls', async ({ page }) => {
  const author = uniqueEmail();
  await login(page, author.email);
  const url = await compose(page, 'Public Post', 'visible to all', true);

  // Switch to a different user (replaces the session cookie).
  const viewer = uniqueEmail();
  await login(page, viewer.email);
  await page.goto(url);

  await expect(page.getByTestId('post-content')).toBeVisible();
  await expect(page.getByTestId('post-owner-controls')).toHaveCount(0);
});
