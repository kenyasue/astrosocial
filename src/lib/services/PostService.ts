/**
 * Post service: create/edit/publish/archive/delete posts and prepare them for
 * display. Generates public id, slug, and canonical path; enforces ownership;
 * renders Markdown to sanitized HTML. All business rules live here.
 */
import type {
  CreatePostInput,
  Post,
  PostCard,
  PostView,
  QuotedPost,
  UpdatePostInput,
} from '../types';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import { generatePublicId } from '../urls/publicId';
import { generateSlug } from '../urls/slug';
import { postCanonicalPath } from '../urls/canonicalPath';
import { renderMarkdown, excerptFromMarkdown } from '../markdown/render';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { MediaRepository } from '../db/repositories/MediaRepository';
import type { TagRepository } from '../db/repositories/TagRepository';
import type { NotificationService } from './NotificationService';

const MAX_TITLE = 200;

export class PostService {
  constructor(
    private readonly posts: PostRepository,
    private readonly users: UserRepository,
    private readonly media: MediaRepository,
    private readonly notifier?: NotificationService,
    private readonly tags?: TagRepository
  ) {}

  create(userId: string, input: CreatePostInput): Post {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const body = (input.markdownBody ?? '').trim();
    if (!body) throw new ValidationError('Post body cannot be empty', 'markdownBody');
    const title = normalizeTitle(input.title);

    const quoted = input.quotePostId ? this.posts.findByPublicId(input.quotePostId) : null;
    if (input.quotePostId && !quoted) throw new ValidationError('Quoted post not found', 'quotePostId');

    const publicId = generatePublicId('p');
    const slug = generateSlug(title, publicId, (s) => this.posts.slugExistsForUser(userId, s));
    const status = input.status ?? 'draft';
    const now = new Date().toISOString();

    const post = this.posts.create({
      publicId,
      userId,
      title,
      slug,
      canonicalPath: postCanonicalPath(user.username, slug),
      markdownBody: body,
      excerpt: input.excerpt?.trim() || excerptFromMarkdown(body),
      status,
      publishedAt: status === 'published' ? now : null,
      coverMediaId: this.resolveCover(input.coverMediaId, userId),
      quotePostId: quoted?.id ?? null,
    });

    if (quoted && quoted.userId !== userId) {
      this.notifier?.notify(quoted.userId, userId, 'quote_post', { postId: post.id });
    }
    this.applyTags(post.id, input.tags);
    return post;
  }

  /** Find-or-create the given tag names and attach them to the post. */
  private applyTags(postId: string, tagNames: string[] | undefined): void {
    if (!this.tags || !tagNames) return;
    const seen = new Set<string>();
    for (const raw of tagNames) {
      const name = raw.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const tag = this.tags.findOrCreate(name);
      this.tags.attachToPost(postId, tag.id);
    }
  }

  update(userId: string, publicId: string, input: UpdatePostInput): Post {
    const post = this.requireOwned(publicId, userId);
    const fields: Partial<{
      title: string | null;
      markdownBody: string;
      excerpt: string | null;
      coverMediaId: string | null;
    }> = {};

    if ('title' in input) fields.title = normalizeTitle(input.title);
    if ('markdownBody' in input) {
      const body = (input.markdownBody ?? '').trim();
      if (!body) throw new ValidationError('Post body cannot be empty', 'markdownBody');
      fields.markdownBody = body;
    }
    if ('excerpt' in input) {
      fields.excerpt = input.excerpt?.trim() || null;
    } else if (fields.markdownBody !== undefined) {
      // Regenerate the excerpt when the body changes and none was supplied.
      fields.excerpt = excerptFromMarkdown(fields.markdownBody);
    }
    if ('coverMediaId' in input) {
      fields.coverMediaId = this.resolveCover(input.coverMediaId, userId);
    }

    return this.posts.update(post.id, fields)!;
  }

  publish(userId: string, publicId: string): Post {
    const post = this.requireOwned(publicId, userId);
    const publishedAt = post.publishedAt ?? new Date().toISOString();
    return this.posts.setStatus(post.id, 'published', publishedAt)!;
  }

  archive(userId: string, publicId: string): Post {
    const post = this.requireOwned(publicId, userId);
    return this.posts.setStatus(post.id, 'archived', post.publishedAt)!;
  }

