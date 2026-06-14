/**
 * WordPress import orchestrator.
 *
 * Reads a `mysqldump` export and recreates its users, posts, media, tags, and
 * (when present) comments inside AstroSocial. Post bodies are cleaned and their
 * image URLs rewritten to local media so they render almost exactly as they did
 * in WordPress. Media bytes are copied from the live site via an injected
 * {@link ImageFetcher}. See `.steering/20260614-wordpress-import/design.md`.
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { StorageProvider } from '../../storage/StorageProvider';
import type { TagRepository } from '../../db/repositories/TagRepository';
import type { UserRepository } from '../../db/repositories/UserRepository';
import type { PostRepository } from '../../db/repositories/PostRepository';
import { ImportRepository } from './ImportRepository';
import type { ImageFetcher } from './mediaFetcher';
import { parseInsertRows, type DumpRow } from './sqlDump';
import { extractUploadUrls, rewriteUrls, stripBlockComments, htmlToExcerpt } from './contentTransform';
import { generatePublicId } from '../../urls/publicId';
import { generateSlug, slugify } from '../../urls/slug';
import { mediaCanonicalPath, postCanonicalPath } from '../../urls/canonicalPath';
import type { PostStatus } from '../../types';

const THUMBNAIL_SIZE = 600;
const DEFAULT_HOSTS = ['astro.beer', 'www.astro.beer'];

export interface WordPressImportOptions {
  /** Label stored on the import job (e.g. the dump file name). */
  sourceName?: string;
  /** Hosts whose `/wp-content/uploads/` URLs are treated as importable media. */
  mediaHosts?: string[];
  /** Copy media bytes from the live site (default true). */
  importMedia?: boolean;
  /** Cap the number of media files downloaded (default unlimited). */
  maxMedia?: number;
  /** Cap the number of posts imported, for dry runs (default unlimited). */
  limitPosts?: number;
  /** Called once, after scanning the dump, with the totals to be imported. */
  onPlan?: (plan: WordPressImportPlan) => void;
  /** Called as each phase progresses, with `done`/`total` counts. */
  onProgress?: (progress: ImportProgress) => void;
}

/** Up-front counts of what an import will do, computed by scanning the dump. */
export interface WordPressImportPlan {
  /** Users that will be created (dump rows with an email). */
  users: number;
  /** Posts that will be imported (`post_type='post'`, importable status, capped). */
  posts: number;
  /** Distinct images that will be downloaded (0 when media import is off). */
  media: number;
  /** Post→tag links that will be created. */
  tags: number;
  /** Comments that will be imported (0 when the dump has none). */
  comments: number;
}

export type ImportPhase = 'users' | 'media' | 'posts';

/** Progress for one phase: `done` items out of `total`. */
export interface ImportProgress {
  phase: ImportPhase;
  done: number;
  total: number;
}

export interface WordPressImportResult {
  jobId: string;
  plan: WordPressImportPlan;
  users: number;
  posts: number;
  postsSkipped: number;
  media: number;
  mediaFailed: number;
  tags: number;
  comments: number;
}

interface PreparedPost {
  wp: DumpRow;
  userId: string;
  username: string;
  status: PostStatus;
  body: string;
  uploadUrls: string[];
  featuredUrl: string | null;
}

const IMPORTABLE_STATUSES = new Set(['publish', 'draft', 'pending', 'private', 'future']);

export class WordPressImporter {
  constructor(
    private readonly importRepo: ImportRepository,
    private readonly tags: TagRepository,
    private readonly users: UserRepository,
    private readonly posts: PostRepository,
    private readonly storage: StorageProvider,
    private readonly fetcher: ImageFetcher
  ) {}

