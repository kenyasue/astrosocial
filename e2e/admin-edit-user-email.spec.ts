import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for editing a user's email address from the admin console.
 *
 * Admin credentials come from the Playwright webServer env
 * (ADMIN_USERNAME=admin, ADMIN_PASSWORD=e2e-admin-pass).
 */

const PIN = '000000';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'e2e-admin-pass';

function unique(): { email: string; username: string } {
  const u = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${u}@example.com`, username: u };
}

/** Log in as a fresh normal user (creating the account), then clear cookies. */
async function seedUser(page: Page): Promise<{ email: string; username: string }> {
  const u = unique();
  await page.goto('/login');
  await page.getByLabel('Email').fill(u.email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);
  await page.context().clearCookies();
  return u;
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Username').fill(ADMIN_USER);
  await page.getByLabel('Password').fill(ADMIN_PASS);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/admin');
}

/** Open the admin edit page for a given username and return its URL. */
async function openUserEdit(page: Page, username: string): Promise<string> {
  await page.goto('/admin/users');
  const row = page.getByTestId('admin-user-row').filter({ hasText: `@${username}` });
  await row.getByTestId('admin-user-edit').click();
  await page.waitForURL(/\/admin\/users\//);
  return page.url();
}

test('admin can change a user email (normalized) and it shows in the users table', async ({ page }) => {
  const u = await seedUser(page);
  // Mixed-case input exercises the server-side normalization to lower-case.
  const typed = `Changed-${u.username}@Example.COM`;
  const stored = typed.toLowerCase();
  await adminLogin(page);

  await openUserEdit(page, u.username);
  await expect(page.getByLabel('Email')).toHaveValue(u.email);
  await page.getByLabel('Email').fill(typed);
  await page.getByTestId('admin-user-save').click();
  await page.waitForURL('**/admin/users');

  const row = page.getByTestId('admin-user-row').filter({ hasText: `@${u.username}` });
  await expect(row).toContainText(stored);

  // The change persisted (in normalized form): reopening shows the lower-cased address.
  await openUserEdit(page, u.username);
  await expect(page.getByLabel('Email')).toHaveValue(stored);
});

test('re-saving a user with their own unchanged email succeeds', async ({ page }) => {
  const u = await seedUser(page);
  await adminLogin(page);

  await openUserEdit(page, u.username);
  await page.getByLabel('Email').fill(u.email); // unchanged
  await page.getByTestId('admin-user-save').click();
  await page.waitForURL('**/admin/users'); // redirect (success), not an inline error

  const row = page.getByTestId('admin-user-row').filter({ hasText: `@${u.username}` });
  await expect(row).toContainText(u.email);
});

test('a malformed email is rejected server-side with an inline error', async ({ page }) => {
  const u = await seedUser(page);
  await adminLogin(page); // establishes the admin cookie on the context
  const editUrl = await openUserEdit(page, u.username);

  // Post directly so the browser's native email validation does not pre-empt
  // the server-side validation we want to exercise.
  const res = await page.request.post(editUrl, {
    form: { email: 'not-an-email', displayName: 'Whoever' },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('admin-user-error');

  // The stored email is unchanged.
  await openUserEdit(page, u.username);
  await expect(page.getByLabel('Email')).toHaveValue(u.email);
});

test('an email already used by another user is rejected', async ({ page }) => {
  const taken = await seedUser(page);
  const target = await seedUser(page);
  await adminLogin(page);
  const editUrl = await openUserEdit(page, target.username);

  const res = await page.request.post(editUrl, {
    form: { email: taken.email, displayName: 'Whoever' },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('already in use');

  await openUserEdit(page, target.username);
  await expect(page.getByLabel('Email')).toHaveValue(target.email);
});