  delete(userId: string, publicId: string): void {
    const post = this.requireOwned(publicId, userId);
    this.posts.deleteWithDependents(post.id);
  }

  /** Raw post for editing (owner only). */
  getEditable(userId: string, publicId: string): Post {
    return this.requireOwned(publicId, userId);
  }

  /**
   * Render a post for public display by canonical path. Drafts and archived
   * posts are only visible to their owner; otherwise this throws NotFoundError.
   */
  getByCanonicalPath(path: string, viewerUserId: string | null): PostView {
    const post = this.posts.findByCanonicalPath(path);
    if (!post) throw new NotFoundError('Post not found');
    if (post.status !== 'published' && post.userId !== viewerUserId) {
      throw new NotFoundError('Post not found');
    }
    return this.toView(post);
  }

  /** Rendered view by public id, with the same visibility rule as canonical path. */
  getByPublicId(publicId: string, viewerUserId: string | null): PostView {
    const post = this.posts.findByPublicId(publicId);
    if (!post) throw new NotFoundError('Post not found');
    if (post.status !== 'published' && post.userId !== viewerUserId) {
      throw new NotFoundError('Post not found');
    }
    return this.toView(post);
  }

  listFeed(limit = 20, cursor?: string): PostCard[] {
    return this.posts.listPublished(limit, cursor);
  }

  /**
   * A user's published posts for their public profile grid. Pass `cursor` (the
   * previous page's last `published_at`) to page through for infinite scroll.
   */
  listPublishedByUsername(username: string, limit = 30, cursor?: string): PostCard[] {
    const user = this.users.findByUsername(username);
    if (!user) return [];
    return this.posts.listPublishedByUser(user.id, limit, cursor);
  }

  listOwn(userId: string): PostCard[] {
    return this.posts.listByUser(userId);
  }

  /** Attach rendered HTML, author identity, cover URL, and any quoted post to a post. */
  toView(post: Post): PostView {
    const author = this.users.findById(post.userId);
    const cover = post.coverMediaId ? this.media.findById(post.coverMediaId) : null;
    return {
      ...post,
      html: renderMarkdown(post.markdownBody),
      authorUsername: author?.username ?? 'unknown',
      authorDisplayName: author?.displayName ?? 'Unknown',
      coverUrl: cover ? `/media/${cover.publicId}/original` : null,
      quoted: post.quotePostId ? this.buildQuoted(post.quotePostId) : null,
      tags: this.tags
        ? this.tags.listForPost(post.id).map((t) => ({ name: t.name, slug: t.slug }))
        : [],
    };
  }

  /** Build the embedded quoted-post card, or a deleted placeholder. */
  private buildQuoted(quotedInternalId: string): QuotedPost {
    const quoted = this.posts.findById(quotedInternalId);
    if (!quoted) {
      return {
        deleted: true,
        publicId: null,
        canonicalPath: null,
        title: null,
        authorUsername: null,
        authorDisplayName: null,
        excerpt: null,
      };
    }
    const author = this.users.findById(quoted.userId);
    return {
      deleted: false,
      publicId: quoted.publicId,
      canonicalPath: quoted.canonicalPath,
      title: quoted.title,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      excerpt: quoted.excerpt,
    };
  }

  /**
   * Resolve a cover media public id (from the client) to the internal media id,
   * verifying the media exists and belongs to the user. Null/empty clears it.
   */
  private resolveCover(coverMediaPublicId: string | null | undefined, userId: string): string | null {
    if (!coverMediaPublicId) return null;
    const media = this.media.findByPublicId(coverMediaPublicId);
    if (!media) throw new ValidationError('Cover image not found', 'coverMediaId');
    if (media.userId !== userId) throw new PermissionError('You do not own that image');
    return media.id;
  }

  private requireOwned(publicId: string, userId: string): Post {
    const post = this.posts.findByPublicId(publicId);
    if (!post) throw new NotFoundError('Post not found');
    if (post.userId !== userId) throw new PermissionError('You do not own this post');
    return post;
  }
}

function normalizeTitle(title: string | null | undefined): string | null {
  const t = (title ?? '').trim();
  if (!t) return null;
  if (t.length > MAX_TITLE) throw new ValidationError('Title is too long', 'title');
  return t;
}
