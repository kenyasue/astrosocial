/**
 * Server-rendered HTML pages for the auth + profile flows.
 *
 * Pages use the shared themed shell (header with logo + theme toggle, dark
 * default / light theme, responsive container) from `theme.ts`, the cat logo
 * from `logo.ts`, semantic labels/roles, and `data-testid` attributes for
 * stable end-to-end selectors. User-supplied values are HTML-escaped.
 */
import type {
  CommentView,
  ConversationSummary,
  ConversationView,
  MediaView,
  NotificationView,
  Post,
  PostCard,
  PostSocial,
  PostView,
  ProfileView,
  QuotedPost,
  TimelineItem,
} from '../types';
import { STYLESHEET, THEME_INIT_SCRIPT, THEME_TOGGLE_SCRIPT } from './theme';
import { readingMinutesFromText } from '../text/readingTime';
import { config } from '../config/env';
import type { SearchResults, SearchSuggestions } from '../services/SearchService';
import type { UserDirectoryEntry } from '../services/DiscoveryService';

// Re-export so the server can serve the stylesheet at /styles.css.
export { STYLESHEET };

/** Escape a string for safe interpolation into HTML text/attribute context. */
export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Per-request shell context for viewer-aware chrome (Discover widget + future
 * unread badges). Set synchronously by the HTTP layer immediately before each page
 * render (page builders and better-sqlite3 are synchronous, so no awaits interleave).
 */
export interface ShellContext {
  loggedIn: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  /** Configured site name (DB value, or the default when unset). */
  siteName: string;
}

/** Fallback site name when no admin value is configured. */
const DEFAULT_SITE_NAME = 'AstroSocial';

const EMPTY_SHELL: ShellContext = {
  loggedIn: false,
  unreadNotifications: 0,
  unreadMessages: 0,
  siteName: DEFAULT_SITE_NAME,
};

let shellCtx: ShellContext = EMPTY_SHELL;

/** Set the current shell context (or reset to empty when passed null). */
export function setShellContext(ctx: ShellContext | null): void {
  shellCtx = ctx ?? EMPTY_SHELL;
}

/** Left navigation rail: brand, nav items, Post button, theme toggle. */
function navBadge(count: number, testid: string): string {
  return count > 0 ? `<span class="nav-badge" data-testid="${testid}">${count > 99 ? '99+' : count}</span>` : '';
}

function navRail(): string {
  const item = (href: string, icon: string, label: string, testid: string, badge = '') =>
    `<li><a href="${href}" data-testid="${testid}"><span class="ic" aria-hidden="true">${icon}</span><span class="label">${label}</span>${badge}</a></li>`;
  return `
  <nav class="rail" aria-label="Primary">
    <a class="rail-brand" href="/"><span class="ic" aria-hidden="true">🍺</span><span class="label">${escapeHtml(shellCtx.siteName)}</span></a>
    <ul class="rail-nav">
      ${item('/', '🏠', 'Home', 'nav-home')}
      ${item('/explore', '👤', 'Users', 'nav-users')}
      ${item('/search', '🔍', 'Search', 'nav-search-link')}
      ${item('/notifications', '🔔', 'Notifications', 'nav-notifications', navBadge(shellCtx.unreadNotifications, 'nav-notif-badge'))}
      ${item('/messages', '✉️', 'Messages', 'nav-messages', navBadge(shellCtx.unreadMessages, 'nav-msg-badge'))}
      ${item('/bookmarks', '🔖', 'Bookmarks', 'nav-bookmarks')}
      ${item('/timeline', '👥', 'Timeline', 'nav-timeline')}
    </ul>
    <a class="post-btn" href="/compose" data-testid="nav-post">
      <span class="label">Post</span><span class="pi" aria-hidden="true">✚</span></a>
    <button class="icon-btn theme-toggle-rail" id="theme-toggle" data-testid="theme-toggle"
      type="button" aria-label="Toggle theme" title="Toggle theme"></button>
    ${
      shellCtx.loggedIn
        ? `<button class="rail-logout" id="rail-logout" data-testid="rail-logout" type="button"
            aria-label="Log out" title="Log out">
            <span class="ic" aria-hidden="true">🚪</span><span class="label">Log out</span></button>`
        : `<a class="rail-logout" href="/login" data-testid="rail-login"
            aria-label="Log in" title="Log in">
            <span class="ic" aria-hidden="true">🔑</span><span class="label">Log in</span></a>`
    }
  </nav>`;
}

/** Mobile bottom tab bar (shown on narrow viewports). */
function bottomNav(): string {
  const tab = (href: string, icon: string, label: string, badge = '') =>
    `<a href="${href}" aria-label="${label}" title="${label}"><span aria-hidden="true">${icon}</span>${badge}</a>`;
  return `
  <nav class="bottom-nav" data-testid="bottom-nav" aria-label="Primary">
    ${tab('/', '🏠', 'Home')}
    ${tab('/explore', '👤', 'Users')}
    ${tab('/compose', '✚', 'Post')}
    ${tab('/messages', '✉️', 'Messages', navBadge(shellCtx.unreadMessages, 'bottom-msg-badge'))}
    ${tab('/notifications', '🔔', 'Notifications', navBadge(shellCtx.unreadNotifications, 'bottom-notif-badge'))}
  </nav>`;
}

function layout(title: string, body: string, opts: { head?: string } = {}): string {
  const swRegister = config.testMode
    ? ''
    : `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}</script>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · ${escapeHtml(shellCtx.siteName)}</title>
  <link rel="stylesheet" href="/styles.css" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#0f1115" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <meta property="og:site_name" content="${escapeHtml(shellCtx.siteName)}" />
  ${opts.head ?? `<meta property="og:title" content="${escapeHtml(title)}" /><meta property="og:type" content="website" />`}
  <script>${THEME_INIT_SCRIPT}</script>
</head>
<body>
<div class="app">
${navRail()}
<main class="column">
<div class="container">
${body}
</div>
</main>
</div>
${bottomNav()}
<script>${THEME_TOGGLE_SCRIPT}</script>
<script>(function(){var b=document.getElementById('rail-logout');if(b){b.addEventListener('click',async function(){await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login';});}})();</script>
${swRegister}
</body>
</html>`;
}

export function loginPage(testMode: boolean, site?: { name: string; description: string }): string {
  const hint = testMode
    ? `<p data-testid="test-mode-hint" class="muted">Test mode: the PIN is always <strong>000000</strong>.</p>`
    : '';
  const siteName = site?.name?.trim() || 'AstroSocial';
  const subtitle = site?.description?.trim() || 'Sign in with a one-time PIN sent to your email.';
  return layout(
    'Log in',
    `
  <section class="hero">
    <h1 data-testid="login-site-name">Welcome to ${escapeHtml(siteName)}</h1>
    <p class="subtitle" data-testid="login-site-description">${escapeHtml(subtitle)}</p>
  </section>

  <div class="card">
    ${hint}
    <p data-testid="error" class="error" role="alert"></p>

    <form id="email-form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
      <button class="btn-full" type="submit">Send PIN</button>
    </form>

    <form id="pin-form" data-testid="pin-section" hidden>
      <p data-testid="pin-status" class="muted">A PIN has been sent. Enter it below.</p>
      <label for="pin">PIN</label>
      <input id="pin" name="pin" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" />
      <button class="btn-full" type="submit">Verify</button>
    </form>
  </div>

  <script>
    const errorEl = document.querySelector('[data-testid="error"]');
    const emailForm = document.getElementById('email-form');
    const pinForm = document.getElementById('pin-form');

    async function postJson(url, data) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }

    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const email = document.getElementById('email').value;
      const res = await postJson('/api/auth/request-pin', { email });
      if (res.ok) {
        pinForm.hidden = false;
        document.getElementById('pin').focus();
      } else {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.error ? body.error.message : 'Could not send PIN';
      }
    });

    pinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const email = document.getElementById('email').value;
      const pin = document.getElementById('pin').value;
      const res = await postJson('/api/auth/verify-pin', { email, pin });
      if (res.ok) {
        const body = await res.json();
        window.location.href = '/@' + body.user.username;
      } else {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.error ? body.error.message : 'Could not verify PIN';
      }
    });
  </script>
  `
  );
}

