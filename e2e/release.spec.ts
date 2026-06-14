import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** E2E coverage for M12 release bits: the RSS feed. */

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);
}

test('RSS feed is served as XML and includes a published post', async ({ page, request }) => {
  const tag = randomBytes(4).toString('hex');
  await login(page, `e2e${tag}@example.com`);
  const title = `RSS Post ${tag}`;
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('rss body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  const res = await request.get('/rss.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('rss+xml');
  const xml = await res.text();
  expect(xml).toContain('<rss version="2.0">');
  expect(xml).toContain(`RSS Post ${tag}`);
});
