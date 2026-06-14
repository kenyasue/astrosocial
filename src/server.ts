/**
 * Minimal HTTP adapter over the service layer.
 *
 * Exposes the auth + profile JSON API and minimal HTML pages (login, profile,
 * settings) so the M1 flows are drivable in a browser and by Playwright. This
 * is a deliberate foundation-stage simplification: all business logic lives in
 * the framework-agnostic service layer, so these routes can later be replaced
 * by Next.js route handlers without changing behavior.
 */
import http from 'node:http';
import busboy from 'busboy';
import { buildApp } from './app';
import { config } from './lib/config/env';
import { AppError, AuthError, ValidationError } from './lib/types';
import {
  buildSessionCookie,
  buildClearSessionCookie,
  readSessionCookie,
  buildAdminCookie,
  buildClearAdminCookie,
  readAdminCookie,
} from './lib/auth/session';
import { toProfileView } from './lib/services/ProfileService';
import {
  loginPage,
  profilePage,
  settingsPage,
  notFoundPage,
  composePage,
  postDetailPage,
  draftsPage,
  libraryPage,
  mediaDetailPage,
  homePage,
  timelinePage,
  notificationsPage,
  bookmarksPage,
  searchPage,
  usersDirectoryPage,
  tagPage,
  offlinePage,
  messagesInboxPage,
  conversationPage,
  buildFeedPage,
  setShellContext,
  type ShellContext,
  STYLESHEET,
} from './lib/views/pages';
import {
  adminLoginPage,
  adminDashboardPage,
  adminUsersPage,
  adminUserEditPage,
  adminPostsPage,
  adminPostEditPage,
  adminCommentsPage,
  adminSettingsPage,
} from './lib/views/admin';
import { MANIFEST, SERVICE_WORKER, ICON_SVG, iconPng } from './lib/views/pwa';
import { buildRssFeed } from './lib/feed/rss';
import type { CreatePostInput, UpdatePostInput, UpdateProfileInput, DmPolicy } from './lib/types';
import { renderMarkdown } from './lib/markdown/render';

const app = buildApp();

// Warn loudly if the admin console is running with the default credentials.
if (!config.testMode && config.adminUsername === 'admin' && config.adminPassword === 'admin') {
  console.warn(
    '[admin] WARNING: using default admin credentials (admin/admin). ' +
      'Set ADMIN_USERNAME and ADMIN_PASSWORD before exposing this server.'
  );
}

/** Posts per page for the home "For you" feed and its infinite-scroll endpoint. */
const FEED_PAGE_SIZE = 12;

type Res = http.ServerResponse;

function sendJson(res: Res, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

function sendHtml(res: Res, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendError(res: Res, error: unknown): void {
  if (error instanceof AppError) {
    const statusByCode: Record<string, number> = {
      validation_error: 400,
      not_found: 404,
      permission_denied: 403,
      unauthenticated: 401,
      rate_limited: 429,
    };
    const status = statusByCode[error.code] ?? 400;
    sendJson(res, status, { error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Unexpected error:', error);
  sendJson(res, 500, { error: { code: 'internal_error', message: 'Something went wrong' } });
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        // Stop buffering immediately and tear down the socket to avoid a
        // slow/large-body memory-exhaustion DoS.
        req.destroy();
        reject(new AppError('Request body too large', 'validation_error'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new AppError('Invalid JSON body', 'validation_error'));
      }
    });
    req.on('error', reject);
  });
}

interface ParsedUpload {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/** Parse a single-file multipart/form-data upload, capping total bytes. */
function parseUpload(req: http.IncomingMessage, maxBytes: number): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: maxBytes } });
    } catch {
      reject(new ValidationError('Invalid upload', 'file'));
      return;
    }
    const chunks: Buffer[] = [];
    let info: { filename: string; mimeType: string } | null = null;
    let truncated = false;

    bb.on('file', (_name, stream, fileInfo) => {
      info = { filename: fileInfo.filename, mimeType: fileInfo.mimeType };
      stream.on('data', (d: Buffer) => chunks.push(d));
      stream.on('limit', () => {
        truncated = true;
        req.destroy(); // stop reading oversized uploads early
      });
    });
    bb.on('close', () => {
      if (!info) return reject(new ValidationError('No file uploaded', 'file'));
      if (truncated) return reject(new ValidationError('File is too large', 'file'));
      resolve({ fileName: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) });
    });
    bb.on('error', () => reject(new ValidationError('Invalid upload', 'file')));
    req.pipe(bb);
  });
}