export function profilePage(
  profile: ProfileView,
  isOwner: boolean,
  posts: PostCard[] = [],
  opts: { loggedIn: boolean; isFollowing: boolean; nextCursor?: string | null } = {
    loggedIn: false,
    isFollowing: false,
  }
): string {
  const followControl =
    opts.loggedIn && !isOwner
      ? `<div class="row" style="gap:10px">
        <a class="ghost" href="/messages/with/${escapeHtml(profile.username)}" data-testid="message-button"
          style="display:inline-flex;align-items:center;padding:8px 16px;border-radius:999px">Message</a>
        <button id="follow-btn" type="button" data-testid="follow-button"
          data-following="${opts.isFollowing}" data-username="${escapeHtml(profile.username)}"
          class="${opts.isFollowing ? 'ghost' : ''}">${opts.isFollowing ? 'Following' : 'Follow'}</button>
        </div>
        <script>
          (function () {
            const b = document.getElementById('follow-btn');
            b.addEventListener('click', async () => {
              const method = b.dataset.following === 'true' ? 'DELETE' : 'POST';
              const res = await fetch('/api/users/' + b.dataset.username + '/follow', { method });
              if (res.ok) {
                const f = (await res.json()).following;
                b.dataset.following = String(f);
                b.textContent = f ? 'Following' : 'Follow';
                b.classList.toggle('ghost', f);
              }
            });
          })();
        </script>`
      : '';
  const ownerControls = isOwner
    ? `
    <div class="row" style="margin-top:18px; gap:14px;">
      <a href="/compose" data-testid="write-link" style="font-weight:600;color:var(--accent)">Write a post</a>
      <a href="/drafts" data-testid="your-posts-link" style="font-weight:600;color:var(--accent)">Your posts</a>
      <a href="/library" data-testid="library-link" style="font-weight:600;color:var(--accent)">Media</a>
      <span style="flex:1"></span>
      <button class="ghost" id="logout" data-testid="logout" type="button">Log out</button>
    </div>
    <script>
      document.getElementById('logout').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      });
    </script>`
    : '';

  const website = profile.websiteUrl
    ? `<p data-testid="profile-website"><a href="${escapeHtml(profile.websiteUrl)}" rel="noopener noreferrer">${escapeHtml(profile.websiteUrl)}</a></p>`
    : '';

  return layout(
    profile.displayName,
    `
  <div class="profile-header" data-testid="profile-header">
    <div class="profile-cover" data-testid="profile-cover"
      ${profile.coverUrl ? `style="background-image:url('${escapeHtml(profile.coverUrl)}')"` : ''}></div>
    <div class="profile-id">
      ${avatarImg(profile.avatarUrl, profile.displayName, 'profile-avatar')}
      <div class="profile-id-text">
        <h1 data-testid="profile-display-name">${escapeHtml(profile.displayName)}</h1>
        <p class="at" data-testid="profile-username">@${escapeHtml(profile.username)}</p>
      </div>
      <span class="spacer"></span>
      ${isOwner ? `<a class="ghost" href="/settings" data-testid="edit-profile-link" style="padding:8px 16px;border-radius:999px">Edit profile</a>` : followControl}
    </div>
    <p data-testid="profile-bio">${escapeHtml(profile.bio)}</p>
    <p class="muted" data-testid="profile-location">${escapeHtml(profile.location)}</p>
    ${website}
    <p class="stats">
      <strong data-testid="post-count">${profile.postCount}</strong> Posts ·
      <strong data-testid="follower-count">${profile.followerCount}</strong> Followers ·
      <strong data-testid="following-count">${profile.followingCount}</strong> Following
    </p>
    ${ownerControls}
  </div>

  <h2 style="margin:20px 0 12px">Posts</h2>
  ${
    posts.length === 0
      ? `<p class="muted" data-testid="profile-empty">No published posts yet.</p>`
      : `<div class="card-grid" data-testid="profile-posts">${posts.map(postCard).join('')}</div>
        ${
          opts.nextCursor
            ? loadMoreRow({
                grid: 'profile-posts',
                endpoint: `/api/users/${encodeURIComponent(profile.username)}/posts?cursor=`,
                fallback: `/@${encodeURIComponent(profile.username)}?cursor=`,
                cursor: opts.nextCursor,
              })
            : ''
        }`
  }
  `
  );
}

/** Avatar <img> with a themed letter-placeholder fallback when there is no image. */
function avatarImg(url: string | null, name: string, testid: string): string {
  if (url) {
    return `<img class="avatar" data-testid="${testid}" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" />`;
  }
  const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase() || '?');
  return `<span class="avatar avatar-placeholder" data-testid="${testid}" aria-hidden="true">${initial}</span>`;
}

export function settingsPage(profile: ProfileView): string {
  return layout(
    'Profile settings',
    `
  <div class="card">
    <h1>Profile settings</h1>
    <p data-testid="error" class="error" role="alert"></p>
    <p data-testid="saved" class="ok" role="status"></p>

    <form id="profile-form">
      <label>Cover image</label>
      <div class="settings-cover" id="cover-preview" data-testid="settings-cover-preview"
        ${profile.coverUrl ? `style="background-image:url('${escapeHtml(profile.coverUrl)}')"` : ''}></div>
      <input type="file" id="cover-file" accept="image/*" data-testid="settings-cover-file" />
      <input type="hidden" id="cover-media-id" />

      <label>Avatar</label>
      <div class="settings-avatar-row">
        ${avatarImg(profile.avatarUrl, profile.displayName, 'settings-avatar-preview')}
        <input type="file" id="avatar-file" accept="image/*" data-testid="settings-avatar-file" />
        <input type="hidden" id="avatar-media-id" />
      </div>

      <label for="displayName">Display name</label>
      <input id="displayName" name="displayName" value="${escapeHtml(profile.displayName)}" required />

      <label for="bio">Bio</label>
      <textarea id="bio" name="bio" placeholder="Tell people about yourself">${escapeHtml(profile.bio)}</textarea>

      <label for="websiteUrl">Website</label>
      <input id="websiteUrl" name="websiteUrl" value="${escapeHtml(profile.websiteUrl)}" placeholder="https://example.com" />

      <label for="location">Location</label>
      <input id="location" name="location" value="${escapeHtml(profile.location)}" placeholder="City, Country" />

      <label for="dmPolicy">Who can message you</label>
      <select id="dmPolicy" name="dmPolicy" data-testid="dm-policy">
        ${['everyone', 'following', 'mutual', 'nobody']
          .map(
            (p) =>
              `<option value="${p}" ${profile.dmPolicy === p ? 'selected' : ''}>${
                { everyone: 'Everyone', following: 'People you follow', mutual: 'Mutual follows', nobody: 'Nobody' }[
                  p as 'everyone'
                ]
              }</option>`
          )
          .join('')}
      </select>

      <button class="btn-full" type="submit">Save</button>
    </form>
  </div>

  <script>
    const errorEl = document.querySelector('[data-testid="error"]');
    const savedEl = document.querySelector('[data-testid="saved"]');
    const avatarId = document.getElementById('avatar-media-id');
    const coverId = document.getElementById('cover-media-id');

    async function uploadImage(file) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ? b.error.message : 'Upload failed');
      }
      return (await res.json()).media;
    }

    document.getElementById('avatar-file').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      errorEl.textContent = '';
      try {
        const m = await uploadImage(file);
        avatarId.value = m.publicId;
        const prev = document.querySelector('[data-testid="settings-avatar-preview"]');
        if (prev.tagName === 'IMG') prev.src = m.thumbnailUrl;
        else prev.outerHTML = '<img class="avatar" data-testid="settings-avatar-preview" src="' + m.thumbnailUrl + '" alt="" />';
      } catch (err) { errorEl.textContent = err.message; }
    });

    document.getElementById('cover-file').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      errorEl.textContent = '';
      try {
        const m = await uploadImage(file);
        coverId.value = m.publicId;
        document.getElementById('cover-preview').style.backgroundImage = "url('" + m.originalUrl + "')";
      } catch (err) { errorEl.textContent = err.message; }
    });

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      savedEl.textContent = '';
      const payload = {
        displayName: document.getElementById('displayName').value,
        bio: document.getElementById('bio').value,
        websiteUrl: document.getElementById('websiteUrl').value,
        location: document.getElementById('location').value,
        dmPolicy: document.getElementById('dmPolicy').value,
      };
      if (avatarId.value) payload.avatarMediaId = avatarId.value;
      if (coverId.value) payload.coverMediaId = coverId.value;
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = await res.json();
        savedEl.textContent = 'Saved';
        window.location.href = '/@' + body.user.username;
      } else {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.error ? body.error.message : 'Could not save';
      }
    });
  </script>
  `
  );
}

