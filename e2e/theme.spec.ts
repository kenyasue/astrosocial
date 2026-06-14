import { test, expect } from '@playwright/test';
import path from 'node:path';
import { E2E_SCREENSHOT_DIR } from './config';

/**
 * Design coverage: dark theme is the default, the toggle switches to light and
 * persists, and the layout is usable on a mobile viewport (single codebase).
 */

async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(E2E_SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test('defaults to dark theme and toggles to light, persisting across reloads', async ({ page }) => {
  await page.goto('/login');

  // Default theme is dark.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Toggle to light.
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await shot(page, '08-login-light-theme');

  // Preference persists after reload.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('login renders cleanly on a mobile viewport', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Send PIN' })).toBeVisible();
    await shot(page, '09-login-mobile');
  });
});
