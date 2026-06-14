import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * E2E coverage for M9 (direct messages): start a conversation, send + reply,
 * unread badge, delete own message, and DM-policy enforcement.
 */

const PIN = '000000';

function unique(): { email: string; username: string } {
  const u = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${u}@example.com`, username: u };
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

test('start a conversation from a profile, send and reply', async ({ page }) => {
  const a = unique();
  const b = unique();
  // Create recipient b first (so the username exists).
  await login(page, b.email);
  // Sender a messages b.
  await login(page, a.email);
  await page.goto(`/@${b.username}`);
  await page.getByTestId('message-button').click();
  await page.waitForURL(/\/messages\//);

  await page.getByTestId('dm-input').fill('hey there');
  await page.getByTestId('dm-send').click();
  await expect(page.getByTestId('dm-message')).toHaveCount(1);
  await expect(page.getByTestId('dm-message')).toContainText('hey there');

  // Recipient b sees an unread conversation and the message.
  await login(page, b.email);
  await page.goto('/messages');
  await expect(page.getByTestId('dm-conversation')).toHaveCount(1);
  await expect(page.getByTestId('dm-unread')).toBeVisible();
  await page.getByTestId('dm-conversation').click();
  await expect(page.getByTestId('dm-message')).toContainText('hey there');

  // b replies; opening cleared the unread badge.
  await page.getByTestId('dm-input').fill('hello back');
  await page.getByTestId('dm-send').click();
  await expect(page.getByTestId('dm-message')).toHaveCount(2);
  await page.goto('/messages');
  await expect(page.getByTestId('dm-unread')).toHaveCount(0);
});

test('sender can delete their own message', async ({ page }) => {
  const a = unique();
  const b = unique();
  await login(page, b.email);
  await login(page, a.email);
  await page.goto(`/messages/with/${b.username}`);
  await page.waitForURL(/\/messages\//);
  await page.getByTestId('dm-input').fill('delete me');
  await page.getByTestId('dm-send').click();
  await expect(page.getByTestId('dm-message')).toHaveCount(1);
  await page.getByTestId('dm-delete').click();
  await expect(page.getByTestId('dm-message')).toHaveCount(0);
});

test('DM policy "nobody" blocks messaging', async ({ page }) => {
  const a = unique();
  const b = unique();
  // b sets policy to nobody.
  await login(page, b.email);
  await page.goto('/settings');
  await page.getByTestId('dm-policy').selectOption('nobody');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/@/);

  // a tries to message b → blocked (403 page; no thread).
  await login(page, a.email);
  const res = await page.goto(`/messages/with/${b.username}`);
  expect(res?.status()).toBe(403);
});