/** Compose page — create a new post or edit an existing one (owner only). */
export function composePage(
  post: Post | null,
  cover: { publicId: string; url: string } | null = null,
  quoted: PostView | null = null
): string {
  const editing = post !== null;
  const title = editing ? escapeHtml(post.title) : '';
  const body = editing ? escapeHtml(post.markdownBody) : '';
  const publishLabel = editing && post.status === 'published' ? 'Update' : 'Publish';
  const hasCover = cover !== null;

  return layout(
    editing ? 'Edit post' : 'New post',
    `
  <div class="card editor" data-testid="compose" data-post-id="${editing ? escapeHtml(post.publicId) : ''}">
    <h1 style="display:inline-block">${editing ? 'Edit post' : 'New post'}</h1>
    <span class="autosave" data-testid="autosave-status"></span>
    <p data-testid="error" class="error" role="alert"></p>

    ${
      quoted
        ? `<div class="quoted-embed" data-testid="compose-quoted">
            <strong>${escapeHtml(quoted.title ?? 'Untitled')}</strong>
            <span class="muted">${escapeHtml(quoted.authorDisplayName)}</span>
          </div>
          <input type="hidden" id="quote-post-id" value="${escapeHtml(quoted.publicId)}" />`
        : ''
    }

    <div class="cover-field">
      <label for="cover-file">Cover image</label>
      <input id="cover-file" type="file" accept="image/*" data-testid="cover-file" />
      <input type="hidden" id="cover-media-id" value="${hasCover ? escapeHtml(cover.publicId) : ''}" />
      <img class="cover-preview" id="cover-preview" data-testid="cover-preview"
        src="${hasCover ? escapeHtml(cover.url) : ''}" alt="Cover preview" ${hasCover ? '' : 'hidden'} />
      <div class="toolbar">
        <button type="button" class="ghost" id="cover-remove" data-testid="cover-remove"
          ${hasCover ? '' : 'hidden'}>Remove cover</button>
      </div>
    </div>

    <label for="title">Title</label>
    <input id="title" name="title" value="${title}" placeholder="Post title (optional)" />

    <div class="tabs">
      <button type="button" class="ghost" id="tab-edit" data-testid="tab-edit" aria-selected="true">Edit</button>
      <button type="button" class="ghost" id="tab-preview" data-testid="tab-preview" aria-selected="false">Preview</button>
    </div>

    <div class="md-toolbar" id="md-toolbar" data-testid="md-toolbar">
      <button type="button" data-md="bold" title="Bold" aria-label="Bold">B</button>
      <button type="button" data-md="italic" title="Italic" aria-label="Italic">I</button>
      <button type="button" data-md="h2" title="Heading" aria-label="Heading">H2</button>
      <button type="button" data-md="quote" title="Quote" aria-label="Quote">&ldquo;</button>
      <button type="button" data-md="list" title="List" aria-label="List">List</button>
      <button type="button" data-md="code" title="Code" aria-label="Code">Code</button>
      <button type="button" data-md="link" title="Link" aria-label="Link">Link</button>
      <button type="button" id="insert-image" data-testid="add-photos" aria-label="Add photos">Add photos</button>
    </div>

    <label for="body">Body (Markdown)</label>
    <textarea id="body" name="body" placeholder="Write your post in Markdown…">${body}</textarea>
    <div id="preview" class="post-content" data-testid="preview" hidden></div>

    <input type="file" id="session-file" accept="image/*,video/*" multiple data-testid="session-file" hidden />
    <div class="session-media" id="session-strip" data-testid="session-media" hidden>
      <span class="muted session-hint">Uploaded this session — click to insert:</span>
      <div class="session-thumbs" id="session-thumbs"></div>
    </div>

    <label for="tags">Tags (comma-separated)</label>
    <input id="tags" name="tags" placeholder="e.g. gardening, diy" data-testid="tags-input" />

    <div class="toolbar">
      <button class="ghost" id="save-draft" type="button" data-testid="save-draft">Save draft</button>
      <button id="publish" type="button" data-testid="publish-post">${publishLabel}</button>
    </div>
  </div>

  <script>
    const composeEl = document.querySelector('[data-testid="compose"]');
    const errorEl = document.querySelector('[data-testid="error"]');
    const coverIdEl = document.getElementById('cover-media-id');
    const coverPreview = document.getElementById('cover-preview');
    const coverRemove = document.getElementById('cover-remove');
    const ta = document.getElementById('body');
    const titleEl = document.getElementById('title');
    const statusEl = document.querySelector('[data-testid="autosave-status"]');

    // --- caret/selection transforms (mirror lib/markdown/markdownEdit.ts) ---
    function wrapSel(before, after) {
      after = after === undefined ? before : after;
      const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value, sel = t.slice(s, e);
      ta.value = t.slice(0, s) + before + sel + after + t.slice(e);
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
    }
    function togglePrefix(prefix) {
      const t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      const ls = t.lastIndexOf('\\n', s - 1) + 1;
      let le = t.indexOf('\\n', e); if (le === -1) le = t.length;
      const lines = t.slice(ls, le).split('\\n');
      const all = lines.every((l) => l.startsWith(prefix));
      const nl = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l)).join('\\n');
      ta.value = t.slice(0, ls) + nl + t.slice(le);
      ta.focus(); ta.selectionStart = ls; ta.selectionEnd = ls + nl.length;
    }
    function insertAt(snippet) {
      const s = ta.selectionStart, t = ta.value;
      ta.value = t.slice(0, s) + snippet + t.slice(s);
      const p = s + snippet.length; ta.focus(); ta.selectionStart = ta.selectionEnd = p;
    }

    document.getElementById('md-toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-md]');
      if (!b) return;
      const k = b.dataset.md;
      if (k === 'bold') wrapSel('**');
      else if (k === 'italic') wrapSel('*');
      else if (k === 'code') wrapSel('\`');
      else if (k === 'link') wrapSel('[', '](url)');
      else if (k === 'h2') togglePrefix('## ');
      else if (k === 'quote') togglePrefix('> ');
      else if (k === 'list') togglePrefix('- ');
      scheduleSave();
    });

    // --- Edit / Preview tabs ---
    const tabEdit = document.getElementById('tab-edit');
    const tabPreview = document.getElementById('tab-preview');
    const previewEl = document.getElementById('preview');
    const toolbarEl = document.getElementById('md-toolbar');
    tabEdit.addEventListener('click', () => {
      previewEl.hidden = true; ta.hidden = false; toolbarEl.hidden = false;
      tabEdit.setAttribute('aria-selected', 'true'); tabPreview.setAttribute('aria-selected', 'false');
    });
    tabPreview.addEventListener('click', async () => {
      const res = await fetch('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: ta.value }),
      });
      const b = await res.json().catch(() => ({ html: '' }));
      previewEl.innerHTML = b.html || '';
      ta.hidden = true; toolbarEl.hidden = true; previewEl.hidden = false;
      tabPreview.setAttribute('aria-selected', 'true'); tabEdit.setAttribute('aria-selected', 'false');
    });

    // --- Session media: upload multiple photos this session, click a thumb to insert ---
    const sessionInput = document.getElementById('session-file');
    const sessionStrip = document.getElementById('session-strip');
    const sessionThumbs = document.getElementById('session-thumbs');
    function snippetFor(m) {
      return m.mimeType.indexOf('image/') === 0
        ? '\\n\\n![](' + m.originalUrl + ')\\n\\n'
        : '\\n\\n[video](' + m.canonicalPath + ')\\n\\n';
    }
    function addSessionThumb(m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-thumb';
      btn.dataset.mime = m.mimeType;
      btn.dataset.url = m.originalUrl;
      btn.dataset.canon = m.canonicalPath;
      btn.setAttribute('aria-label', 'Insert uploaded media');
      const img = document.createElement('img');
      img.src = m.thumbnailUrl; img.alt = ''; img.loading = 'lazy';
      btn.appendChild(img);
      sessionThumbs.appendChild(btn);
      sessionStrip.hidden = false;
    }
    document.getElementById('insert-image').addEventListener('click', () => sessionInput.click());
    sessionInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      errorEl.textContent = '';
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const b = await res.json();
          addSessionThumb(b.media);
          insertAt(snippetFor(b.media));
        } else {
          const b = await res.json().catch(() => ({}));
          errorEl.textContent = b.error ? b.error.message : 'Upload failed';
        }
      }
      sessionInput.value = '';
      scheduleSave();
    });
    sessionThumbs.addEventListener('click', (e) => {
      const btn = e.target.closest('button.session-thumb');
      if (!btn) return;
      insertAt(snippetFor({ mimeType: btn.dataset.mime, originalUrl: btn.dataset.url, canonicalPath: btn.dataset.canon }));
      scheduleSave();
    });

    // --- Auto-save ---
    let saveTimer;
    function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 1200); }
    async function autosave() {
      const markdownBody = ta.value;
      if (!markdownBody.trim()) return;
      statusEl.textContent = 'Saving…';
      const quoteEl = document.getElementById('quote-post-id');
      const tagsEl = document.getElementById('tags');
      const payload = {
        title: titleEl.value, markdownBody, coverMediaId: coverIdEl.value || null,
        quotePostId: quoteEl ? quoteEl.value : null,
        tags: tagsEl ? tagsEl.value.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };
      let res, pid = composeEl.dataset.postId;
      if (pid) {
        res = await fetch('/api/posts/' + pid, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'draft' }),
        });
        if (res.ok) {
          const b = await res.json();
          composeEl.dataset.postId = b.post.publicId;
          history.replaceState(null, '', '/compose?id=' + b.post.publicId);
        }
      }
      statusEl.textContent = res && res.ok ? 'Saved' : 'Save failed';
    }
    titleEl.addEventListener('input', scheduleSave);
    ta.addEventListener('input', scheduleSave);

    document.getElementById('cover-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      errorEl.textContent = '';
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const b = await res.json();
        coverIdEl.value = b.media.publicId;
        coverPreview.src = b.media.originalUrl;
        coverPreview.hidden = false;
        coverRemove.hidden = false;
      } else {
        const b = await res.json().catch(() => ({}));
        errorEl.textContent = b.error ? b.error.message : 'Could not upload the image';
      }
    });

    coverRemove.addEventListener('click', () => {
      coverIdEl.value = '';
      coverPreview.hidden = true;
      coverRemove.hidden = true;
    });

    async function submitPost(doPublish) {
      errorEl.textContent = '';
      clearTimeout(saveTimer);
      const title = document.getElementById('title').value;
      const markdownBody = document.getElementById('body').value;
      const coverMediaId = coverIdEl.value || null;
      const quoteEl = document.getElementById('quote-post-id');
      const quotePostId = quoteEl ? quoteEl.value : null;
      const tagsEl = document.getElementById('tags');
      const tags = tagsEl ? tagsEl.value.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const postId = composeEl.dataset.postId;
      let res;
      if (postId) {
        res = await fetch('/api/posts/' + postId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, markdownBody, coverMediaId }),
        });
        if (res.ok && doPublish) {
          res = await fetch('/api/posts/' + postId + '/publish', { method: 'POST' });
        }
      } else {
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, markdownBody, coverMediaId, quotePostId, tags, status: doPublish ? 'published' : 'draft' }),
        });
      }
      if (res.ok) {
        const b = await res.json();
        window.location.href = b.post.canonicalPath;
      } else {
        const b = await res.json().catch(() => ({}));
        errorEl.textContent = b.error ? b.error.message : 'Could not save the post';
      }
    }

    document.getElementById('save-draft').addEventListener('click', () => submitPost(false));
    document.getElementById('publish').addEventListener('click', () => submitPost(true));
  </script>
  `
  );
}

