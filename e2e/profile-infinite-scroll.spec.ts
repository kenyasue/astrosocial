import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for infinite scroll on the public profile page (`/@:username`):
 * scrolling to the bottom auto-loads the next page of the user's published posts
 * and appends them without a full navigation. The manual "Load more" link is the
 * no-JS fallback (a normal `?cursor=` navigation). Drafts never appear.
 */

const PIN = '000000';
const PAGE_SIZE = 12;

function uniqueEmail(): { email: string; username: string } {
  const username = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${username}@example.com`, username };
}

/** Log in (creating the account) and return the auto-assigned username. */
async function login(page: Page, email: string): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);
  return decodeURIComponent(new URL(page.url()).pathname.replace(/^\/@/, ''));
}

async function publish(page: Page, title: string): Promise<void> {
  const res = await page.request.post('/api/posts', {
    data: { title, markdownBody: `Body of ${title}.`, status: 'published' },
  });
  expect(res.ok()).toBe(true);
}

test('auto-loads more of a user posts when scrolling the profile page', async ({ page }) => {
  const { email } = uniqueEmail();
  const username = await login(page, email);

  const total = PAGE_SIZE * 2 + 3;
  for (let i = 0; i < total; i++) await publish(page, `Profile post ${i}`);
  // A draft must never leak into the public profile grid.
  const draftRes = await page.request.post('/api/posts', {
    data: { title: 'Secret draft', markdownBody: 'hidden', status: 'draft' },
  });
  expect(draftRes.ok()).toBe(true);

  await page.goto(`/@${username}`);

  const cards = page.locator('[data-testid="profile-posts"] [data-testid="post-card"]');
  await expect(cards).toHaveCount(PAGE_SIZE); // first render = one page
  await expect(page.getByTestId('load-more')).toHaveCount(1); // fallback link present

  // Scroll to the bottom repeatedly until the feed is exhausted (row removed).
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

  // In-place append, not a navigation (no ?cursor= in the URL).
  expect(new URL(page.url()).searchParams.get('cursor')).toBeNull();
  // The draft never appears.
  await expect(page.getByText('Secret draft')).toHaveCount(0);
});

test('the manual Load more link is a working no-JS cursor fallback', async ({ page }) => {
  const { email } = uniqueEmail();
  const username = await login(page, email);

  const total = PAGE_SIZE + 3; // one full page + a few older posts
  for (let i = 0; i < total; i++) await publish(page, `Fallback post ${i}`);

  // Fetch page 1 as raw HTML (no client JS) and read the fallback link's cursor.
  const page1 = await (await page.request.get(`/@${username}`)).text();
  const href = page1.match(/data-testid="load-more"\s+href="([^"]+)"/)?.[1];
  expect(href).toBeTruthy();
  expect(href).toContain(`/@${username}?cursor=`);

  // Following the link (server-side, no JS) must return the OLDER page, not page 1.
  const page2 = await (await page.request.get(href!.replace(/&amp;/g, '&'))).text();
  // The oldest post (far from the page boundary) appears only on the second page.
  expect(page2).toContain('Fallback post 0');
  expect(page2).not.toContain('Fallback post ' + (total - 1)); // newest is on page 1
});
