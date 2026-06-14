import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

/**
 * E2E coverage for the profiles / media UX feature:
 * - profile edit (avatar + cover upload) and the public profile page
 * - post author card, comment avatars + usernames, latest-posts strip
 * - the image lightbox (open, prev/next, zoom, close)
 */

const PIN = '000000';

function unique(): { email: string; username: string } {
  const u = `e2e${randomBytes(4).toString('hex')}`;
  return { email: `${u}@example.com`, username: u };
}

async function pngBuffer(color = '#3377cc'): Promise<Buffer> {
  return sharp({ create: { width: 24, height: 18, channels: 3, background: color } })
    .png()
    .toBuffer();
}

async function login(page: Page, email: string): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send PIN' }).click();
  await expect(page.getByTestId('pin-section')).toBeVisible();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/@/);
  return new URL(page.url()).pathname.slice(2); // username from /@username
}

async function publishImagePost(page: Page, title: string): Promise<void> {
  await page.goto('/compose');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body (Markdown)').fill('Look at this photo:');
  await page.getByTestId('session-file').setInputFiles({
    name: 'pic.png',
    mimeType: 'image/png',
    buffer: await pngBuffer(),
  });
  await expect(page.getByLabel('Body (Markdown)')).toHaveValue(/!\[\]\(\/media\/m_[0-9a-f]+\/original\)/);
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
}

test('profile edit uploads avatar + cover and they show on the public profile', async ({ page }) => {
  const u = unique();
  await login(page, u.email);

  await page.goto('/settings');
  await page.getByTestId('settings-cover-file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: await pngBuffer('#aa5522'),
  });
  await page.getByTestId('settings-avatar-file').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: await pngBuffer('#22aa88'),
  });
  // Wait for the previews to reflect the uploads before saving.
  await expect(page.getByTestId('settings-cover-preview')).toHaveAttribute('style', /background-image/);

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(`/@${u.username}`);

  // Public profile renders the cover banner and the avatar image.
  await expect(page.getByTestId('profile-cover')).toHaveAttribute('style', /background-image/);
  const avatar = page.getByTestId('profile-avatar');
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute('src', /\/media\/m_[0-9a-f]+\/thumbnail/);
});

test('public profile shows the user posts in a grid', async ({ page }) => {
  const u = unique();
  await login(page, u.email);
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Profile Grid Post');
  await page.getByLabel('Body (Markdown)').fill('content');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await page.goto(`/@${u.username}`);
  await expect(page.getByTestId('profile-posts').getByTestId('post-card')).toHaveCount(1);
});

test('a portrait cover photo is cropped to a 4:3 card cover', async ({ page }) => {
  const u = unique();
  await login(page, u.email);
  await page.goto('/compose');
  await page.getByLabel('Title').fill('Portrait Cover Post');
  await page.getByLabel('Body (Markdown)').fill('content');

  // A tall portrait cover (60×200) must be cropped into the 4:3 card cover.
  await page.getByTestId('cover-file').setInputFiles({
    name: 'tall.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 60, height: 200, channels: 3, background: '#cc4488' } })
      .png()
      .toBuffer(),
  });
  await expect(page.getByTestId('cover-preview')).toBeVisible();
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await page.goto(`/@${u.username}`);
  const cover = page.getByTestId('profile-posts').getByTestId('post-card').first().locator('.cover');
  const box = await cover.evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  expect(box.w).toBeGreaterThan(0);
  expect(box.w / box.h).toBeCloseTo(4 / 3, 1); // cropped to 4:3, not the source 0.3 ratio
});

test('post page shows author card, latest posts, and avatars/usernames in comments', async ({ page }) => {
  const author = unique();
  const authorName = await login(page, author.email);

  // Two posts so the latest-posts strip has something besides the current post.
  await page.goto('/compose');
  await page.getByLabel('Title').fill('First Post');
  await page.getByLabel('Body (Markdown)').fill('first');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);

  await page.goto('/compose');
  await page.getByLabel('Title').fill('Second Post');
  await page.getByLabel('Body (Markdown)').fill('second');
  await page.getByTestId('publish-post').click();
  await page.waitForURL(/\/posts\//);
  const postUrl = page.url();

  // A second user comments on the post.
  const commenter = unique();
  const commenterName = await login(page, commenter.email);
  await page.goto(postUrl);
  await page.getByTestId('comment-input').fill('Nice post!');
  await page.getByTestId('comment-submit').click();
  await page.waitForLoadState('load');

  // Author card at the bottom shows the author's name and a link to the profile.
  const card = page.getByTestId('post-author');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('author-name')).toHaveText(/.+/);
  await expect(card.getByTestId('author-profile-link')).toHaveAttribute('href', `/@${authorName}`);

  // Latest posts strip renders post cards.
  await expect(page.getByTestId('latest-posts')).toBeVisible();
  await expect(page.getByTestId('latest-posts').getByTestId('post-card').first()).toBeVisible();

  // The comment shows the commenter's username and an avatar element.
  const comment = page.getByTestId('comment').first();
  await expect(comment.getByTestId('comment-username')).toHaveText(`@${commenterName}`);
  await expect(comment.getByTestId('comment-avatar')).toBeVisible();
});

test('clicking an image in a post opens the lightbox with nav + zoom', async ({ page }) => {
  const u = unique();
  await login(page, u.email);
  await publishImagePost(page, 'Lightbox Post');

  const lightbox = page.getByTestId('lightbox');
  await expect(lightbox).toBeHidden();

  // Click the in-content image to open the lightbox.
  await page.getByTestId('post-content').locator('img').first().click();
  await expect(lightbox).toBeVisible();
  await expect(page.getByTestId('lightbox-img')).toHaveAttribute('src', /\/media\/m_[0-9a-f]+\/original/);

  // Zoom in changes the transform scale.
  await page.getByTestId('lightbox-zoom-in').click();
  await expect(page.getByTestId('lightbox-img')).toHaveAttribute('style', /scale\(1\.25\)/);

  // Prev/next wrap around a single-image gallery without errors.
  await page.getByTestId('lightbox-next').click();
  await expect(lightbox).toBeVisible();

  // Escape closes the lightbox.
  await page.keyboard.press('Escape');
  await expect(lightbox).toBeHidden();
});
