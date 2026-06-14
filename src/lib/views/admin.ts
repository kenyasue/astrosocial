/**
 * Server-rendered HTML pages for the admin console.
 *
 * Reuses the shared stylesheet and theme init/toggle (from `theme.ts`) and the
 * `escapeHtml` helper (from `pages.ts`), but renders its own minimal admin
 * chrome (header + section nav) rather than the social app shell. All
 * user-supplied values are HTML-escaped; destructive actions are POST forms.
 */
import { escapeHtml } from './pages';
import { THEME_INIT_SCRIPT, THEME_TOGGLE_SCRIPT } from './theme';
import type { Post, User } from '../types';
import type { SmtpSettings, SiteSettings } from '../services/SettingsService';
import type {
  AdminUserRow,
  AdminPostRow,
  AdminCommentRow,
} from '../db/repositories/AdminRepository';

/**
 * Minimal themed shell for the admin console. `authed` toggles the section nav +
 * logout; `active` marks the current section.
 */
function adminLayout(
  title: string,
  body: string,
  opts: { authed?: boolean; active?: string } = {}
): string {
  const link = (href: string, label: string, key: string): string =>
    `<a href="${href}" data-testid="admin-nav-${key}" aria-current="${
      opts.active === key ? 'page' : 'false'
    }">${label}</a>`;
  const nav = opts.authed
    ? `<nav class="admin-nav" aria-label="Admin sections">
        ${link('/admin', 'Dashboard', 'dashboard')}
        ${link('/admin/users', 'Users', 'users')}
        ${link('/admin/posts', 'Posts', 'posts')}
        ${link('/admin/comments', 'Comments', 'comments')}
        ${link('/admin/settings', 'Settings', 'settings')}
        <form method="POST" action="/admin/logout" class="admin-logout">
          <button type="submit" class="ghost" data-testid="admin-logout">Log out</button>
        </form>
      </nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · AstroSocial Admin</title>
  <link rel="stylesheet" href="/styles.css" />
  <meta name="theme-color" content="#0f1115" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <script>${THEME_INIT_SCRIPT}</script>
</head>
<body class="admin-body">
  <header class="admin-header">
    <a class="admin-brand" href="/admin"><span aria-hidden="true">🛰️</span> AstroSocial Admin</a>
    <button class="icon-btn" id="theme-toggle" data-testid="theme-toggle" type="button"
      aria-label="Toggle theme" title="Toggle theme"></button>
  </header>
  ${nav}
  <main class="admin-main">
    <div class="container">${body}</div>
  </main>
  <script>${THEME_TOGGLE_SCRIPT}</script>
</body>
</html>`;
}

/** Confirm-guarded POST delete button. */
function deleteForm(action: string, label: string, testid: string): string {
  return `<form method="POST" action="${action}" class="admin-inline"
      onsubmit="return confirm('Delete this ${label}? This cannot be undone.');">
      <button type="submit" class="ghost danger" data-testid="${testid}">Delete</button>
    </form>`;
}

/** Admin login form. `error` shows a failed-attempt message. */
export function adminLoginPage(error = false): string {
  return adminLayout(
    'Admin login',
    `
    <section class="hero"><h1>AstroSocial Admin</h1>
      <p class="subtitle">Sign in with the admin credentials.</p></section>
    <div class="card admin-card">
      ${error ? `<p class="error" role="alert" data-testid="admin-error">Invalid username or password.</p>` : ''}
      <form method="POST" action="/admin/login" data-testid="admin-login-form">
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button class="btn-full" type="submit">Log in</button>
      </form>
    </div>`
  );
}

/** Admin dashboard with counts + quick links. */
export function adminDashboardPage(stats: {
  users: number;
  posts: number;
  comments: number;
  smtpConfigured: boolean;
}): string {
  return adminLayout(
    'Dashboard',
    `
    <h1 style="margin-bottom:16px">Dashboard</h1>
    <div class="admin-stats" data-testid="admin-stats">
      <a class="card admin-stat" href="/admin/users"><strong>${stats.users}</strong><span>Users</span></a>
      <a class="card admin-stat" href="/admin/posts"><strong>${stats.posts}</strong><span>Posts</span></a>
      <a class="card admin-stat" href="/admin/comments"><strong>${stats.comments}</strong><span>Comments</span></a>
      <a class="card admin-stat" href="/admin/settings">
        <strong>${stats.smtpConfigured ? 'On' : 'Off'}</strong><span>SMTP email</span></a>
    </div>`,
    { authed: true, active: 'dashboard' }
  );
}