  async run(sql: string, options: WordPressImportOptions = {}): Promise<WordPressImportResult> {
    const hosts = options.mediaHosts ?? DEFAULT_HOSTS;
    const importMedia = options.importMedia !== false;
    const maxMedia = options.maxMedia ?? Number.POSITIVE_INFINITY;
    const limitPosts = options.limitPosts ?? Number.POSITIVE_INFINITY;

    const jobId = this.importRepo.createJob(
      'wordpress',
      options.sourceName ?? null,
      // `Infinity` is not representable in JSON (it stringifies to null), so
      // record an explicit null for "unlimited" rather than a misleading value.
      JSON.stringify({
        importMedia,
        maxMedia: Number.isFinite(maxMedia) ? maxMedia : null,
        limitPosts: Number.isFinite(limitPosts) ? limitPosts : null,
        hosts,
      })
    );
    const wpUsers = parseInsertRows(sql, 'wp_users');
    const wpPosts = parseInsertRows(sql, 'wp_posts');
    const attachmentUrlById = this.indexAttachments(wpPosts);
    const featuredByPostId = this.indexFeaturedImages(sql);
    const termIndex = this.indexTerms(sql);

    // Scan posts (no owner yet) so we can plan totals before any work happens.
    const prepared = this.scanPosts(
      wpPosts,
      attachmentUrlById,
      featuredByPostId,
      hosts,
      limitPosts
    );
    const mediaUrls = collectMediaUrls(prepared);

    const plan: WordPressImportPlan = {
      users: wpUsers.filter((u) => (u.user_email ?? '').trim() !== '').length,
      posts: prepared.length,
      media: importMedia ? Math.min(mediaUrls.length, maxMedia) : 0,
      tags: prepared.reduce((n, p) => n + termIndex.tagNamesForPost(p.wp.ID!).length, 0),
      comments: this.countImportableComments(sql, prepared),
    };
    options.onPlan?.(plan);

    const result: WordPressImportResult = {
      jobId,
      plan,
      users: 0,
      posts: 0,
      postsSkipped: 0,
      media: 0,
      mediaFailed: 0,
      tags: 0,
      comments: 0,
    };

    try {
      const userIdByWpId = new Map<string, string>();
      const usernameByUserId = new Map<string, string>();
      this.importRepo.transaction(() =>
        this.importUsers(wpUsers, jobId, userIdByWpId, usernameByUserId, result, plan.users, options.onProgress)
      );

      if (userIdByWpId.size === 0) {
        this.importRepo.log(jobId, 'error', 'No importable users found; aborting.');
        this.importRepo.finishJob(jobId, 'failed', { total: 0, processed: 0, failed: 0 });
        return result;
      }
      const fallbackUserId = [...userIdByWpId.values()][0];
      this.assignOwners(prepared, userIdByWpId, usernameByUserId, fallbackUserId);

      const urlMap = importMedia
        ? await this.copyMedia(prepared, jobId, maxMedia, usernameByUserId, result, options.onProgress)
        : new Map<string, { internalId: string; publicId: string }>();

      this.importRepo.transaction(() =>
        this.insertPosts(prepared, jobId, urlMap, hosts, termIndex, result, options.onProgress)
      );

      this.importComments(sql, jobId, userIdByWpId, result);

      this.importRepo.finishJob(jobId, 'completed', {
        total: prepared.length,
        processed: result.posts,
        failed: result.postsSkipped + result.mediaFailed,
      });
    } catch (error) {
      this.importRepo.log(
        jobId,
        'error',
        `Import aborted: ${error instanceof Error ? error.message : String(error)}`
      );
      this.importRepo.finishJob(jobId, 'failed', { total: 0, processed: result.posts, failed: 0 });
      throw error;
    }

    return result;
  }

  // --- users ----------------------------------------------------------------