/** Long-form post detail page with social actions and comments. */
export function postDetailPage(
  view: PostView,
  isOwner: boolean,
  social: PostSocial,
  comments: CommentView[],
  loggedIn: boolean,
  viewerUsername: string | null = null,
  author: ProfileView | null = null,
  latest: PostCard[] = [],
  isFollowing = false
): string {
  const date = (view.publishedAt ?? view.createdAt).slice(0, 10);
  const statusBadge =
    view.status !== 'published'
      ? `<span class="badge" data-testid="post-status">${escapeHtml(view.status)}</span>`
      : '';

  const ownerControls = isOwner
    ? `
    <div class="toolbar" data-testid="post-owner-controls">
      <a href="/compose?id=${escapeHtml(view.publicId)}" data-testid="edit-post-link"
        style="font-weight:600;color:var(--accent)">Edit</a>
      ${
        view.status === 'published'
          ? `<button class="ghost" id="archive-post" type="button" data-testid="archive-post">Archive</button>`
          : `<button id="publish-post" type="button" data-testid="publish-post">Publish</button>`
      }
      <span class="spacer"></span>
      <button class="ghost" id="delete-post" type="button" data-testid="delete-post">Delete</button>
    </div>
    <script>
      const pid = ${JSON.stringify(view.publicId)};
      const home = ${JSON.stringify('/@' + view.authorUsername)};
      const pub = document.getElementById('publish-post');
      const arc = document.getElementById('archive-post');
      const del = document.getElementById('delete-post');
      if (pub) pub.addEventListener('click', async () => {
        await fetch('/api/posts/' + pid + '/publish', { method: 'POST' });
        window.location.reload();
      });
      if (arc) arc.addEventListener('click', async () => {
        await fetch('/api/posts/' + pid + '/archive', { method: 'POST' });
        window.location.reload();
      });
      if (del) del.addEventListener('click', async () => {
        await fetch('/api/posts/' + pid, { method: 'DELETE' });
        window.location.href = home;
      });
    </script>`
    : '';

  const ogHead =
    `<meta property="og:type" content="article" />` +
    `<meta property="og:title" content="${escapeHtml(view.title ?? 'Untitled')}" />` +
    `<meta property="og:description" content="${escapeHtml(view.excerpt)}" />` +
    (view.coverUrl ? `<meta property="og:image" content="${escapeHtml(view.coverUrl)}" />` : '');

  const authorFollow =
    author && loggedIn && !isOwner
      ? `<button id="author-follow" type="button" data-testid="author-follow"
          data-following="${isFollowing}" data-username="${escapeHtml(author.username)}"
          class="${isFollowing ? 'ghost' : ''}">${isFollowing ? 'Following' : 'Follow'}</button>`
      : '';

  const authorCard = author
    ? `
  <section class="card author-card" data-testid="post-author">
    <a class="author-card-id" href="/@${escapeHtml(author.username)}">
      ${avatarImg(author.avatarUrl, author.displayName, 'author-avatar')}
      <span class="author-card-text">
        <strong data-testid="author-name">${escapeHtml(author.displayName)}</strong>
        <span class="at">@${escapeHtml(author.username)}</span>
      </span>
    </a>
    ${author.bio ? `<p class="author-card-bio" data-testid="author-bio">${escapeHtml(author.bio)}</p>` : ''}
    <div class="author-card-actions">
      <a class="ghost" href="/@${escapeHtml(author.username)}" data-testid="author-profile-link"
        style="padding:8px 16px;border-radius:999px">View profile</a>
      ${authorFollow}
    </div>
  </section>`
    : '';

  const latestStrip = latest.length
    ? `
  <section class="latest-posts" data-testid="latest-posts">
    <h2>Latest posts</h2>
    <div class="latest-row">${latest.map(postCard).join('')}</div>
  </section>`
    : '';

  return layout(
    view.title ?? 'Untitled',
    `
  <article class="card">
    ${view.coverUrl ? `<img class="cover-image" data-testid="post-cover" src="${escapeHtml(view.coverUrl)}" alt="" />` : ''}
    <h1 data-testid="post-title">${escapeHtml(view.title ?? 'Untitled')}</h1>
    <p class="post-byline">
      <a href="/@${escapeHtml(view.authorUsername)}">${escapeHtml(view.authorDisplayName)}</a>
      · ${escapeHtml(date)} · ${readingMinutesFromText(view.markdownBody)} min read ${statusBadge}
    </p>
    ${view.quoted ? quotedEmbed(view.quoted) : ''}
    <div class="post-content" data-testid="post-content">${view.html}</div>
    ${
      view.tags.length
        ? `<p class="post-tags" data-testid="post-tags">${view.tags
            .map((t) => `<a class="badge" href="/tags/${escapeHtml(t.slug)}">#${escapeHtml(t.name)}</a>`)
            .join(' ')}</p>`
        : ''
    }
    ${ownerControls}

    <div class="social-bar" data-testid="social-bar">
      <button class="like-btn" type="button" data-testid="like-button" aria-pressed="${social.liked}"
        ${loggedIn ? '' : 'disabled'}>♥ <span data-testid="like-count">${social.likeCount}</span></button>
      <button class="like-btn" type="button" data-testid="repost-button" aria-pressed="${social.reposted}"
        ${loggedIn ? '' : 'disabled'}>🔁 <span data-testid="repost-count">${social.repostCount}</span></button>
      <button class="like-btn" type="button" data-testid="bookmark-button" aria-pressed="${social.bookmarked}"
        ${loggedIn ? '' : 'disabled'} aria-label="Bookmark">🔖</button>
      ${loggedIn ? `<a class="quote-link" data-testid="quote-link" href="/compose?quote=${escapeHtml(view.publicId)}">Quote</a>` : ''}
      <span class="reactions">
        ${social.reactions
          .map(
            (r) =>
              `<button class="reaction" type="button" data-emoji="${escapeHtml(r.emoji)}"
                data-reacted="${r.reacted}" ${loggedIn ? '' : 'disabled'}>${r.emoji}
                <span class="rc">${r.count}</span></button>`
          )
          .join('')}
      </span>
    </div>
  </article>

  <section class="card comments" data-testid="comments">
    <h2>Comments (<span data-testid="comment-count">${social.commentCount}</span>)</h2>
    ${
      loggedIn
        ? `<form id="comment-form">
            <label for="comment-body">Add a comment</label>
            <textarea id="comment-body" data-testid="comment-input" placeholder="Write a comment…"></textarea>
            <button type="submit" data-testid="comment-submit">Comment</button>
          </form>`
        : `<p class="muted">Log in to comment.</p>`
    }
    <ul class="comment-list" data-testid="comment-list">
      ${comments.map((c) => commentItem(c, loggedIn && (isOwner || c.authorUsername === viewerUsername))).join('')}
    </ul>
  </section>

  ${authorCard}
  ${latestStrip}
  ${lightboxMarkup()}

  <script>
    const sbPid = ${JSON.stringify(view.publicId)};
    function applySocial(s) {
      const lb = document.querySelector('[data-testid="like-button"]');
      lb.setAttribute('aria-pressed', String(s.liked));
      document.querySelector('[data-testid="like-count"]').textContent = s.likeCount;
      const rp = document.querySelector('[data-testid="repost-button"]');
      rp.setAttribute('aria-pressed', String(s.reposted));
      document.querySelector('[data-testid="repost-count"]').textContent = s.repostCount;
      document.querySelector('[data-testid="bookmark-button"]').setAttribute('aria-pressed', String(s.bookmarked));
      s.reactions.forEach((r) => {
        const b = document.querySelector('.reaction[data-emoji="' + r.emoji + '"]');
        if (b) { b.dataset.reacted = String(r.reacted); b.querySelector('.rc').textContent = r.count; }
      });
    }
    function toggleAction(btn, path) {
      if (!btn || btn.disabled) return;
      btn.addEventListener('click', async () => {
        const method = btn.getAttribute('aria-pressed') === 'true' ? 'DELETE' : 'POST';
        const res = await fetch('/api/posts/' + sbPid + path, { method });
        if (res.ok) applySocial((await res.json()).social);
      });
    }
    toggleAction(document.querySelector('[data-testid="like-button"]'), '/like');
    toggleAction(document.querySelector('[data-testid="repost-button"]'), '/repost');
    toggleAction(document.querySelector('[data-testid="bookmark-button"]'), '/bookmark');
    document.querySelectorAll('.reaction').forEach((b) => {
      if (b.disabled) return;
      b.addEventListener('click', async () => {
        const method = b.dataset.reacted === 'true' ? 'DELETE' : 'POST';
        const res = await fetch('/api/posts/' + sbPid + '/reactions', {
          method, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji: b.dataset.emoji }),
        });
        if (res.ok) applySocial((await res.json()).social);
      });
    });
    const cf = document.getElementById('comment-form');
    if (cf) cf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = document.getElementById('comment-body').value;
      const res = await fetch('/api/posts/' + sbPid + '/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.ok) window.location.reload();
    });
    document.querySelectorAll('[data-comment-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        await fetch('/api/comments/' + b.getAttribute('data-comment-del'), { method: 'DELETE' });
        window.location.reload();
      });
    });

    const authorFollowBtn = document.getElementById('author-follow');
    if (authorFollowBtn) authorFollowBtn.addEventListener('click', async () => {
      const method = authorFollowBtn.dataset.following === 'true' ? 'DELETE' : 'POST';
      const res = await fetch('/api/users/' + authorFollowBtn.dataset.username + '/follow', { method });
      if (res.ok) {
        const f = (await res.json()).following;
        authorFollowBtn.dataset.following = String(f);
        authorFollowBtn.textContent = f ? 'Following' : 'Follow';
        authorFollowBtn.classList.toggle('ghost', f);
      }
    });
  </script>
  ${lightboxScript('[data-testid="post-cover"], [data-testid="post-content"] img')}
  `,
    { head: ogHead }
  );
}