/** Admin users table with edit/delete actions. */
export function adminUsersPage(users: AdminUserRow[]): string {
  const rows = users
    .map(
      (u) => `<tr data-testid="admin-user-row">
      <td><a href="/@${escapeHtml(u.username)}">@${escapeHtml(u.username)}</a></td>
      <td>${escapeHtml(u.displayName)}</td>
      <td class="muted">${escapeHtml(u.email)}</td>
      <td>${u.postCount}</td>
      <td class="admin-actions">
        <a class="badge" href="/admin/users/${escapeHtml(u.id)}" data-testid="admin-user-edit">Edit</a>
        ${deleteForm(`/admin/users/${escapeHtml(u.id)}/delete`, 'user', 'admin-user-delete')}
      </td>
    </tr>`
    )
    .join('');
  const body = users.length
    ? `<div class="admin-table-wrap"><table class="admin-table" data-testid="admin-users">
        <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Posts</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<p class="muted" data-testid="admin-users-empty">No users.</p>`;
  return adminLayout('Users', `<h1 style="margin-bottom:16px">Users</h1>${body}`, {
    authed: true,
    active: 'users',
  });
}

/** Edit form for a single user's profile fields. */
export function adminUserEditPage(user: User): string {
  return adminLayout(
    'Edit user',
    `
    <h1 style="margin-bottom:16px">Edit @${escapeHtml(user.username)}</h1>
    <div class="card">
      <form method="POST" action="/admin/users/${escapeHtml(user.id)}" data-testid="admin-user-form">
        <label for="displayName">Display name</label>
        <input id="displayName" name="displayName" value="${escapeHtml(user.displayName)}" required />
        <label for="bio">Bio</label>
        <textarea id="bio" name="bio" rows="3">${escapeHtml(user.bio)}</textarea>
        <label for="websiteUrl">Website</label>
        <input id="websiteUrl" name="websiteUrl" value="${escapeHtml(user.websiteUrl)}" />
        <label for="location">Location</label>
        <input id="location" name="location" value="${escapeHtml(user.location)}" />
        <div class="admin-form-actions">
          <button type="submit" data-testid="admin-user-save">Save</button>
          <a class="badge" href="/admin/users">Cancel</a>
        </div>
      </form>
    </div>`,
    { authed: true, active: 'users' }
  );
}

/** Admin posts table with edit/delete actions. */
export function adminPostsPage(posts: AdminPostRow[]): string {
  const rows = posts
    .map(
      (p) => `<tr data-testid="admin-post-row">
      <td>${escapeHtml(p.title ?? 'Untitled')}</td>
      <td>@${escapeHtml(p.authorUsername)}</td>
      <td><span class="badge">${escapeHtml(p.status)}</span></td>
      <td>${p.commentCount}</td>
      <td class="admin-actions">
        <a class="badge" href="/admin/posts/${escapeHtml(p.id)}" data-testid="admin-post-edit">Edit</a>
        ${deleteForm(`/admin/posts/${escapeHtml(p.id)}/delete`, 'post', 'admin-post-delete')}
      </td>
    </tr>`
    )
    .join('');
  const body = posts.length
    ? `<div class="admin-table-wrap"><table class="admin-table" data-testid="admin-posts">
        <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Comments</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<p class="muted" data-testid="admin-posts-empty">No posts.</p>`;
  return adminLayout('Posts', `<h1 style="margin-bottom:16px">Posts</h1>${body}`, {
    authed: true,
    active: 'posts',
  });
}

/** Edit form for a single post (title + body). */
export function adminPostEditPage(post: Post): string {
  return adminLayout(
    'Edit post',
    `
    <h1 style="margin-bottom:16px">Edit post</h1>
    <div class="card">
      <form method="POST" action="/admin/posts/${escapeHtml(post.id)}" data-testid="admin-post-form">
        <label for="title">Title</label>
        <input id="title" name="title" value="${escapeHtml(post.title)}" />
        <label for="markdownBody">Body (Markdown)</label>
        <textarea id="markdownBody" name="markdownBody" rows="14" required>${escapeHtml(post.markdownBody)}</textarea>
        <div class="admin-form-actions">
          <button type="submit" data-testid="admin-post-save">Save</button>
          <a class="badge" href="/admin/posts">Cancel</a>
        </div>
      </form>
    </div>`,
    { authed: true, active: 'posts' }
  );
}