  private importUsers(
    wpUsers: DumpRow[],
    jobId: string,
    userIdByWpId: Map<string, string>,
    usernameByUserId: Map<string, string>,
    result: WordPressImportResult,
    total: number,
    onProgress?: (p: ImportProgress) => void
  ): void {
    const usedUsernames = new Set<string>();
    let done = 0;
    for (const u of wpUsers) {
      const wpId = u.ID;
      const email = (u.user_email ?? '').trim().toLowerCase();
      if (!wpId || !email) {
        this.importRepo.log(jobId, 'warn', 'Skipped user with no id/email', wpId);
        continue;
      }
      const existing = this.users.findByEmail(email);
      if (existing) {
        userIdByWpId.set(wpId, existing.id);
        usernameByUserId.set(existing.id, existing.username);
        usedUsernames.add(existing.username);
        this.importRepo.addMapping(jobId, 'user', wpId, 'user', existing.id);
        onProgress?.({ phase: 'users', done: ++done, total });
        continue;
      }
      const username = this.uniqueUsername(
        slugify(u.user_nicename || u.user_login || 'user') || 'user',
        usedUsernames
      );
      usedUsernames.add(username);
      const createdAt = wpDateToIso(u.user_registered) ?? new Date().toISOString();
      const id = this.importRepo.insertUser({
        email,
        username,
        displayName: (u.display_name || u.user_login || username).slice(0, 250),
        websiteUrl: u.user_url ? u.user_url.slice(0, 500) : null,
        createdAt,
      });
      userIdByWpId.set(wpId, id);
      usernameByUserId.set(id, username);
      this.importRepo.addMapping(jobId, 'user', wpId, 'user', id);
      result.users++;
      onProgress?.({ phase: 'users', done: ++done, total });
    }
  }

