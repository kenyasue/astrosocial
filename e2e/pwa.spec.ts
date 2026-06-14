import { test, expect } from '@playwright/test';

/**
 * E2E coverage for M11 (PWA): manifest linked + served, service worker served,
 * icons served, offline fallback page, and theme-color meta.
 */

test('home page links the manifest, icon, and theme-color', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/icon.svg');
});

test('manifest is served as valid JSON with core fields', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.name).toBe('AstroSocial');
  expect(m.display).toBe('standalone');
});

test('service worker and icons are served', async ({ request }) => {
  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['content-type']).toContain('javascript');
  expect(await sw.text()).toContain("addEventListener('fetch'");

  const svg = await request.get('/icon.svg');
  expect(svg.status()).toBe(200);
  expect(svg.headers()['content-type']).toContain('svg');

  const png = await request.get('/icon-192.png');
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toContain('png');
});

test('offline fallback page renders', async ({ page }) => {
  await page.goto('/offline');
  await expect(page.getByTestId('offline')).toBeVisible();
  await expect(page.getByTestId('offline')).toContainText(/offline/i);
});

test('a published post exposes Open Graph tags', async ({ page }) => {
  // Log in and publish a post, then check its OG meta.
  await page.goto('/login');
  await page.getByLabel('Email').fill(`e2e${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);

  await page.goto('/compose');
  await page.getByLabel('Title').fill('OG Post');
  await page.getByLabel('Body (Markdown)').fill('open graph body');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'OG Post');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
});