/** Lightbox overlay markup — a single instance reused per page. */
function lightboxMarkup(): string {
  return `
  <div class="lightbox" id="lightbox" data-testid="lightbox" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Image viewer">
    <button class="lightbox-close" type="button" data-testid="lightbox-close" aria-label="Close">×</button>
    <button class="lightbox-nav lightbox-prev" type="button" data-testid="lightbox-prev" aria-label="Previous image">‹</button>
    <img class="lightbox-img" id="lightbox-img" data-testid="lightbox-img" alt="" />
    <button class="lightbox-nav lightbox-next" type="button" data-testid="lightbox-next" aria-label="Next image">›</button>
    <div class="lightbox-zoom">
      <button class="ghost" type="button" data-testid="lightbox-zoom-out" aria-label="Zoom out">−</button>
      <button class="ghost" type="button" data-testid="lightbox-zoom-in" aria-label="Zoom in">+</button>
    </div>
    <p class="lightbox-hint" data-testid="lightbox-hint">
      Click to zoom · Shift+Click to zoom out · Space+Drag to pan · Esc to close
    </p>
  </div>`;
}

/**
 * Lightbox behaviour script. Collects images matching `selector` into a gallery;
 * clicking one opens the overlay. Inside, a magnifier tool is active by default:
 * click to zoom in (about the cursor), Shift+click to zoom out, and Space+drag to
 * pan like an image editor. The cursor reflects the active mode. Prev/next, the ±
 * buttons, Escape, and backdrop-click-to-close are preserved; reduced-motion is
 * respected via CSS.
 */
function lightboxScript(selector: string): string {
  return `<script>
  (function () {
    const box = document.getElementById('lightbox');
    if (!box) return;
    const imgEl = document.getElementById('lightbox-img');
    const items = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    if (!items.length) { box.remove(); return; }
    const closeBtn = box.querySelector('[data-testid="lightbox-close"]');
    const MIN = 1, MAX = 6;
    let idx = 0, scale = 1, tx = 0, ty = 0, lastFocus = null;
    let spaceDown = false, shiftDown = false, panning = false;
    let panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0, justPanned = false;

    function clampPan() {
      if (scale <= 1) { tx = 0; ty = 0; return; }
      const maxX = ((scale - 1) * imgEl.clientWidth) / 2;
      const maxY = ((scale - 1) * imgEl.clientHeight) / 2;
      tx = Math.max(-maxX, Math.min(maxX, tx));
      ty = Math.max(-maxY, Math.min(maxY, ty));
    }
    function applyTransform() {
      clampPan();
      imgEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }
    function updateCursor() {
      imgEl.style.cursor = panning ? 'grabbing'
        : spaceDown ? 'grab'
        : shiftDown ? 'zoom-out'
        : 'zoom-in';
    }
    function zoomAt(factor, clientX, clientY) {
      const newScale = Math.max(MIN, Math.min(MAX, scale * factor));
      if (newScale === scale) return;
      const rect = imgEl.getBoundingClientRect();
      const ratio = newScale / scale;
      tx += (clientX - (rect.left + rect.width / 2)) * (1 - ratio);
      ty += (clientY - (rect.top + rect.height / 2)) * (1 - ratio);
      scale = newScale;
      if (Math.abs(scale - 1) < 1e-9) { scale = 1; tx = 0; ty = 0; }
      applyTransform();
    }
    function zoomCenter(delta) {
      scale = Math.max(MIN, Math.min(MAX, scale + delta));
      if (Math.abs(scale - 1) < 1e-9) { scale = 1; tx = 0; ty = 0; }
      applyTransform();
    }
    function show(i) {
      idx = (i + items.length) % items.length;
      scale = 1; tx = 0; ty = 0; applyTransform();
      const src = items[idx].getAttribute('data-full') || items[idx].currentSrc || items[idx].src;
      imgEl.src = src;
      imgEl.alt = items[idx].alt || '';
      updateCursor();
    }
    function open(i) {
      lastFocus = document.activeElement;
      spaceDown = false; shiftDown = false; panning = false;
      show(i);
      box.hidden = false; box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function close() {
      box.hidden = true; box.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      // Reset transient tool state so the next open starts on the magnifier.
      spaceDown = false; shiftDown = false; panning = false;
      imgEl.style.transition = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    items.forEach((el, i) => {
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', (e) => { e.preventDefault(); open(i); });
    });

    // Magnifier: click zooms in (Shift+click out) about the cursor point.
    imgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (spaceDown || justPanned) return;
      zoomAt(e.shiftKey ? 1 / 1.6 : 1.6, e.clientX, e.clientY);
    });
    // Pan tool: Space + drag.
    imgEl.addEventListener('mousedown', (e) => {
      if (!spaceDown) return;
      e.preventDefault();
      panning = true; justPanned = false;
      panStartX = e.clientX; panStartY = e.clientY; panOrigX = tx; panOrigY = ty;
      imgEl.style.transition = 'none';
      updateCursor();
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      e.preventDefault();
      tx = panOrigX + (e.clientX - panStartX);
      ty = panOrigY + (e.clientY - panStartY);
      if (Math.abs(e.clientX - panStartX) + Math.abs(e.clientY - panStartY) > 3) justPanned = true;
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      if (!panning) return;
      panning = false;
      imgEl.style.transition = '';
      updateCursor();
      setTimeout(() => { justPanned = false; }, 0);
    });

    box.querySelector('[data-testid="lightbox-close"]').addEventListener('click', close);
    box.querySelector('[data-testid="lightbox-prev"]').addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
    box.querySelector('[data-testid="lightbox-next"]').addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
    box.querySelector('[data-testid="lightbox-zoom-in"]').addEventListener('click', (e) => { e.stopPropagation(); zoomCenter(0.25); });
    box.querySelector('[data-testid="lightbox-zoom-out"]').addEventListener('click', (e) => { e.stopPropagation(); zoomCenter(-0.25); });
    box.addEventListener('click', (e) => { if (e.target === box) close(); });

    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { show(idx - 1); return; }
      if (e.key === 'ArrowRight') { show(idx + 1); return; }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // do not scroll the page behind the lightbox
        if (!spaceDown) { spaceDown = true; updateCursor(); }
      } else if (e.key === 'Shift') {
        shiftDown = true; updateCursor();
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === ' ') { spaceDown = false; panning = false; updateCursor(); }
      else if (e.key === 'Shift') { shiftDown = false; updateCursor(); }
    });
  })();
  </script>`;
}

