import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for infinite scroll on the home "For you" feed: scrolling to the
 * bottom auto-loads the next page of posts and appends them, without a full
 * navigation. The manual "Load more" link remains as a no-JS fallback.
 */

const PIN = '000000';
const PAGE_SIZE = 12;

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

test('auto-loads more posts when scrolling to the bottom of the feed', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  // Seed enough published posts (via the API, using the session cookie) to
  // guarantee more than one page exists.
  const total = PAGE_SIZE * 2 + 3;
  for (let i = 0; i < total; i++) {
    const res = await page.request.post('/api/posts', {
      data: { title: `Scroll post ${i}`, markdownBody: `Body of post ${i}.`, status: 'published' },
    });
    expect(res.ok()).toBe(true);
  }

  await page.goto('/?tab=foryou');

  const cards = page.locator('[data-testid="feed"] [data-testid="post-card"]');
  // The first render shows exactly one page.
  await expect(cards).toHaveCount(PAGE_SIZE);

  // The manual fallback link exists in the DOM (progressive enhancement).
  await expect(page.getByTestId('load-more')).toHaveCount(1);

  // Scroll to the bottom — the IntersectionObserver fetches and appends the next page.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => cards.count()).toBeGreaterThan(PAGE_SIZE);

  // It was an in-place append, not a navigation (no ?cursor= in the URL).
  expect(new URL(page.url()).searchParams.get('cursor')).toBeNull();

  // Keep scrolling to load further pages until the feed is exhausted; the
  // load-more row is then removed. Poll (scrolling each tick) rather than sleep.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        return page.getByTestId('load-more-row').count();
      },
      { timeout: 15_000 }
    )
    .toBe(0);
  await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(total);
});

test('restores the manual Load more link when auto-load fails', async ({ page }) => {
  const { email } = uniqueEmail();
  await login(page, email);

  // Ensure more than one page exists so the load-more row + script render.
  for (let i = 0; i < PAGE_SIZE + 3; i++) {
    const res = await page.request.post('/api/posts', {
      data: { title: `Fallback post ${i}`, markdownBody: `Body ${i}.`, status: 'published' },
    });
    expect(res.ok()).toBe(true);
  }

  await page.goto('/?tab=foryou');
  await expect(page.locator('[data-testid="feed"] [data-testid="post-card"]')).toHaveCount(PAGE_SIZE);

  // Force the auto-load fetch to fail.
  await page.route('**/api/feed**', (route) => route.abort());

  // Scrolling triggers a fetch that fails; the manual link is restored for retry.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId('load-more')).toBeVisible();
  await expect(page.getByTestId('load-more')).toHaveAttribute('href', /\/\?tab=foryou&cursor=/);
});
