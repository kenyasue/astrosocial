import { test, expect } from '@playwright/test';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { E2E_SCREENSHOT_DIR } from './config';

/** Save a full-page screenshot under e2e/screenshots for visual inspection. */
async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(E2E_SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

/**
 * E2E coverage for M1 (auth & profile) using TEST MODE, where the login PIN is
 * always "000000". Each test uses a unique email so the derived username and
 * profile state are isolated within a run.
 */

const TEST_PIN = '000000';

/** Generate a unique, lowercase-alphanumeric email (predictable username). */
function uniqueEmail(): { email: string; username: string } {
  const username = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${username}@example.com`, username };
}

test('login with the test-mode PIN, view profile, edit it, and log out', async ({ page }) => {
  const { email, username } = uniqueEmail();

  await page.goto('/login');
  await shot(page, '01-login-page');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(TEST_PIN);
  await shot(page, '02-pin-entered');
  await page.getByRole('button', { name: 'Verify' }).click();

  // Redirected to the new user's profile (username derived from the email).
  await page.waitForURL(`/@${username}`);
  await expect(page.getByTestId('profile-display-name')).toHaveText(username);
  await expect(page.getByTestId('profile-username')).toHaveText(`@${username}`);
  await shot(page, '03-profile-after-login');

  // Edit the profile.
  await page.getByTestId('edit-profile-link').click();
  await page.waitForURL('/settings');
  await page.getByLabel('Display name').fill('Ken Yasue');
  await page.getByLabel('Bio').fill('Indie developer building AstroSocial');
  await page.getByLabel('Website').fill('https://ken.example');
  await page.getByLabel('Location').fill('Tokyo');
  await shot(page, '04-settings-filled');
  await page.getByRole('button', { name: 'Save' }).click();

  // Back on the profile with updated values.
  await page.waitForURL(`/@${username}`);
  await expect(page.getByTestId('profile-display-name')).toHaveText('Ken Yasue');
  await expect(page.getByTestId('profile-bio')).toHaveText('Indie developer building AstroSocial');
  await expect(page.getByTestId('profile-location')).toHaveText('Tokyo');
  await shot(page, '05-profile-after-edit');

  // Log out -> back to login.
  await page.getByTestId('logout').click();
  await page.waitForURL('/login');
  await shot(page, '06-after-logout');

  // Settings now requires auth and redirects to login.
  await page.goto('/settings');
  await page.waitForURL('/login');
});

test('shows an error for an incorrect PIN', async ({ page }) => {
  const { email } = uniqueEmail();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();

  await page.getByLabel('PIN').fill('111111');
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByTestId('error')).toContainText(/incorrect pin/i);
  await shot(page, '07-incorrect-pin-error');
  // Still on the login page.
  await expect(page).toHaveURL('/login');
});

test('rejects an invalid email address', async ({ page }) => {
  await page.goto('/login');
  // Bypass native validation to exercise the server-side check.
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Email').evaluate((el: HTMLInputElement) => (el.type = 'text'));
  await page.getByRole('button', { name: 'Send PIN' }).click();

  await expect(page.getByTestId('error')).toContainText(/valid email/i);
});