  /** Find a username not already used in this run or the database. */
  private uniqueUsername(base: string, used: Set<string>): string {
    const taken = (name: string): boolean => used.has(name) || this.users.usernameExists(name);
    const head = base.slice(0, 30) || 'user';
    if (!taken(head)) return head;
    for (let n = 2; n <= 50; n++) {
      const candidate = `${base.slice(0, 26)}-${n}`;
      if (!taken(candidate)) return candidate;
    }
    // Guaranteed-unique fallback after exhausting numeric suffixes.
    return `${base.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
  }

  // --- attachments / featured images ---------------------------------------

  /** Map attachment post id → its full-size image URL (the `guid`). */
  private indexAttachments(wpPosts: DumpRow[]): Map<string, string> {
    const byId = new Map<string, string>();
    for (const p of wpPosts) {
      if (p.post_type === 'attachment' && (p.post_mime_type ?? '').startsWith('image/') && p.guid) {
        byId.set(p.ID!, p.guid);
      }
    }
    return byId;
  }

  /** Map post id → featured-image attachment id (from `_thumbnail_id` postmeta). */
  private indexFeaturedImages(sql: string): Map<string, string> {
    const byPost = new Map<string, string>();
    for (const m of parseInsertRows(sql, 'wp_postmeta')) {
      if (m.meta_key === '_thumbnail_id' && m.post_id && m.meta_value) {
        byPost.set(m.post_id, m.meta_value);
      }
    }
    return byPost;
  }

  // --- posts ----------------------------------------------------------------

  /**
   * Select importable posts and prepare their bodies/URLs (without assigning an
   * owner yet, so this can run before users are imported to build the plan).
   */
  private scanPosts(
    wpPosts: DumpRow[],
    attachmentUrlById: Map<string, string>,
    featuredByPostId: Map<string, string>,
    hosts: string[],
    limitPosts: number
  ): PreparedPost[] {
    const candidates = wpPosts
      .filter((p) => p.post_type === 'post' && IMPORTABLE_STATUSES.has(p.post_status ?? ''))
      .sort((a, b) => (a.post_date ?? '').localeCompare(b.post_date ?? ''))
      .slice(0, limitPosts);

    return candidates.map((wp) => {
      const body = stripBlockComments(wp.post_content ?? '');
      const featuredAttachment = featuredByPostId.get(wp.ID!);
      const featuredUrl = featuredAttachment ? (attachmentUrlById.get(featuredAttachment) ?? null) : null;
      return {
        wp,
        userId: '',
        username: 'unknown',
        status: mapStatus(wp.post_status),
        body,
        uploadUrls: extractUploadUrls(body, hosts),
        featuredUrl,
      };
    });
  }

  /** Assign each scanned post its AstroSocial author (mapped, else the fallback). */
  private assignOwners(
    prepared: PreparedPost[],
    userIdByWpId: Map<string, string>,
    usernameByUserId: Map<string, string>,
    fallbackUserId: string
  ): void {
    for (const p of prepared) {
      p.userId = userIdByWpId.get(p.wp.post_author ?? '') ?? fallbackUserId;
      p.username = usernameByUserId.get(p.userId) ?? 'unknown';
    }
  }

  /** Count comments that would be imported (approved, non-empty, on a kept post). */
  private countImportableComments(sql: string, prepared: PreparedPost[]): number {
    const comments = parseInsertRows(sql, 'wp_comments');
    if (comments.length === 0) return 0;
    const postIds = new Set(prepared.map((p) => p.wp.ID));
    return comments.filter(
      (c) =>
        c.comment_approved === '1' &&
        postIds.has(c.comment_post_ID) &&
        (c.comment_content ?? '').trim() !== ''
    ).length;
  }

  /**
   * Copy all referenced media (in-content image URLs + featured-image URLs) and
   * return a map of source URL → local media identifiers.
   */
  private async copyMedia(
    prepared: PreparedPost[],
    jobId: string,
    maxMedia: number,
    usernameByUserId: Map<string, string>,
    result: WordPressImportResult,
    onProgress?: (p: ImportProgress) => void
  ): Promise<Map<string, { internalId: string; publicId: string }>> {
    const urls = collectMediaUrls(prepared);
    const total = Math.min(urls.length, maxMedia);

    const map = new Map<string, { internalId: string; publicId: string }>();
    let done = 0;
    for (const { url, userId, createdAt } of urls) {
      if (done >= maxMedia) {
        this.importRepo.log(jobId, 'info', `Reached maxMedia=${maxMedia}; remaining URLs kept remote.`);
        break;
      }
      try {
        const media = await this.copyOne(url, userId, createdAt, usernameByUserId, jobId);
        if (media) {
          map.set(url, media);
          result.media++;
        } else {
          result.mediaFailed++;
        }
      } catch (error) {
        result.mediaFailed++;
        this.importRepo.log(
          jobId,
          'warn',
          `Media import failed: ${error instanceof Error ? error.message : String(error)}`,
          url
        );
      }
      onProgress?.({ phase: 'media', done: ++done, total });
    }
    return map;
  }

  /** Download, process, store, and record a single media file. */
  private async copyOne(
    url: string,
    ownerId: string,
    createdAt: string,
    usernameByUserId: Map<string, string>,
    jobId: string
  ): Promise<{ internalId: string; publicId: string } | null> {
    const fetched = await this.fetcher.fetch(url);
    if (!fetched) {
      this.importRepo.log(jobId, 'warn', 'Could not download media; kept remote URL', url);
      return null;
    }

    let width: number | null = null;
    let height: number | null = null;
    let format: string | undefined;
    let thumbnailPath: string | null = null;
    try {
      const meta = await sharp(fetched.buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      format = meta.format;
      const thumb = await sharp(fetched.buffer)
        .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      thumbnailPath = this.storage.saveThumbnail(thumb).storagePath;
    } catch {
      this.importRepo.log(jobId, 'warn', 'Image could not be processed by sharp; kept remote URL', url);
      return null;
    }

    const mimeType = normalizeMime(fetched.mimeType, format);
    const ext = extFromMime(mimeType);
    const original = this.storage.saveOriginal(fetched.buffer, ext);
    const publicId = generatePublicId('m');
    const username = usernameByUserId.get(ownerId) ?? 'unknown';
    const originalFileName = decodeURIComponent(url.split('/').pop() ?? '').split('?')[0] || null;

    const internalId = this.importRepo.insertMedia({
      publicId,
      userId: ownerId,
      canonicalPath: mediaCanonicalPath(username, publicId),
      fileName: original.fileName,
      originalFileName,
      mimeType,
      fileSize: fetched.buffer.length,
      width,
      height,
      storagePath: original.storagePath,
      thumbnailPath,
      altText: originalFileName,
      caption: null,
      visibility: 'public',
      createdAt,
    });
    this.importRepo.addMapping(jobId, 'media_url', url, 'media', internalId);
    return { internalId, publicId };
  }

  private insertPosts(
    prepared: PreparedPost[],
    jobId: string,
    urlMap: Map<string, { internalId: string; publicId: string }>,
    hosts: string[],
    termIndex: TermIndex,
    result: WordPressImportResult,
    onProgress?: (p: ImportProgress) => void
  ): void {
    const localUrlMap = new Map<string, string>();
    for (const [url, media] of urlMap) localUrlMap.set(url, `/media/${media.publicId}/original`);

    let done = 0;
    for (const p of prepared) {
      try {
        const body = rewriteUrls(p.body, localUrlMap, hosts).trim();
        const title = (p.wp.post_title ?? '').trim() || null;
        const markdownBody = body || title || '(no content)';
        const excerptSource = (p.wp.post_excerpt ?? '').trim() || body;
        const excerpt = htmlToExcerpt(excerptSource) || null;
        const createdAt = wpDateToIso(p.wp.post_date) ?? new Date().toISOString();
        const updatedAt = wpDateToIso(p.wp.post_modified) ?? createdAt;
        const publishedAt = p.status === 'published' ? createdAt : null;

        const featuredMedia = p.featuredUrl ? urlMap.get(p.featuredUrl) : undefined;

        const publicId = generatePublicId('p');
        const slugBase = (p.wp.post_name ?? '').trim() || title;
        const slug = generateSlug(slugBase, publicId, (s) =>
          this.posts.slugExistsForUser(p.userId, s)
        );
        const canonicalPath = postCanonicalPath(p.username, slug);

        const postId = this.importRepo.insertPost({
          publicId,
          userId: p.userId,
          title,
          slug,
          canonicalPath,
          markdownBody,
          excerpt,
          coverMediaId: featuredMedia?.internalId ?? null,
          status: p.status,
          publishedAt,
          createdAt,
          updatedAt,
        });
        this.importRepo.addMapping(jobId, 'post', p.wp.ID!, 'post', postId);

        // `result.tags` counts post→tag links created (like posts/media count
        // rows), not distinct tags.
        for (const tagName of termIndex.tagNamesForPost(p.wp.ID!)) {
          const tag = this.tags.findOrCreate(tagName);
          this.tags.attachToPost(postId, tag.id);
          result.tags++;
        }
        result.posts++;
      } catch (error) {
        result.postsSkipped++;
        this.importRepo.log(
          jobId,
          'warn',
          `Failed to import post: ${error instanceof Error ? error.message : String(error)}`,
          p.wp.ID
        );
      }
      onProgress?.({ phase: 'posts', done: ++done, total: prepared.length });
    }
  }

  // --- terms / tags ---------------------------------------------------------

  private indexTerms(sql: string): TermIndex {
    const termNameById = new Map<string, string>();
    for (const t of parseInsertRows(sql, 'wp_terms')) {
      if (t.term_id && t.name) termNameById.set(t.term_id, t.name);
    }
    // term_taxonomy_id → term name, but only for taxonomies we treat as tags.
    const tagNameByTtId = new Map<string, string>();
    for (const tt of parseInsertRows(sql, 'wp_term_taxonomy')) {
      const tax = tt.taxonomy ?? '';
      if ((tax === 'post_tag' || tax === 'category') && tt.term_taxonomy_id && tt.term_id) {
        const name = termNameById.get(tt.term_id);
        if (name) tagNameByTtId.set(tt.term_taxonomy_id, name);
      }
    }
    // post id → [tt ids]
    const ttIdsByPost = new Map<string, string[]>();
    for (const rel of parseInsertRows(sql, 'wp_term_relationships')) {
      if (!rel.object_id || !rel.term_taxonomy_id) continue;
      const list = ttIdsByPost.get(rel.object_id) ?? [];
      list.push(rel.term_taxonomy_id);
      ttIdsByPost.set(rel.object_id, list);
    }
    return new TermIndex(tagNameByTtId, ttIdsByPost);
  }

  // --- comments -------------------------------------------------------------

  private importComments(
    sql: string,
    jobId: string,
    userIdByWpId: Map<string, string>,
    result: WordPressImportResult
  ): void {
    const comments = parseInsertRows(sql, 'wp_comments');
    if (comments.length === 0) {
      this.importRepo.log(jobId, 'info', 'No comments found in dump (wp_comments absent or empty).');
      return;
    }
    for (const c of comments) {
      if (c.comment_approved !== '1' || !c.comment_post_ID) continue;
      const postId = this.importRepo.getMappingTargetId(jobId, 'post', c.comment_post_ID);
      if (!postId) continue;
      const body = (c.comment_content ?? '').trim();
      if (!body) continue;
      const userId = c.user_id ? (userIdByWpId.get(c.user_id) ?? null) : null;
      this.importRepo.insertComment({
        postId,
        userId,
        guestName: userId ? null : (c.comment_author ?? 'Guest'),
        body,
        createdAt: wpDateToIso(c.comment_date) ?? new Date().toISOString(),
      });
      result.comments++;
    }
  }
}

/** Resolves the tag names attached to a WordPress post id. */
class TermIndex {
  constructor(
    private readonly tagNameByTtId: Map<string, string>,
    private readonly ttIdsByPost: Map<string, string[]>
  ) {}

  tagNamesForPost(postId: string): string[] {
    const names: string[] = [];
    for (const ttId of this.ttIdsByPost.get(postId) ?? []) {
      const name = this.tagNameByTtId.get(ttId);
      if (name) names.push(name);
    }
    return names;
  }
}

/**
 * Build the de-duplicated, ordered list of media URLs to copy (each post's
 * in-content images first, then its featured image), tagging each with the
 * owning user and the referencing post's date. Shared by planning (count) and
 * the copy phase (work).
 */
function collectMediaUrls(
  prepared: PreparedPost[]
): { url: string; userId: string; createdAt: string }[] {
  const seen = new Set<string>();
  const out: { url: string; userId: string; createdAt: string }[] = [];
  const remember = (url: string | null, userId: string, createdAt: string): void => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, userId, createdAt });
  };
  for (const p of prepared) {
    const createdAt = wpDateToIso(p.wp.post_date) ?? new Date().toISOString();
    for (const url of p.uploadUrls) remember(url, p.userId, createdAt);
    remember(p.featuredUrl, p.userId, createdAt);
  }
  return out;
}

/** Map a WordPress post status to an AstroSocial post status. */
function mapStatus(wpStatus: string | null): PostStatus {
  switch (wpStatus) {
    case 'publish':
    case 'private':
    case 'future':
      return 'published';
    default:
      return 'draft';
  }
}

/** Convert a WordPress `YYYY-MM-DD HH:MM:SS` (UTC) timestamp to ISO-8601. */
function wpDateToIso(value: string | null): string | null {
  if (!value || value.startsWith('0000-00-00')) return null;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Pick a concrete image MIME type from the fetched type and sharp's detection. */
function normalizeMime(fetchedMime: string, sharpFormat: string | undefined): string {
  if (fetchedMime.startsWith('image/') && fetchedMime !== 'application/octet-stream') {
    return fetchedMime;
  }
  switch (sharpFormat) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}