/** Admin comments table with delete actions. */
export function adminCommentsPage(comments: AdminCommentRow[]): string {
  const rows = comments
    .map(
      (c) => `<tr data-testid="admin-comment-row">
      <td>${escapeHtml(c.authorLabel)}</td>
      <td>${escapeHtml(c.body)}</td>
      <td><a href="${escapeHtml(c.postCanonicalPath)}">${escapeHtml(c.postTitle ?? 'Untitled')}</a></td>
      <td class="admin-actions">
        ${deleteForm(`/admin/comments/${escapeHtml(c.id)}/delete`, 'comment', 'admin-comment-delete')}
      </td>
    </tr>`
    )
    .join('');
  const body = comments.length
    ? `<div class="admin-table-wrap"><table class="admin-table" data-testid="admin-comments">
        <thead><tr><th>Author</th><th>Comment</th><th>Post</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<p class="muted" data-testid="admin-comments-empty">No comments.</p>`;
  return adminLayout('Comments', `<h1 style="margin-bottom:16px">Comments</h1>${body}`, {
    authed: true,
    active: 'comments',
  });
}

/**
 * Settings page: SMTP delivery + site identity / login-email template.
 * `saved` shows a success banner; `error` shows an SMTP validation problem.
 */
export function adminSettingsPage(
  smtp: SmtpSettings,
  site: SiteSettings,
  emailTemplate: string,
  saved = false,
  error = ''
): string {
  return adminLayout(
    'Settings',
    `
    <h1 style="margin-bottom:16px">Settings</h1>
    ${error ? `<p class="error" role="alert" data-testid="admin-settings-error">${escapeHtml(error)}</p>` : ''}
    ${saved ? `<p class="success" role="status" data-testid="admin-settings-saved">Settings saved.</p>` : ''}

    <div class="card" style="margin-bottom:18px">
      <h2 style="margin-top:0">Site &amp; login email</h2>
      <form method="POST" action="/admin/settings/site" data-testid="admin-site-form">
        <label for="siteName">Site name</label>
        <input id="siteName" name="siteName" value="${escapeHtml(site.name)}" placeholder="AstroSocial" />
        <label for="siteDescription">Site description</label>
        <input id="siteDescription" name="siteDescription" value="${escapeHtml(site.description)}"
          placeholder="A self-hosted social publishing platform" />
        <label for="emailTemplate">Login email template</label>
        <textarea id="emailTemplate" name="emailTemplate" rows="8" data-testid="admin-email-template"
          spellcheck="false">${escapeHtml(emailTemplate)}</textarea>
        <p class="muted" style="margin:-4px 0 8px;font-size:0.85rem">
          Body of the login PIN email. Tags: <code>{PIN}</code> (the one-time PIN) and
          <code>{sitename}</code> (the site name above).
        </p>
        <div class="admin-form-actions">
          <button type="submit" data-testid="admin-site-save">Save</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2 style="margin-top:0">SMTP delivery</h2>
      <p class="muted" style="margin-bottom:16px">Used to send login PIN emails. Leave the host blank to log PINs to the server console instead.</p>
      <form method="POST" action="/admin/settings" data-testid="admin-settings-form">
        <label for="host">SMTP host</label>
        <input id="host" name="host" value="${escapeHtml(smtp.host)}" placeholder="smtp.example.com" />
        <label for="port">Port</label>
        <input id="port" name="port" type="number" min="1" max="65535" value="${smtp.port || ''}" placeholder="587" />
        <label class="admin-check">
          <input type="checkbox" name="secure" value="true" ${smtp.secure ? 'checked' : ''} />
          Use implicit TLS (port 465)
        </label>
        <label for="username">Username</label>
        <input id="username" name="username" value="${escapeHtml(smtp.username)}" autocomplete="off" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" value="" autocomplete="off"
          placeholder="${smtp.password ? '••••••• (unchanged)' : ''}" />
        <p class="muted" style="margin:-4px 0 8px;font-size:0.85rem">Leave blank to keep the current password.</p>
        <label for="fromAddress">From address</label>
        <input id="fromAddress" name="fromAddress" type="email" value="${escapeHtml(smtp.fromAddress)}" placeholder="noreply@example.com" />
        <div class="admin-form-actions">
          <button type="submit" data-testid="admin-settings-save">Save</button>
        </div>
      </form>
    </div>`,
    { authed: true, active: 'settings' }
  );
}