/** List of the current user's posts (drafts + published). */
export function draftsPage(cards: PostCard[]): string {
  const items =
    cards.length === 0
      ? `<p class="muted" data-testid="empty">You have no posts yet.</p>`
      : `<ul class="post-list" data-testid="post-list">
        ${cards
          .map(
            (c) => `<li>
          <a class="title" href="${escapeHtml(c.canonicalPath)}">${escapeHtml(c.title ?? 'Untitled')}</a>
          ${c.status !== 'published' ? `<span class="badge">${escapeHtml(c.status)}</span>` : ''}
          <div class="meta">${escapeHtml((c.publishedAt ?? c.createdAt).slice(0, 10))} ·
            <a href="/compose?id=${escapeHtml(c.publicId)}">edit</a></div>
        </li>`
          )
          .join('')}
      </ul>`;

  return layout(
    'Your posts',
    `
  <div class="card">
    <div class="row"><h1 style="flex:1">Your posts</h1>
      <a href="/compose" data-testid="new-post"
        style="font-weight:600;color:var(--accent)">New post</a></div>
    ${items}
  </div>
  `
  );
}

/** A single post card for the home/profile grids. */
export function postCard(card: PostCard): string {
  const cover = card.coverUrl
    ? `<span class="cover"><img src="${escapeHtml(card.coverUrl)}" alt="" loading="lazy" /></span>`
    : `<span class="cover no-cover"></span>`;
  const date = (card.publishedAt ?? card.createdAt).slice(0, 10);
  return `<a class="post-card" href="${escapeHtml(card.canonicalPath)}" data-testid="post-card">
    ${cover}
    <span class="body">
      <span class="card-title">${escapeHtml(card.title ?? 'Untitled')}</span>
      <span class="card-meta">${escapeHtml(card.authorDisplayName)} · ${escapeHtml(date)} · ${card.readingMinutes} min read</span>
      <span class="card-excerpt">${escapeHtml(card.excerpt)}</span>
    </span>
  </a>`;
}

/**
 * Build one infinite-scroll feed page from a slice of cards: the rendered card
 * HTML plus the cursor for the next page (the last card's `publishedAt` when a
 * full page was returned, else null to signal the end). Shared by the
 * `/api/feed` endpoint so server pagination stays in one place.
 */
/**
 * The cursor for the next page given a slice of cards: the last card's publish
 * time when a full page was returned, else null (signals the end). The query
 * paginates on `published_at < cursor`. Posts sharing an identical timestamp at
 * a page boundary can be skipped — a known limitation inherited from the existing
 * feed pagination (see the steering design doc), not introduced here.
 */
export function nextCursorFor(cards: PostCard[], pageSize: number): string | null {
  return cards.length === pageSize ? (cards[cards.length - 1].publishedAt ?? null) : null;
}

export function buildFeedPage(
  cards: PostCard[],
  pageSize: number
): { html: string; nextCursor: string | null } {
  return { html: cards.map(postCard).join(''), nextCursor: nextCursorFor(cards, pageSize) };
}

/** A single comment list item with the commenter's avatar and username. */
function commentItem(c: CommentView, canDelete: boolean): string {
  const author = c.authorDisplayName ?? c.guestName ?? 'Anonymous';
  const handle = c.authorUsername
    ? `<a class="comment-username at" href="/@${escapeHtml(c.authorUsername)}" data-testid="comment-username">@${escapeHtml(c.authorUsername)}</a>`
    : '';
  return `<li class="comment" data-testid="comment">
    ${avatarImg(c.authorAvatarUrl, author, 'comment-avatar')}
    <div class="comment-main">
      <div class="comment-head">
        <span class="comment-author">${escapeHtml(author)}</span>
        ${handle}
        ${canDelete ? `<button class="ghost comment-del" data-comment-del="${escapeHtml(c.id)}" data-testid="comment-delete">Delete</button>` : ''}
      </div>
      <span class="comment-body" data-testid="comment-body">${escapeHtml(c.body)}</span>
    </div>
  </li>`;
}

/** Embedded quoted-post card (or a deleted placeholder). */
function quotedEmbed(q: QuotedPost): string {
  if (q.deleted) {
    return `<div class="quoted-embed deleted" data-testid="quoted-embed">This post has been deleted.</div>`;
  }
  return `<a class="quoted-embed" data-testid="quoted-embed" href="${escapeHtml(q.canonicalPath)}">
    <strong>${escapeHtml(q.title ?? 'Untitled')}</strong>
    <span class="muted">${escapeHtml(q.authorDisplayName)}</span>
    <span class="card-excerpt">${escapeHtml(q.excerpt)}</span>
  </a>`;
}

/** Notifications page with mark-all-read. */
export function notificationsPage(
  items: NotificationView[],
  tab: 'all' | 'mentions',
  nextCursor: string | null
): string {
  const verb: Record<string, string> = {
    like: 'liked your post',
    comment: 'commented on your post',
    reaction: 'reacted to your post',
    follow: 'followed you',
    repost: 'reposted your post',
    quote_post: 'quoted your post',
    dm_message: 'sent you a message',
  };
  const tabLink = (t: string, label: string) =>
    `<a href="/notifications?tab=${t}" data-testid="tab-${t}" aria-selected="${tab === t}">${label}</a>`;
  const tabs = `<div class="tabs search-tabs">${tabLink('all', 'All')}${tabLink('mentions', 'Mentions')}</div>`;

  const list =
    items.length === 0
      ? `<p class="muted" data-testid="notifications-empty">Nothing here yet.</p>`
      : `<ul class="post-list" data-testid="notification-list">
          ${items
            .map(
              (n) => `<li class="${n.read ? '' : 'unread'}" data-testid="notification">
            <a href="/n/${escapeHtml(n.id)}" class="notif-link">
              <strong>${escapeHtml(n.actorDisplayName ?? n.actorUsername ?? 'Someone')}</strong>
              ${escapeHtml(verb[n.type] ?? 'interacted')}
              ${n.postTitle ? `· ${escapeHtml(n.postTitle)}` : ''}
            </a>
          </li>`
            )
            .join('')}
        </ul>
        ${
          nextCursor
            ? `<div class="load-more-row"><a class="badge" data-testid="load-more"
                href="/notifications?tab=${tab}&amp;cursor=${encodeURIComponent(nextCursor)}">Load more</a></div>`
            : ''
        }`;

  return layout(
    'Notifications',
    `<div class="row"><h1 style="flex:1">Notifications</h1>
       <button class="ghost" id="mark-all-read" data-testid="mark-all-read" type="button">Mark all read</button></div>
     ${tabs}
     ${list}
    <script>
      document.getElementById('mark-all-read').addEventListener('click', async () => {
        await fetch('/api/notifications/read-all', { method: 'POST' });
        window.location.reload();
      });
    </script>`
  );
}

/** Bookmarks page (the current user's saved posts). */
export function bookmarksPage(cards: PostCard[]): string {
  if (cards.length === 0) {
    return layout(
      'Bookmarks',
      `<h1 style="margin-bottom:16px">Bookmarks</h1>
       <div class="card" data-testid="bookmarks-empty">
         <p class="muted">You haven't saved any posts yet.</p>
         <p><a href="/explore">Find people to follow →</a></p>
       </div>`
    );
  }

  const items = cards
    .map((c) => {
      const haystack = `${c.title ?? ''} ${c.excerpt ?? ''}`.toLowerCase();
      return `<div class="bookmark-item" data-testid="bookmark-item"
        data-filter="${escapeHtml(haystack)}" data-pid="${escapeHtml(c.publicId)}">
        ${postCard(c)}
        <button class="ghost unbookmark" type="button" data-testid="unbookmark"
          data-pid="${escapeHtml(c.publicId)}">Remove</button>
      </div>`;
    })
    .join('');

  return layout(
    'Bookmarks',
    `<h1 style="margin-bottom:12px">Bookmarks</h1>
     <input id="bm-filter" class="bm-filter" data-testid="bookmark-filter"
       placeholder="Filter bookmarks" aria-label="Filter bookmarks" />
     <div class="card-grid" data-testid="bookmarks">${items}</div>
     <p class="muted" data-testid="bookmarks-none" hidden>No bookmarks match your filter.</p>
     <script>
       const filter = document.getElementById('bm-filter');
       const items = Array.from(document.querySelectorAll('.bookmark-item'));
       const none = document.querySelector('[data-testid="bookmarks-none"]');
       filter.addEventListener('input', () => {
         const q = filter.value.trim().toLowerCase();
         let visible = 0;
         items.forEach((it) => {
           const match = !q || it.dataset.filter.includes(q);
           it.hidden = !match;
           if (match) visible++;
         });
         none.hidden = visible !== 0;
       });
       document.querySelectorAll('.unbookmark').forEach((b) => {
         b.addEventListener('click', async () => {
           const res = await fetch('/api/posts/' + b.dataset.pid + '/bookmark', { method: 'DELETE' });
           if (res.ok) {
             const item = b.closest('.bookmark-item');
             if (item) item.remove();
           }
         });
       });
     </script>`
  );
}

