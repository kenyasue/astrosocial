/**
 * Admin service: a single constant admin account (credentials from the
 * environment), an in-memory session store, and moderation operations over
 * users, posts, and comments plus SMTP settings.
 *
 * The admin is intentionally NOT a database user; it authenticates against
 * `config.adminUsername`/`config.adminPassword` using a constant-time compare.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env';
import { NotFoundError, type Post, type User } from '../types';
import { excerptFromMarkdown } from '../markdown/render';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { CommentRepository } from '../db/repositories/CommentRepository';
import type {
  AdminRepository,
  AdminUserRow,
  AdminPostRow,
  AdminCommentRow,
} from '../db/repositories/AdminRepository';
import type {
  SettingsService,
  SmtpSettings,
  SiteSettings,
  GeneralSettings,
} from './SettingsService';

export interface AdminUserEdit {
  displayName?: string;
  bio?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
}

export interface AdminPostEdit {
  title?: string | null;
  markdownBody?: string;
}

export class AdminService {
  /** Active admin sessions: token hash → absolute expiry (ms since epoch). */
  private readonly sessions = new Map<string, number>();

  constructor(
    private readonly admin: AdminRepository,
    private readonly users: UserRepository,
    private readonly posts: PostRepository,
    private readonly comments: CommentRepository,
    private readonly settings: SettingsService
  ) {}

  // --- authentication -------------------------------------------------------

  /**
   * Verify admin credentials (constant-time) and, on success, open a session
   * and return its raw token. Returns null on failure.
   */
  login(username: string, password: string): string | null {
    const okUser = constantTimeEquals(username, config.adminUsername);
    const okPass = constantTimeEquals(password, config.adminPassword);
    // Evaluate both before branching so timing does not reveal which failed.
    if (!okUser || !okPass) return null;

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + config.adminSessionTtlHours * 3_600_000;
    this.sessions.set(hashToken(token), expiresAt);
    return token;
  }

  /** True if the raw token maps to a live (non-expired) admin session. */
  validate(token: string | null): boolean {
    if (!token) return false;
    const key = hashToken(token);
    const expiresAt = this.sessions.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt < Date.now()) {
      this.sessions.delete(key);
      return false;
    }
    return true;
  }

  /** Invalidate an admin session by its raw token. */
  logout(token: string | null): void {
    if (token) this.sessions.delete(hashToken(token));
  }

  // --- moderation: read -----------------------------------------------------

  listUsers(limit = 200): AdminUserRow[] {
    return this.admin.listUsers(limit);
  }

  listPosts(limit = 200): AdminPostRow[] {
    return this.admin.listPosts(limit);
  }

  listComments(limit = 200): AdminCommentRow[] {
    return this.admin.listComments(limit);
  }

  getUser(id: string): User {
    const user = this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  getPost(id: string): Post {
    const post = this.posts.findById(id);
    if (!post) throw new NotFoundError('Post not found');
    return post;
  }

  // --- moderation: write ----------------------------------------------------

  updateUser(id: string, edit: AdminUserEdit): User {
    this.getUser(id); // 404 if missing
    const updated = this.users.updateProfile(
      id,
      edit as Parameters<UserRepository['updateProfile']>[1]
    );
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }

  updatePost(id: string, edit: AdminPostEdit): Post {
    const post = this.getPost(id);
    const fields: Partial<{ title: string | null; markdownBody: string; excerpt: string | null }> = {};
    if ('title' in edit) fields.title = (edit.title ?? '').trim() || null;
    if ('markdownBody' in edit) {
      const body = (edit.markdownBody ?? '').trim() || post.markdownBody;
      fields.markdownBody = body;
      fields.excerpt = excerptFromMarkdown(body);
    }
    return this.posts.update(id, fields) ?? post;
  }

  deleteUser(id: string): void {
    const user = this.getUser(id);
    this.admin.deleteUserCascade(user.id, user.email);
  }

  deletePost(id: string): void {
    this.getPost(id); // 404 if missing
    this.posts.deleteWithDependents(id);
  }

  deleteComment(id: string): void {
    this.comments.delete(id);
  }

  // --- settings -------------------------------------------------------------

  getSmtp(): SmtpSettings {
    return this.settings.getSmtp();
  }

  saveSmtp(input: SmtpSettings): void {
    this.settings.saveSmtp(input);
  }

  getSite(): SiteSettings {
    return this.settings.getSite();
  }

  getEmailTemplate(): string {
    return this.settings.getEmailTemplate();
  }

  saveGeneral(input: GeneralSettings): void {
    this.settings.saveGeneral(input);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time string compare. Both inputs are hashed to fixed-length SHA-256
 * digests so `timingSafeEqual` always receives equal-length buffers (it throws
 * on a length mismatch) and the comparison time does not depend on the inputs'
 * lengths or contents. Equal digests imply equal inputs (collision-resistant).
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ah = createHash('sha256').update(Buffer.from(a)).digest();
  const bh = createHash('sha256').update(Buffer.from(b)).digest();
  return timingSafeEqual(ah, bh);
}