function currentUser(req: http.IncomingMessage) {
  const token = readSessionCookie(req.headers.cookie);
  return app.auth.getCurrentUser(token);
}

/** Build the per-request shell context (Discover widget + unread badges). Best-effort. */
function buildShell(req: http.IncomingMessage): ShellContext {
  try {
    const viewer = currentUser(req);
    return {
      loggedIn: !!viewer,
      unreadNotifications: viewer ? app.notifications.unreadCount(viewer.id) : 0,
      unreadMessages: viewer ? app.dm.unreadCount(viewer.id) : 0,
    };
  } catch {
    return { loggedIn: false, unreadNotifications: 0, unreadMessages: 0 };
  }
}

/** Return the authenticated user or throw AuthError (→ 401). */
function requireUser(req: http.IncomingMessage) {
  const user = currentUser(req);
  if (!user) throw new AuthError();
  return user;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Parse an `application/x-www-form-urlencoded` request body (size-capped). */
async function readFormBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new AppError('Request body too large', 'validation_error'));
      }
    });
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', reject);
  });
}

/** Redirect helper (303 See Other — correct for POST→GET redirects). */
function redirect(res: Res, location: string, headers: Record<string, string> = {}): void {
  res.writeHead(303, { Location: location, ...headers });
  res.end();
}

/**
 * Require a valid admin session. Returns true when authorized; otherwise writes
 * a redirect to the admin login and returns false (callers should then return).
 */
function requireAdmin(req: http.IncomingMessage, res: Res): boolean {
  if (app.admin.validate(readAdminCookie(req.headers.cookie))) return true;
  redirect(res, '/admin/login');
  return false;
}

/**
 * Handle authenticated admin routes (caller has already verified the session).
 * Mutations follow the POST→redirect→GET pattern.
 */