/** Following timeline page (posts and reposts from followed users). */
export function timelinePage(items: TimelineItem[]): string {
  const body =
    items.length === 0
      ? `<p class="feed-empty" data-testid="timeline-empty">Your timeline is empty. Follow people to see their posts here.</p>`
      : `<div class="card-grid" data-testid="timeline">
          ${items
            .map(
              (it) =>
                `<div class="timeline-item" data-testid="timeline-item">
                  ${
                    it.type === 'repost'
                      ? `<p class="repost-label" data-testid="repost-label">🔁 ${escapeHtml(it.actorDisplayName ?? it.actorUsername)} reposted</p>`
                      : ''
                  }
                  ${postCard(it.card)}
                </div>`
            )
            .join('')}
        </div>`;
  return layout('Timeline', `<h1 style="margin-bottom:16px">Following</h1>${body}`);
}

/** Public home page: latest published posts as a card grid with pagination. */
/**
 * Infinite-scroll for a card grid (home feed or profile grid): when the
 * load-more row nears the viewport, fetch the next page of cards and append them.
 * The row carries everything via `data-*`: `data-grid` (target grid testid),
 * `data-endpoint` (fetch URL prefix, cursor appended), `data-fallback` (manual
 * link href prefix), and `data-cursor`. Progressive enhancement — if
 * IntersectionObserver is unavailable or a fetch fails, the manual "Load more"
 * link keeps working as a normal paginated navigation.
 */
const AUTO_LOAD_SCRIPT = `(function(){
  var row = document.querySelector('[data-testid="load-more-row"]');
  if(!row || row.dataset.autoLoadInit || !('IntersectionObserver' in window)) return;
  row.dataset.autoLoadInit = '1';
  var grid = document.querySelector('[data-testid="' + row.getAttribute('data-grid') + '"]');
  if(!grid) return;
  var endpoint = row.getAttribute('data-endpoint');
  var fallback = row.getAttribute('data-fallback');
  var link = row.querySelector('[data-testid="load-more"]');
  var loadingEl = row.querySelector('[data-testid="feed-loading"]');
  var cursor = row.getAttribute('data-cursor');
  var loading = false;
  if(link){ link.style.display = 'none'; }
  function stop(){ obs.disconnect(); if(row.parentNode){ row.parentNode.removeChild(row); } }
  function loadMore(){
    if(loading || !cursor) return;
    loading = true;
    if(loadingEl){ loadingEl.hidden = false; }
    fetch(endpoint + encodeURIComponent(cursor))
      .then(function(res){ if(!res.ok) throw new Error('bad status'); return res.json(); })
      .then(function(data){
        if(data.html){ grid.insertAdjacentHTML('beforeend', data.html); }
        cursor = data.nextCursor;
        if(!cursor){ stop(); return; }
        if(link){ link.setAttribute('href', fallback + encodeURIComponent(cursor)); }
      })
      .catch(function(){
        // Stop auto-loading and restore the manual link so the user can retry.
        obs.disconnect();
        if(link){ link.style.display = ''; }
      })
      .then(function(){
        loading = false;
        if(loadingEl){ loadingEl.hidden = true; }
      });
  }
  var obs = new IntersectionObserver(function(entries){
    if(entries[0] && entries[0].isIntersecting){ loadMore(); }
  }, { rootMargin: '400px' });
  obs.observe(row);
})();`;

/**
 * Render the load-more row (loading indicator + manual fallback link) plus the
 * auto-load script, shared by the home feed and the profile grid. `endpoint` and
 * `fallback` are URL prefixes to which the (encoded) cursor is appended; `grid`
 * is the target grid's `data-testid`.
 */
function loadMoreRow(opts: {
  grid: string;
  endpoint: string;
  fallback: string;
  cursor: string;
}): string {
  const href = `${escapeHtml(opts.fallback)}${encodeURIComponent(opts.cursor)}`;
  return `<div class="load-more-row" data-testid="load-more-row"
      data-grid="${escapeHtml(opts.grid)}" data-cursor="${escapeHtml(opts.cursor)}"
      data-endpoint="${escapeHtml(opts.endpoint)}" data-fallback="${escapeHtml(opts.fallback)}">
      <span class="feed-loading" data-testid="feed-loading" role="status" aria-live="polite" hidden>
        <span class="spinner" aria-hidden="true"></span> Loading more…
      </span>
      <a class="badge" data-testid="load-more" href="${href}">Load more</a>
    </div>
    <script>${AUTO_LOAD_SCRIPT}</script>`;
}

export function homePage(opts: {
  tab: 'foryou' | 'following';
  loggedIn: boolean;
  feed: PostCard[];
  nextCursor: string | null;
  timeline: TimelineItem[];
}): string {
  const { tab, loggedIn, feed, nextCursor, timeline } = opts;

  const tabs = loggedIn
    ? `<div class="tabs search-tabs">
        <a href="/?tab=foryou" data-testid="tab-foryou" aria-selected="${tab === 'foryou'}">For you</a>
        <a href="/?tab=following" data-testid="tab-following" aria-selected="${tab === 'following'}">Following</a>
      </div>`
    : '';

  let body: string;
  if (tab === 'following') {
    body = timeline.length
      ? `<div class="card-grid" data-testid="feed">${timeline
          .map(
            (it) =>
              `<div class="timeline-item" data-testid="timeline-item">${
                it.type === 'repost'
                  ? `<p class="repost-label">🔁 ${escapeHtml(it.actorDisplayName ?? it.actorUsername)} reposted</p>`
                  : ''
              }${postCard(it.card)}</div>`
          )
          .join('')}</div>`
      : `<p class="feed-empty" data-testid="feed-empty">Follow people to see their posts here.</p>`;
  } else {
    body = feed.length
      ? `<div class="card-grid" data-testid="feed">${feed.map(postCard).join('')}</div>
        ${
          nextCursor
            ? loadMoreRow({
                grid: 'feed',
                endpoint: '/api/feed?tab=foryou&cursor=',
                fallback: '/?tab=foryou&cursor=',
                cursor: nextCursor,
              })
            : ''
        }`
      : `<p class="feed-empty" data-testid="feed-empty">No posts yet. Be the first to publish!</p>`;
  }

  return layout('Home', `<h1 style="margin-bottom:12px">Home</h1>${tabs}${body}`);
}

/** Media library — the current user's uploads as a thumbnail grid. */
export function libraryPage(items: MediaView[]): string {
  const grid =
    items.length === 0
      ? `<p class="muted" data-testid="empty">You have no media yet.</p>`
      : `<div class="media-grid" data-testid="media-grid">
        ${items
          .map(
            (m) => `<a href="${escapeHtml(m.canonicalPath)}" data-testid="media-item">
            <img src="${escapeHtml(m.thumbnailUrl)}" alt="${escapeHtml(m.altText ?? m.originalFileName)}" loading="lazy" />
          </a>`
          )
          .join('')}
      </div>`;

  return layout(
    'Media library',
    `<div class="card"><h1>Media library</h1>${grid}</div>`
  );
}

/** Public media detail page. */
export function mediaDetailPage(view: MediaView, isOwner: boolean): string {
  const isImage = view.mimeType.startsWith('image/');
  const media = isImage
    ? `<img src="${escapeHtml(view.originalUrl)}" alt="${escapeHtml(view.altText ?? view.originalFileName)}" data-testid="media-image" />`
    : `<video src="${escapeHtml(view.originalUrl)}" controls data-testid="media-video"></video>`;

  const ownerControls = isOwner
    ? `<div class="toolbar" data-testid="media-owner-controls">
        <button class="ghost" id="delete-media" type="button" data-testid="delete-media">Delete</button>
      </div>
      <script>
        document.getElementById('delete-media').addEventListener('click', async () => {
          await fetch('/api/media/' + ${JSON.stringify(view.publicId)}, { method: 'DELETE' });
          window.location.href = '/library';
        });
      </script>`
    : '';

  return layout(
    'Media',
    `
  <div class="card media-detail">
    ${media}
    <p class="media-meta" data-testid="media-meta">
      by <a href="/@${escapeHtml(view.ownerUsername)}">${escapeHtml(view.ownerUsername)}</a>
      · ${escapeHtml(view.mimeType)}${view.width ? ` · ${view.width}×${view.height}` : ''}
    </p>
    ${ownerControls}
  </div>
  `
  );
}

