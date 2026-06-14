import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for the admin console + the AstroSocial rebrand.
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

/** Log in as a normal user and publish a post (so admin has content to moderate). */
async function seedUserWithPost(page: Page): Promise<{ username: string; title: string }> {
  const u = unique();
  await page.goto('/login');
  await page.getByLabel('Email').fill(u.email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);

  const title = `Admin target ${u.username}`;
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('moderate me');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  // Log out so the admin session is independent of the user session.
  await page.context().clearCookies();
  return { username: u.username, title };
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Username').fill(ADMIN_USER);
  await page.getByLabel('Password').fill(ADMIN_PASS);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/admin');
}

test('the product is branded AstroSocial', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'AstroSocial Admin' })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /AstroSocial/ })).toBeVisible();
});

test('admin routes require authentication', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/admin');
  await page.waitForURL('**/admin/login');
  await expect(page.getByTestId('admin-login-form')).toBeVisible();
});

test('wrong admin credentials are rejected', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Username').fill(ADMIN_USER);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/admin\/login\?error=1/);
  await expect(page.getByTestId('admin-error')).toBeVisible();
});

test('admin can log in and see the dashboard', async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByTestId('admin-stats')).toBeVisible();
  await expect(page.getByTestId('admin-nav-users')).toBeVisible();
});

test('admin can edit a user display name', async ({ page }) => {
  const { username } = await seedUserWithPost(page);
  await adminLogin(page);

  await page.getByTestId('admin-nav-users').click();
  await page.waitForURL('**/admin/users');
  const row = page.getByTestId('admin-user-row').filter({ hasText: `@${username}` });
  await row.getByTestId('admin-user-edit').click();
  await page.waitForURL(/\/admin\/users\//);

  await page.getByLabel('Display name').fill('Renamed By Admin');
  await page.getByTestId('admin-user-save').click();
  await page.waitForURL('**/admin/users');

  // The change is reflected on the public profile.
  await page.goto(`/@${username}`);
  await expect(page.getByTestId('profile-display-name')).toHaveText('Renamed By Admin');
});

test('admin can delete a post', async ({ page }) => {
  const { title } = await seedUserWithPost(page);
  await adminLogin(page);

  await page.getByTestId('admin-nav-posts').click();
  await page.waitForURL('**/admin/posts');
  const row = page.getByTestId('admin-post-row').filter({ hasText: title });
  await expect(row).toHaveCount(1);

  // Auto-accept the confirm() dialog, then delete.
  page.on('dialog', (d) => d.accept());
  await row.getByTestId('admin-post-delete').click();
  await page.waitForURL('**/admin/posts');
  await expect(page.getByTestId('admin-post-row').filter({ hasText: title })).toHaveCount(0);
});

test('admin can save SMTP settings and they persist', async ({ page }) => {
  await adminLogin(page);
  await page.getByTestId('admin-nav-settings').click();
  await page.waitForURL('**/admin/settings');

  await page.getByLabel('SMTP host').fill('smtp.example.com');
  await page.getByLabel('Port', { exact: true }).fill('587');
  await page.getByLabel('From address').fill('noreply@example.com');
  await page.getByTestId('admin-settings-save').click();
  await page.waitForURL(/\/admin\/settings\?saved=1/);
  await expect(page.getByTestId('admin-settings-saved')).toBeVisible();

  // Reload: the values persisted (password is intentionally never re-rendered).
  await page.goto('/admin/settings');
  await expect(page.getByLabel('SMTP host')).toHaveValue('smtp.example.com');
  await expect(page.getByLabel('Port', { exact: true })).toHaveValue('587');
  await expect(page.getByLabel('From address')).toHaveValue('noreply@example.com');
});

test('invalid SMTP settings are rejected by the server with an error', async ({ page }) => {
  await adminLogin(page); // establishes the admin cookie on the context
  // Post directly so the browser's native number/email validation does not
  // pre-empt the server-side validation we want to exercise.
  const res = await page.request.post('/admin/settings', {
    form: { host: 'smtp.example.com', port: '999999', fromAddress: 'not-an-email' },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('admin-settings-error');
});

test('admin can set site name, description, and login-email template', async ({ page }) => {
  await adminLogin(page);
  try {
    await page.goto('/admin/settings');
    await page.getByLabel('Site name').fill('Stargazers Club');
    await page.getByLabel('Site description').fill('A community for astrophotographers');
    await page.getByTestId('admin-email-template').fill('Your {sitename} code is {PIN}. Cheers!');
    await page.getByTestId('admin-site-save').click();
    await page.waitForURL(/\/admin\/settings\?saved=1/);
    await expect(page.getByTestId('admin-settings-saved')).toBeVisible();

    // Persisted across a reload.
    await page.goto('/admin/settings');
    await expect(page.getByLabel('Site name')).toHaveValue('Stargazers Club');
    await expect(page.getByLabel('Site description')).toHaveValue('A community for astrophotographers');
    await expect(page.getByTestId('admin-email-template')).toHaveValue('Your {sitename} code is {PIN}. Cheers!');

    // The login page reflects the configured site name + description.
    await page.goto('/login');
    await expect(page.getByTestId('login-site-name')).toHaveText('Welcome to Stargazers Club');
    await expect(page.getByTestId('login-site-description')).toHaveText(
      'A community for astrophotographers'
    );
  } finally {
    // Restore defaults so other specs see the stock "AstroSocial" branding.
    await page.request.post('/admin/settings/site', {
      form: { siteName: '', siteDescription: '', emailTemplate: '' },
    });
  }
});
