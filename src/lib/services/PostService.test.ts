import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { PostService } from './PostService';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import type { User } from '../types';

describe('PostRepository', () => {
  let db: DB;
  let users: UserRepository;
  let repo: PostRepository;
  let user: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    repo = new PostRepository(db);
    user = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  });
  afterEach(() => db.close());

  function make(slug: string, status: 'draft' | 'published' | 'archived', publishedAt: string | null) {
    return repo.create({
      publicId: `p_${slug}`,
      userId: user.id,
      title: slug,
      slug,
      canonicalPath: `/@ken/posts/${slug}`,
      markdownBody: 'body',
      excerpt: 'body',
      status,
      publishedAt,
    });
  }

  it('create_thenFindByCanonicalPath_and_publicId', () => {
    make('hello', 'published', '2026-01-01T00:00:00.000Z');
    expect(repo.findByCanonicalPath('/@ken/posts/hello')?.title).toBe('hello');
    expect(repo.findByPublicId('p_hello')?.slug).toBe('hello');
  });

  it('slugExistsForUser_reflectsState', () => {
    expect(repo.slugExistsForUser(user.id, 'hello')).toBe(false);
    make('hello', 'draft', null);
    expect(repo.slugExistsForUser(user.id, 'hello')).toBe(true);
  });

  it('listPublished_returnsOnlyPublished_newestFirst', () => {
    make('old', 'published', '2026-01-01T00:00:00.000Z');
    make('new', 'published', '2026-02-01T00:00:00.000Z');
    make('draft', 'draft', null);
    const cards = repo.listPublished();
    expect(cards.map((c) => c.slug)).toEqual(['new', 'old']);
    expect(cards[0].authorUsername).toBe('ken');
  });

  it('listPublished_includesReadingMinutes', () => {
    make('hello', 'published', '2026-01-01T00:00:00.000Z');
    const cards = repo.listPublished();
    expect(cards[0].readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it('listPublishedByUser_returnsOnlyPublishedForThatUser', () => {
    const other = users.create({ email: 'o@x.com', username: 'other', displayName: 'O' });
    make('mine', 'published', '2026-01-01T00:00:00.000Z');
    make('draft', 'draft', null);
    repo.create({
      publicId: 'p_o',
      userId: other.id,
      title: 'theirs',
      slug: 'theirs',
      canonicalPath: '/@other/posts/theirs',
      markdownBody: 'body',
      excerpt: 'body',
      status: 'published',
      publishedAt: '2026-01-02T00:00:00.000Z',
    });
    const cards = repo.listPublishedByUser(user.id);
    expect(cards.map((c) => c.slug)).toEqual(['mine']);
  });

  it('listPublished_withCursor_returnsOlderThanCursor', () => {
    make('a', 'published', '2026-01-01T00:00:00.000Z');
    make('b', 'published', '2026-02-01T00:00:00.000Z');
    make('c', 'published', '2026-03-01T00:00:00.000Z');
    const page = repo.listPublished(10, '2026-02-01T00:00:00.000Z');
    expect(page.map((p) => p.slug)).toEqual(['a']); // strictly older than the cursor
  });

  it('update_changesOnlyProvidedFields', () => {
    const p = make('hello', 'draft', null);
    const updated = repo.update(p.id, { title: 'New' });
    expect(updated?.title).toBe('New');
    expect(updated?.markdownBody).toBe('body');
  });

  it('delete_removesPost', () => {
    const p = make('hello', 'draft', null);
    repo.delete(p.id);
    expect(repo.findById(p.id)).toBeNull();
  });
});

describe('PostService', () => {
  let db: DB;
  let users: UserRepository;
  let posts: PostRepository;
  let mediaRepo: MediaRepository;
  let service: PostService;
  let user: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    posts = new PostRepository(db);
    mediaRepo = new MediaRepository(db);
    service = new PostService(posts, users, mediaRepo);
    user = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  });
  afterEach(() => db.close());

  it('create_generatesSlugAndCanonicalPath', () => {
    const post = service.create(user.id, { title: 'Hello World', markdownBody: 'Hi there' });
    expect(post.slug).toBe('hello-world');
    expect(post.canonicalPath).toBe('/@ken/posts/hello-world');
    expect(post.publicId).toMatch(/^p_/);
    expect(post.status).toBe('draft');
    expect(post.excerpt).toBe('Hi there');
  });

  it('create_collidingTitle_appendsSuffix', () => {
    service.create(user.id, { title: 'Hello', markdownBody: 'a' });
    const second = service.create(user.id, { title: 'Hello', markdownBody: 'b' });
    expect(second.slug).toBe('hello-2');
  });

  it('create_emptyBody_throwsValidationError', () => {
    expect(() => service.create(user.id, { markdownBody: '   ' })).toThrow(ValidationError);
  });

  it('create_publishedStatus_setsPublishedAt', () => {
    const post = service.create(user.id, { markdownBody: 'x', status: 'published' });
    expect(post.status).toBe('published');
    expect(post.publishedAt).not.toBeNull();
  });

  it('publish_setsStatusAndPublishedAt', () => {
    const draft = service.create(user.id, { title: 'T', markdownBody: 'x' });
    const published = service.publish(user.id, draft.publicId);
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
  });

  it('archive_setsStatusArchived', () => {
    const draft = service.create(user.id, { title: 'T', markdownBody: 'x' });
    const archived = service.archive(user.id, draft.publicId);
    expect(archived.status).toBe('archived');
  });

  it('update_changesBody_andRegeneratesExcerpt', () => {
    const post = service.create(user.id, { title: 'T', markdownBody: 'old body' });
    const updated = service.update(user.id, post.publicId, { markdownBody: '# New heading text' });
    expect(updated.markdownBody).toBe('# New heading text');
    expect(updated.excerpt).toBe('New heading text');
    expect(updated.slug).toBe(post.slug); // slug stays stable
  });

  it('delete_removesPost', () => {
    const post = service.create(user.id, { title: 'T', markdownBody: 'x' });
    service.delete(user.id, post.publicId);
    expect(posts.findByPublicId(post.publicId)).toBeNull();
  });

  it('mutations_byNonOwner_throwPermissionError', () => {
    const other = users.create({ email: 'o@x.com', username: 'other', displayName: 'O' });
    const post = service.create(user.id, { title: 'T', markdownBody: 'x' });
    expect(() => service.update(other.id, post.publicId, { title: 'Z' })).toThrow(PermissionError);
    expect(() => service.publish(other.id, post.publicId)).toThrow(PermissionError);
    expect(() => service.archive(other.id, post.publicId)).toThrow(PermissionError);
    expect(() => service.delete(other.id, post.publicId)).toThrow(PermissionError);
  });

  it('getByPublicId_draft_hiddenFromOthers_visibleToOwner', () => {
    const post = service.create(user.id, { markdownBody: 'secret' });
    expect(() => service.getByPublicId(post.publicId, null)).toThrow(NotFoundError);
    expect(service.getByPublicId(post.publicId, user.id).html).toContain('secret');
  });

  it('getByCanonicalPath_publishedPost_returnsRenderedView', () => {
    const post = service.create(user.id, {
      title: 'T',
      markdownBody: '# Heading\n\n**bold**',
      status: 'published',
    });
    const view = service.getByCanonicalPath(post.canonicalPath, null);
    expect(view.html).toContain('<h1>Heading</h1>');
    expect(view.html).toContain('<strong>bold</strong>');
    expect(view.authorUsername).toBe('ken');
  });

  it('getByCanonicalPath_draft_hiddenFromOthers_visibleToOwner', () => {
    const post = service.create(user.id, { title: 'T', markdownBody: 'secret' });
    expect(() => service.getByCanonicalPath(post.canonicalPath, null)).toThrow(NotFoundError);
    const ownerView = service.getByCanonicalPath(post.canonicalPath, user.id);
    expect(ownerView.html).toContain('secret');
  });

  it('getByCanonicalPath_missing_throwsNotFound', () => {
    expect(() => service.getByCanonicalPath('/@ken/posts/none', user.id)).toThrow(NotFoundError);
  });

  function makeMedia(publicId: string, ownerId: string) {
    return mediaRepo.create({
      publicId,
      userId: ownerId,
      canonicalPath: `/@x/media/${publicId}`,
      fileName: 'f.png',
      originalFileName: 'f.png',
      mimeType: 'image/png',
      fileSize: 10,
      width: 10,
      height: 10,
      durationSeconds: null,
      storagePath: `originals/${publicId}.png`,
      thumbnailPath: `thumbnails/${publicId}.webp`,
      visibility: 'public',
    });
  }

  it('create_withCover_setsCoverAndViewUrl', () => {
    const media = makeMedia('m_cover1', user.id);
    const post = service.create(user.id, { title: 'T', markdownBody: 'x', coverMediaId: 'm_cover1' });
    expect(post.coverMediaId).toBe(media.id);
    expect(service.toView(post).coverUrl).toBe('/media/m_cover1/original');
  });

  it('create_withCoverNotOwned_throwsPermission', () => {
    const other = users.create({ email: 'o@x.com', username: 'other', displayName: 'O' });
    makeMedia('m_other', other.id);
    expect(() => service.create(user.id, { markdownBody: 'x', coverMediaId: 'm_other' })).toThrow(
      PermissionError
    );
  });

  it('create_withUnknownCover_throwsValidation', () => {
    expect(() => service.create(user.id, { markdownBody: 'x', coverMediaId: 'm_missing' })).toThrow(
      ValidationError
    );
  });

  it('update_canClearCover', () => {
    makeMedia('m_cover2', user.id);
    const post = service.create(user.id, { title: 'T', markdownBody: 'x', coverMediaId: 'm_cover2' });
    const cleared = service.update(user.id, post.publicId, { coverMediaId: null });
    expect(cleared.coverMediaId).toBeNull();
  });
});