/** Search page with a query box and post + people results. */
export function searchPage(
  query: string,
  results: SearchResults,
  suggestions: SearchSuggestions
): string {
  const q = query.trim();
  const form = `<form class="search-form" method="get" action="/search">
    <input name="q" value="${escapeHtml(query)}" placeholder="Search posts, people, and tags"
      data-testid="search-input" aria-label="Search" />
    <button type="submit">Search</button>
  </form>`;

  // No query → suggestions view.
  if (!q) {
    const tagChips = suggestions.tags.length
      ? `<div class="chips" data-testid="suggest-tags">${suggestions.tags
          .map((t) => `<a class="badge" href="/tags/${escapeHtml(t.slug)}">#${escapeHtml(t.name)}</a>`)
          .join(' ')}</div>`
      : `<p class="muted">No tags yet.</p>`;
    const people = suggestions.people.length
      ? `<ul class="post-list" data-testid="suggest-people">${suggestions.people
          .map(
            (u) =>
              `<li><a href="/@${escapeHtml(u.username)}">${escapeHtml(u.displayName)} <span class="muted">@${escapeHtml(u.username)}</span></a></li>`
          )
          .join('')}</ul>`
      : `<p class="muted">No people yet.</p>`;
    return layout(
      'Search',
      `<h1 style="margin-bottom:12px">Search</h1>${form}
       <div data-testid="search-suggestions">
         <h2>Trending tags</h2>${tagChips}
         <h2 style="margin-top:20px">People to follow</h2>${people}
       </div>`
    );
  }

  const tabHref = (t: string) => `/search?q=${encodeURIComponent(q)}&amp;tab=${t}`;
  const tab = (t: string, label: string) =>
    `<a href="${tabHref(t)}" data-testid="tab-${t}" aria-selected="${results.tab === t}">${label}</a>`;
  const tabs = `<div class="tabs search-tabs">
    ${tab('top', 'Top')}${tab('latest', 'Latest')}${tab('people', 'People')}${tab('tags', 'Tags')}
  </div>`;

  let content: string;
  if (results.tab === 'people') {
    content = results.users.length
      ? `<ul class="post-list" data-testid="search-users">${results.users
          .map(
            (u) =>
              `<li><a href="/@${escapeHtml(u.username)}">${escapeHtml(u.displayName)} <span class="muted">@${escapeHtml(u.username)}</span></a></li>`
          )
          .join('')}</ul>`
      : `<p class="muted" data-testid="search-empty">No matching people.</p>`;
  } else if (results.tab === 'tags') {
    content = results.tags.length
      ? `<div class="chips" data-testid="search-tags">${results.tags
          .map((t) => `<a class="badge" href="/tags/${escapeHtml(t.slug)}">#${escapeHtml(t.name)}</a>`)
          .join(' ')}</div>`
      : `<p class="muted" data-testid="search-empty">No matching tags.</p>`;
  } else {
    content = results.posts.length
      ? `<div class="card-grid" data-testid="search-posts">${results.posts.map(postCard).join('')}</div>`
      : `<p class="muted" data-testid="search-empty">No matching posts.</p>`;
  }

  return layout('Search', `<h1 style="margin-bottom:12px">Search</h1>${form}${tabs}${content}`);
}

/** A single user-directory card: last image as cover, avatar + username below. */
function userDirectoryCard(u: UserDirectoryEntry): string {
  const cover = u.lastImageUrl
    ? `<span class="cover"><img src="${escapeHtml(u.lastImageUrl)}" alt="" loading="lazy" /></span>`
    : `<span class="cover no-cover"></span>`;
  return `<a class="post-card user-card" href="/@${escapeHtml(u.username)}" data-testid="user-card">
    ${cover}
    <span class="body user-card-body">
      ${avatarImg(u.avatarUrl, u.displayName, 'user-card-avatar')}
      <span class="user-card-names">
        <span class="card-title">${escapeHtml(u.displayName)}</span>
        <span class="card-meta">@${escapeHtml(u.username)}</span>
      </span>
    </span>
  </a>`;
}

/** Explore page: a directory of all users (avatar, username, and last image). */
export function usersDirectoryPage(users: UserDirectoryEntry[]): string {
  const body = users.length
    ? `<div class="card-grid" data-testid="users-grid">${users
        .map(userDirectoryCard)
        .join('')}</div>`
    : `<p class="muted" data-testid="users-empty">No users yet.</p>`;
  return layout('Users', `<h1 style="margin-bottom:16px">Users</h1>${body}`);
}

/** Posts carrying a tag. */
export function tagPage(slug: string, cards: PostCard[]): string {
  const body =
    cards.length === 0
      ? `<p class="muted" data-testid="tag-empty">No posts with this tag yet.</p>`
      : `<div class="card-grid" data-testid="tag-posts">${cards.map(postCard).join('')}</div>`;
  return layout(`#${slug}`, `<h1 style="margin-bottom:16px">#${escapeHtml(slug)}</h1>${body}`);
}


/** Offline fallback page (served by the service worker when navigation fails). */
export function offlinePage(): string {
  return layout(
    'Offline',
    `<div class="card" data-testid="offline">
      <h1>You're offline</h1>
      <p class="muted">AstroSocial can't reach the server right now. Check your connection and try again.</p>
      <p><a href="/">Retry</a></p>
    </div>`
  );
}

/** Direct messages inbox. */
export function messagesInboxPage(items: ConversationSummary[]): string {
  const body =
    items.length === 0
      ? `<p class="muted" data-testid="dm-empty">No conversations yet. Visit a profile and tap Message to start one.</p>`
      : `<ul class="dm-list" data-testid="dm-conversations">
          ${items
            .map(
              (c) => `<li><a href="/messages/${escapeHtml(c.id)}" data-testid="dm-conversation">
            <span class="dm-row">
              <span class="dm-name">${escapeHtml(c.otherDisplayName)} <span class="muted">@${escapeHtml(c.otherUsername)}</span></span>
              ${c.unread > 0 ? `<span class="badge" data-testid="dm-unread">${c.unread}</span>` : ''}
            </span>
            <span class="dm-last muted">${escapeHtml(c.lastMessage ?? 'No messages yet')}</span>
          </a></li>`
            )
            .join('')}
        </ul>`;
  return layout('Messages', `<h1 style="margin-bottom:16px">Messages</h1>${body}`);
}

/** A single conversation thread with a composer. */
export function conversationPage(view: ConversationView): string {
  const thread =
    view.messages.length === 0
      ? `<p class="muted" data-testid="dm-thread-empty">Say hello 👋</p>`
      : view.messages
          .map(
            (m) => `<div class="dm-msg ${m.mine ? 'mine' : ''}" data-testid="dm-message">
        <span class="dm-bubble">${escapeHtml(m.body)}</span>
        ${m.mine ? `<button class="dm-del" type="button" data-msg-id="${escapeHtml(m.id)}" data-testid="dm-delete" aria-label="Delete message">×</button>` : ''}
      </div>`
          )
          .join('');

  return layout(
    view.otherDisplayName,
    `
  <h1 style="margin-bottom:14px"><a href="/@${escapeHtml(view.otherUsername)}">${escapeHtml(view.otherDisplayName)}</a></h1>
  <div class="dm-thread" data-testid="dm-thread">${thread}</div>
  <form id="dm-form" class="dm-compose">
    <input id="dm-input" data-testid="dm-input" placeholder="Start a message" autocomplete="off" aria-label="Message" />
    <button type="submit" data-testid="dm-send">Send</button>
  </form>
  <script>
    const convId = ${JSON.stringify(view.id)};
    document.getElementById('dm-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('dm-input');
      if (!input.value.trim()) return;
      const res = await fetch('/api/dm/conversations/' + convId + '/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.value }),
      });
      if (res.ok) window.location.reload();
    });
    document.querySelectorAll('[data-msg-id]').forEach((b) => {
      b.addEventListener('click', async () => {
        await fetch('/api/dm/messages/' + b.getAttribute('data-msg-id'), { method: 'DELETE' });
        window.location.reload();
      });
    });
  </script>
  `
  );
}

/** Themed 404 page. */
export function notFoundPage(message = 'Page not found'): string {
  return layout(
    'Not found',
    `<div class="card"><h1>404</h1><p class="muted">${escapeHtml(message)}</p>
     <p><a href="/">Go home</a></p></div>`
  );
}
