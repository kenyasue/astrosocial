import { test, expect } from '@playwright/test';

/**
 * E2E coverage for the two-column app shell: nav rail + Post button + a wide
 * center column on desktop (the right sidebar was removed); bottom tab bar on
 * mobile. The wide center gives more room to read and compose.
 */

test.describe('desktop shell', () => {
  test('shows the nav rail and Post button with no right sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-home')).toBeVisible();
    await expect(page.getByTestId('nav-post')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toBeHidden();

    // The right sidebar (and its standalone search input) is gone — only the
    // rail's Search link remains.
    await expect(page.getByTestId('nav-search')).toHaveCount(0);
    await expect(page.getByTestId('nav-search-link')).toBeVisible();

    // The center column stretches wide (two-column grid, not three).
    const width = await page.locator('main.column').evaluate((el) => el.clientWidth);
    expect(width).toBeGreaterThan(600);
  });
});

test.describe('mobile shell', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('shows the bottom tab bar and hides the rail', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await expect(page.getByTestId('nav-home')).toBeHidden(); // rail hidden on mobile
  });
});

test.describe('tablet shell (collapsed rail)', () => {
  test.use({ viewport: { width: 920, height: 800 } });

  test('keeps the rail and bottom nav stays hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-home')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toBeHidden();
  });
});