async function handleAdmin(
  req: http.IncomingMessage,
  res: Res,
  pathname: string,
  method: string
): Promise<void> {
  if (pathname === '/admin' && method === 'GET') {
    return sendHtml(
      res,
      200,
      adminDashboardPage({
        users: app.admin.listUsers().length,
        posts: app.admin.listPosts().length,
        comments: app.admin.listComments().length,
        smtpConfigured: app.settings.isSmtpConfigured(),
      })
    );
  }

  // Users
  if (pathname === '/admin/users' && method === 'GET') {
    return sendHtml(res, 200, adminUsersPage(app.admin.listUsers()));
  }
  const userDelete = pathname.match(/^\/admin\/users\/([^/]+)\/delete$/);
  if (userDelete && method === 'POST') {
    app.admin.deleteUser(userDelete[1]);
    return redirect(res, '/admin/users');
  }
  const userMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
  if (userMatch && method === 'GET') {
    return sendHtml(res, 200, adminUserEditPage(app.admin.getUser(userMatch[1])));
  }
  if (userMatch && method === 'POST') {
    const form = await readFormBody(req);
    app.admin.updateUser(userMatch[1], {
      displayName: str(form.get('displayName')),
      bio: str(form.get('bio')) || null,
      websiteUrl: str(form.get('websiteUrl')) || null,
      location: str(form.get('location')) || null,
    });
    return redirect(res, '/admin/users');
  }

  // Posts
  if (pathname === '/admin/posts' && method === 'GET') {
    return sendHtml(res, 200, adminPostsPage(app.admin.listPosts()));
  }
  const postDelete = pathname.match(/^\/admin\/posts\/([^/]+)\/delete$/);
  if (postDelete && method === 'POST') {
    app.admin.deletePost(postDelete[1]);
    return redirect(res, '/admin/posts');
  }
  const postMatch = pathname.match(/^\/admin\/posts\/([^/]+)$/);
  if (postMatch && method === 'GET') {
    return sendHtml(res, 200, adminPostEditPage(app.admin.getPost(postMatch[1])));
  }
  if (postMatch && method === 'POST') {
    const form = await readFormBody(req);
    app.admin.updatePost(postMatch[1], {
      title: str(form.get('title')),
      markdownBody: str(form.get('markdownBody')),
    });
    return redirect(res, '/admin/posts');
  }

  // Comments
  if (pathname === '/admin/comments' && method === 'GET') {
    return sendHtml(res, 200, adminCommentsPage(app.admin.listComments()));
  }
  const commentDelete = pathname.match(/^\/admin\/comments\/([^/]+)\/delete$/);
  if (commentDelete && method === 'POST') {
    app.admin.deleteComment(commentDelete[1]);
    return redirect(res, '/admin/comments');
  }

  // Settings
  if (pathname === '/admin/settings' && method === 'GET') {
    const saved = new URL(req.url ?? '/', 'http://localhost').searchParams.get('saved') === '1';
    return sendHtml(
      res,
      200,
      adminSettingsPage(app.admin.getSmtp(), app.admin.getSite(), app.admin.getEmailTemplate(), saved)
    );
  }
  if (pathname === '/admin/settings' && method === 'POST') {
    const form = await readFormBody(req);
    // A blank password field keeps the currently stored password rather than
    // clearing it (the form never renders the stored secret back to the client).
    const submittedPassword = str(form.get('password'));
    const input = {
      host: str(form.get('host')),
      port: Number.parseInt(str(form.get('port')), 10) || 0,
      secure: form.get('secure') === 'true',
      username: str(form.get('username')),
      password: submittedPassword || app.admin.getSmtp().password,
      fromAddress: str(form.get('fromAddress')),
    };
    try {
      app.admin.saveSmtp(input);
    } catch (error) {
      if (error instanceof ValidationError) {
        return sendHtml(
          res,
          400,
          adminSettingsPage(input, app.admin.getSite(), app.admin.getEmailTemplate(), false, error.message)
        );
      }
      throw error;
    }
    return redirect(res, '/admin/settings?saved=1');
  }
  if (pathname === '/admin/settings/site' && method === 'POST') {
    const form = await readFormBody(req);
    app.admin.saveGeneral({
      siteName: str(form.get('siteName')),
      siteDescription: str(form.get('siteDescription')),
      emailTemplate: str(form.get('emailTemplate')),
    });
    return redirect(res, '/admin/settings?saved=1');
  }

  return sendHtml(res, 404, notFoundPage('Admin page not found'));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const { pathname } = url;
    const method = req.method ?? 'GET';

    // Build the per-request shell context for page (HTML) GETs only. Page renders
    // are fully synchronous, so this module-level context cannot interleave.
    const isPageGet =
      method === 'GET' &&
      !pathname.startsWith('/api/') &&
      !/\.(css|js|png|svg|webmanifest|xml)$/.test(pathname) &&
      pathname !== '/sw.js' &&
      pathname !== '/manifest.webmanifest';
    setShellContext(isPageGet ? buildShell(req) : null);

    // --- API routes ---------------------------------------------------------
    if (pathname === '/api/auth/request-pin' && method === 'POST') {
      const body = await readJsonBody(req);
      await app.auth.requestPin(str(body.email));
      return sendJson(res, 204, {});
    }

    if (pathname === '/api/auth/verify-pin' && method === 'POST') {
      const body = await readJsonBody(req);
      const { user, sessionToken } = await app.auth.verifyPin(str(body.email), str(body.pin));
      return sendJson(res, 200, { user: publicUser(user) }, { 'Set-Cookie': buildSessionCookie(sessionToken) });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      app.auth.logout(readSessionCookie(req.headers.cookie));
      return sendJson(res, 204, {}, { 'Set-Cookie': buildClearSessionCookie() });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = currentUser(req);
      if (!user) throw new AuthError();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (pathname === '/api/profile' && method === 'PUT') {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      const input: UpdateProfileInput = {};
      if ('displayName' in body) input.displayName = str(body.displayName);
      if ('bio' in body) input.bio = str(body.bio);
      if ('websiteUrl' in body) input.websiteUrl = str(body.websiteUrl);
      if ('location' in body) input.location = str(body.location);
      if ('dmPolicy' in body) input.dmPolicy = str(body.dmPolicy) as DmPolicy;
      // An empty string explicitly clears the avatar/cover; a set value is a
      // media public id resolved + ownership-checked in ProfileService.
      if ('avatarMediaId' in body) input.avatarMediaId = str(body.avatarMediaId) || null;
      if ('coverMediaId' in body) input.coverMediaId = str(body.coverMediaId) || null;
      const updated = app.profiles.updateProfile(user.id, input);
      return sendJson(res, 200, { user: publicUser(updated) });
    }

    const profileApi = pathname.match(/^\/api\/profile\/([^/]+)$/);
    if (profileApi && method === 'GET') {
      const profile = app.profiles.getPublicProfile(decodeURIComponent(profileApi[1]));
      return sendJson(res, 200, { profile });
    }

    // --- Markdown preview ---------------------------------------------------
    if (pathname === '/api/render' && method === 'POST') {
      requireUser(req);
      const body = await readJsonBody(req);
      return sendJson(res, 200, { html: renderMarkdown(str(body.markdown)) });
    }

    // --- Media API + serving ------------------------------------------------
    if (pathname === '/api/media/upload' && method === 'POST') {
      const user = requireUser(req);
      const parsed = await parseUpload(req, config.maxVideoBytes);
      const media = await app.media.upload(user.id, parsed);
      return sendJson(res, 201, { media: app.media.toView(media) });
    }

    if (pathname === '/api/media' && method === 'GET') {
      const user = requireUser(req);
      return sendJson(res, 200, { items: app.media.list(user.id) });
    }

    const mediaApiMatch = pathname.match(/^\/api\/media\/([^/]+)$/);
    if (mediaApiMatch && method === 'DELETE') {
      const user = requireUser(req);
      app.media.delete(user.id, mediaApiMatch[1]);
      return sendJson(res, 204, {});
    }

    const mediaFileMatch = pathname.match(/^\/media\/([^/]+)\/(original|thumbnail)$/);
    if (mediaFileMatch && method === 'GET') {
      const viewer = currentUser(req);
      const variant = mediaFileMatch[2] as 'original' | 'thumbnail';
      const file = app.media.getForServing(mediaFileMatch[1], variant, viewer?.id ?? null);
      res.writeHead(200, {
        'Content-Type': file.mimeType,
        'Content-Length': file.buffer.length,
        // Never let shared caches store non-public bytes.
        'Cache-Control': file.visibility === 'public' ? 'public, max-age=86400' : 'private, no-cache',
      });
      return res.end(file.buffer);
    }

    // --- Posts API ----------------------------------------------------------
    if (pathname === '/api/posts' && method === 'POST') {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      const input: CreatePostInput = {
        title: typeof body.title === 'string' ? body.title : null,
        markdownBody: str(body.markdownBody),
        excerpt: typeof body.excerpt === 'string' ? body.excerpt : undefined,
        status: body.status === 'published' ? 'published' : 'draft',
        coverMediaId: typeof body.coverMediaId === 'string' ? body.coverMediaId : null,
        quotePostId: typeof body.quotePostId === 'string' ? body.quotePostId : null,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string')
          : undefined,
      };
      return sendJson(res, 201, { post: app.posts.create(user.id, input) });
    }

    if (pathname === '/api/posts' && method === 'GET') {
      if (url.searchParams.get('scope') === 'mine') {
        const user = requireUser(req);
        return sendJson(res, 200, { items: app.posts.listOwn(user.id) });
      }
      const cursor = url.searchParams.get('cursor') ?? undefined;
      return sendJson(res, 200, { items: app.posts.listFeed(20, cursor) });
    }

    // Next page of the home "For you" feed as rendered card HTML, for the
    // infinite-scroll client. Returns an empty page for any other tab.
    if (pathname === '/api/feed' && method === 'GET') {
      if (url.searchParams.get('tab') !== 'foryou') {
        return sendJson(res, 200, { html: '', nextCursor: null });
      }
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const feed = app.posts.listFeed(FEED_PAGE_SIZE, cursor);
      // Feed content changes as posts are published; keep proxies from serving
      // a stale page (consistent with the stylesheet's no-cache policy).
      return sendJson(res, 200, buildFeedPage(feed, FEED_PAGE_SIZE), {
        'Cache-Control': 'private, no-cache',
      });
    }

    const publishMatch = pathname.match(/^\/api\/posts\/([^/]+)\/publish$/);
    if (publishMatch && method === 'POST') {
      const user = requireUser(req);
      return sendJson(res, 200, { post: app.posts.publish(user.id, publishMatch[1]) });
    }

    const archiveMatch = pathname.match(/^\/api\/posts\/([^/]+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      const user = requireUser(req);
      return sendJson(res, 200, { post: app.posts.archive(user.id, archiveMatch[1]) });
    }

    // --- Social: likes / reactions / comments -------------------------------
    const likeMatch = pathname.match(/^\/api\/posts\/([^/]+)\/like$/);
    if (likeMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireUser(req);
      if (method === 'POST') app.social.like(user.id, likeMatch[1]);
      else app.social.unlike(user.id, likeMatch[1]);
      return sendJson(res, 200, { social: app.social.getPostSocial(likeMatch[1], user.id) });
    }

    const reactionMatch = pathname.match(/^\/api\/posts\/([^/]+)\/reactions$/);
    if (reactionMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      const emoji = str(body.emoji);
      if (method === 'POST') app.social.react(user.id, reactionMatch[1], emoji);
      else app.social.unreact(user.id, reactionMatch[1], emoji);
      return sendJson(res, 200, { social: app.social.getPostSocial(reactionMatch[1], user.id) });
    }

    const repostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/repost$/);
    if (repostMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireUser(req);
      if (method === 'POST') app.social.repost(user.id, repostMatch[1]);
      else app.social.unrepost(user.id, repostMatch[1]);
      return sendJson(res, 200, { social: app.social.getPostSocial(repostMatch[1], user.id) });
    }

    const bookmarkMatch = pathname.match(/^\/api\/posts\/([^/]+)\/bookmark$/);
    if (bookmarkMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireUser(req);
      if (method === 'POST') app.social.bookmark(user.id, bookmarkMatch[1]);
      else app.social.unbookmark(user.id, bookmarkMatch[1]);
      return sendJson(res, 200, { social: app.social.getPostSocial(bookmarkMatch[1], user.id) });
    }

    const commentsMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (commentsMatch && method === 'POST') {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      return sendJson(res, 201, { comment: app.social.comment(user.id, commentsMatch[1], str(body.body)) });
    }
    if (commentsMatch && method === 'GET') {
      return sendJson(res, 200, { items: app.social.listComments(commentsMatch[1]) });
    }

    const commentDelMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
    if (commentDelMatch && method === 'DELETE') {
      const user = requireUser(req);
      app.social.deleteComment(user.id, commentDelMatch[1]);
      return sendJson(res, 204, {});
    }

    // --- Direct messages API -----------------------------------------------
    if (pathname === '/api/dm/conversations' && method === 'POST') {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      const id = app.dm.startConversation(user.id, str(body.username));
      return sendJson(res, 201, { conversationId: id });
    }
    if (pathname === '/api/dm/conversations' && method === 'GET') {
      const user = requireUser(req);
      return sendJson(res, 200, { items: app.dm.listInbox(user.id) });
    }
    const dmMsgMatch = pathname.match(/^\/api\/dm\/conversations\/([^/]+)\/messages$/);
    if (dmMsgMatch && method === 'POST') {
      const user = requireUser(req);
      const body = await readJsonBody(req);
      return sendJson(res, 201, { message: app.dm.sendMessage(user.id, dmMsgMatch[1], str(body.body)) });
    }
    const dmReadMatch = pathname.match(/^\/api\/dm\/conversations\/([^/]+)\/read$/);
    if (dmReadMatch && method === 'POST') {
      const user = requireUser(req);
      app.dm.markRead(user.id, dmReadMatch[1]);
      return sendJson(res, 204, {});
    }
    const dmDelMatch = pathname.match(/^\/api\/dm\/messages\/([^/]+)$/);
    if (dmDelMatch && method === 'DELETE') {
      const user = requireUser(req);
      app.dm.deleteMessage(user.id, dmDelMatch[1]);
      return sendJson(res, 204, {});
    }

    // --- Notifications ------------------------------------------------------
    if (pathname === '/api/notifications/read-all' && method === 'POST') {
      const user = requireUser(req);
      app.notifications.markAllRead(user.id);
      return sendJson(res, 204, {});
    }
    const notifReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (notifReadMatch && method === 'POST') {
      const user = requireUser(req);
      app.notifications.markRead(user.id, notifReadMatch[1]);
      return sendJson(res, 204, {});
    }

    const followMatch = pathname.match(/^\/api\/users\/([^/]+)\/follow$/);
    if (followMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireUser(req);
      const username = decodeURIComponent(followMatch[1]);
      if (method === 'POST') app.social.follow(user.id, username);
      else app.social.unfollow(user.id, username);
      return sendJson(res, 200, { following: app.social.isFollowing(user.id, username) });
    }

    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch) {
      const publicId = postMatch[1];
      if (method === 'GET') {
        const viewer = currentUser(req);
        return sendJson(res, 200, { post: app.posts.getByPublicId(publicId, viewer?.id ?? null) });
      }
      if (method === 'PUT') {
        const user = requireUser(req);
        const body = await readJsonBody(req);
        const input: UpdatePostInput = {};
        if ('title' in body) input.title = typeof body.title === 'string' ? body.title : null;
        if ('markdownBody' in body) input.markdownBody = str(body.markdownBody);
        if ('excerpt' in body) input.excerpt = typeof body.excerpt === 'string' ? body.excerpt : null;
        if ('coverMediaId' in body)
          input.coverMediaId = typeof body.coverMediaId === 'string' ? body.coverMediaId : null;
        return sendJson(res, 200, { post: app.posts.update(user.id, publicId, input) });
      }
      if (method === 'DELETE') {
        const user = requireUser(req);
        app.posts.delete(user.id, publicId);
        return sendJson(res, 204, {});
      }
    }

    // --- Discovery pages ----------------------------------------------------
    if (pathname === '/search' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const tab = url.searchParams.get('tab') ?? 'top';
      return sendHtml(res, 200, searchPage(q, app.search.query(q, tab), app.search.suggestions()));
    }

    if (pathname === '/trends' && method === 'GET') {
      res.writeHead(302, { Location: '/explore' });
      return res.end();
    }

    if (pathname === '/explore' && method === 'GET') {
      return sendHtml(res, 200, usersDirectoryPage(app.discovery.userDirectory()));
    }

    // --- Admin console ------------------------------------------------------
    if (pathname === '/admin/login' && method === 'GET') {
      if (app.admin.validate(readAdminCookie(req.headers.cookie))) return redirect(res, '/admin');
      return sendHtml(res, 200, adminLoginPage(url.searchParams.get('error') === '1'));
    }
    if (pathname === '/admin/login' && method === 'POST') {
      const form = await readFormBody(req);
      const token = app.admin.login(str(form.get('username')), str(form.get('password')));
      if (!token) return redirect(res, '/admin/login?error=1');
      return redirect(res, '/admin', { 'Set-Cookie': buildAdminCookie(token) });
    }
    if (pathname === '/admin/logout' && method === 'POST') {
      app.admin.logout(readAdminCookie(req.headers.cookie));
      return redirect(res, '/admin/login', { 'Set-Cookie': buildClearAdminCookie() });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      // Everything below requires a valid admin session.
      if (!requireAdmin(req, res)) return;
      try {
        return await handleAdmin(req, res, pathname, method);
      } catch (error) {
        // Missing user/post → back to the relevant list rather than a JSON error.
        if (error instanceof AppError && error.code === 'not_found') {
          return redirect(res, '/admin');
        }
        throw error;
      }
    }

    const tagPageMatch = pathname.match(/^\/tags\/([^/]+)$/);
    if (tagPageMatch && method === 'GET') {
      const slug = decodeURIComponent(tagPageMatch[1]);
      return sendHtml(res, 200, tagPage(slug, app.search.postsByTag(slug)));
    }

    // --- RSS feed -----------------------------------------------------------
    if (pathname === '/rss.xml' && method === 'GET') {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host ?? `localhost:${config.port}`;
      const xml = buildRssFeed(app.posts.listFeed(20), `${proto}://${host}`);
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      return res.end(xml);
    }

    // --- PWA assets ---------------------------------------------------------
    if (pathname === '/manifest.webmanifest' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
      return res.end(MANIFEST);
    }
    if (pathname === '/sw.js' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/',
        'Cache-Control': 'no-cache',
      });
      return res.end(SERVICE_WORKER);
    }
    if (pathname === '/icon.svg' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
      return res.end(ICON_SVG);
    }
    const iconMatch = pathname.match(/^\/icon-(192|512)\.png$/);
    if (iconMatch && method === 'GET') {
      const png = await iconPng(Number(iconMatch[1]));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      return res.end(png);
    }
    if (pathname === '/offline' && method === 'GET') {
      return sendHtml(res, 200, offlinePage());
    }

    // --- Static styles ------------------------------------------------------
    if (pathname === '/styles.css' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/css; charset=utf-8',
        // The CSS is generated from a template with no content-hash in the URL,
        // so tell the browser to revalidate rather than serve a stale copy.
        'Cache-Control': 'no-cache',
      });
      return res.end(STYLESHEET);
    }

    // --- HTML pages ---------------------------------------------------------
    if (pathname === '/' && method === 'GET') {
      const limit = FEED_PAGE_SIZE;
      const viewer = currentUser(req);
      const tab = url.searchParams.get('tab') === 'following' && viewer ? 'following' : 'foryou';
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const feed = tab === 'foryou' ? app.posts.listFeed(limit, cursor) : [];
      const nextCursor =
        feed.length === limit ? (feed[feed.length - 1].publishedAt ?? null) : null;
      const timeline = tab === 'following' && viewer ? app.social.timeline(viewer.id) : [];
      return sendHtml(
        res,
        200,
        homePage({ tab, loggedIn: !!viewer, feed, nextCursor, timeline })
      );
    }

    if (pathname === '/login' && method === 'GET') {
      return sendHtml(res, 200, loginPage(config.testMode, app.admin.getSite()));
    }

    if (pathname === '/settings' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, settingsPage(toProfileView(user)));
    }

    if (pathname === '/compose' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      const editId = url.searchParams.get('id');
      if (editId) {
        try {
          const post = app.posts.getEditable(user.id, editId);
          const coverView = post.coverMediaId
            ? app.media.getViewByInternalId(post.coverMediaId)
            : null;
          const cover = coverView
            ? { publicId: coverView.publicId, url: coverView.originalUrl }
            : null;
          return sendHtml(res, 200, composePage(post, cover));
        } catch {
          return sendHtml(res, 404, notFoundPage('Post not found'));
        }
      }
      const quoteId = url.searchParams.get('quote');
      if (quoteId) {
        try {
          const quoted = app.posts.getByPublicId(quoteId, user.id);
          return sendHtml(res, 200, composePage(null, null, quoted));
        } catch {
          /* fall through to a blank compose if the quoted post is missing */
        }
      }
      return sendHtml(res, 200, composePage(null));
    }

    if (pathname === '/library' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, libraryPage(app.media.list(user.id)));
    }

    if (pathname === '/messages' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, messagesInboxPage(app.dm.listInbox(user.id)));
    }

    const dmWithMatch = pathname.match(/^\/messages\/with\/([^/]+)$/);
    if (dmWithMatch && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      try {
        const id = app.dm.startConversation(user.id, decodeURIComponent(dmWithMatch[1]));
        res.writeHead(302, { Location: `/messages/${id}` });
        return res.end();
      } catch (error) {
        if (error instanceof AppError && error.code === 'permission_denied') {
          return sendHtml(res, 403, notFoundPage('This user does not accept messages from you'));
        }
        if (error instanceof AppError && error.code === 'not_found') {
          return sendHtml(res, 404, notFoundPage('User not found'));
        }
        throw error;
      }
    }

    const dmThreadMatch = pathname.match(/^\/messages\/([^/]+)$/);
    if (dmThreadMatch && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      try {
        return sendHtml(res, 200, conversationPage(app.dm.getConversation(user.id, dmThreadMatch[1])));
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          return sendHtml(res, 404, notFoundPage('Conversation not found'));
        }
        throw error;
      }
    }

    const notifOpenMatch = pathname.match(/^\/n\/([^/]+)$/);
    if (notifOpenMatch && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      const target = app.notifications.openAndResolveTarget(user.id, notifOpenMatch[1]);
      res.writeHead(302, { Location: target ?? '/notifications' });
      return res.end();
    }

    if (pathname === '/notifications' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      const tab = url.searchParams.get('tab') === 'mentions' ? 'mentions' : 'all';
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const { items, nextCursor } = app.notifications.list(user.id, tab, cursor);
      return sendHtml(res, 200, notificationsPage(items, tab, nextCursor));
    }

    if (pathname === '/bookmarks' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, bookmarksPage(app.social.listBookmarks(user.id)));
    }

    if (pathname === '/timeline' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, timelinePage(app.social.timeline(user.id)));
    }

    if (pathname === '/drafts' && method === 'GET') {
      const user = currentUser(req);
      if (!user) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return sendHtml(res, 200, draftsPage(app.posts.listOwn(user.id)));
    }

    const postPageMatch = pathname.match(/^\/@([^/]+)\/posts\/([^/]+)$/);
    if (postPageMatch && method === 'GET') {
      const username = decodeURIComponent(postPageMatch[1]);
      const slug = decodeURIComponent(postPageMatch[2]);
      const viewer = currentUser(req);
      try {
        const view = app.posts.getByCanonicalPath(`/@${username}/posts/${slug}`, viewer?.id ?? null);
        const social = app.social.getPostSocial(view.publicId, viewer?.id ?? null);
        const comments = app.social.listComments(view.publicId);
        const isOwner = viewer?.id === view.userId;
        const author = app.profiles.getPublicProfile(view.authorUsername);
        const latest = app.posts
          .listFeed(7)
          .filter((c) => c.publicId !== view.publicId)
          .slice(0, 6);
        const isFollowing =
          viewer && !isOwner ? app.social.isFollowing(viewer.id, view.authorUsername) : false;
        return sendHtml(
          res,
          200,
          postDetailPage(
            view,
            isOwner,
            social,
            comments,
            !!viewer,
            viewer?.username ?? null,
            author,
            latest,
            isFollowing
          )
        );
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          return sendHtml(res, 404, notFoundPage('Post not found'));
        }
        throw error;
      }
    }

    const mediaPageMatch = pathname.match(/^\/@([^/]+)\/media\/([^/]+)$/);
    if (mediaPageMatch && method === 'GET') {
      const username = decodeURIComponent(mediaPageMatch[1]);
      const viewer = currentUser(req);
      try {
        const view = app.media.getDetail(mediaPageMatch[2], viewer?.id ?? null);
        if (view.ownerUsername !== username) {
          return sendHtml(res, 404, notFoundPage('Media not found'));
        }
        return sendHtml(res, 200, mediaDetailPage(view, viewer?.id === view.userId));
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          return sendHtml(res, 404, notFoundPage('Media not found'));
        }
        throw error;
      }
    }

    const profilePageMatch = pathname.match(/^\/@([^/]+)$/);
    if (profilePageMatch && method === 'GET') {
      const username = decodeURIComponent(profilePageMatch[1]);
      try {
        const profile = app.profiles.getPublicProfile(username);
        const viewer = currentUser(req);
        const posts = app.posts.listPublishedByUsername(username);
        const isOwner = viewer?.username === username;
        const isFollowing =
          viewer && !isOwner ? app.social.isFollowing(viewer.id, username) : false;
        return sendHtml(
          res,
          200,
          profilePage(profile, isOwner, posts, { loggedIn: !!viewer, isFollowing })
        );
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          return sendHtml(res, 404, notFoundPage('User not found'));
        }
        throw error;
      }
    }

    sendJson(res, 404, { error: { code: 'not_found', message: 'Not found' } });
  } catch (error) {
    sendError(res, error);
  }
});

function publicUser(user: { id: string; email: string; username: string; displayName: string }) {
  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName };
}

// Bound how long a client may take to send a full request, mitigating
// slow-client connection-holding attacks.
server.requestTimeout = 15_000;

server.listen(config.port, () => {
  console.log(
    `AstroSocial listening on http://localhost:${config.port}` +
      (config.testMode ? ' [TEST MODE: PIN is always 000000]' : '')
  );
});
