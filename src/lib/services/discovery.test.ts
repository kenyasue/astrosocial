import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { SearchRepository } from '../db/repositories/SearchRepository';
import { TagRepository } from '../db/repositories/TagRepository';
import { TrendRepository } from '../db/repositories/TrendRepository';
import { LikeRepository } from '../db/repositories/LikeRepository';
import { PostService } from './PostService';
import { SearchService, buildMatchExpression } from './SearchService';
import { TrendService } from './TrendService';
import type { User } from '../types';

describe('buildMatchExpression', () => {
  it('quotes each token and drops FTS operators', () => {
    expect(buildMatchExpression('hello world')).toBe('"hello" "world"');
    expect(buildMatchExpression('a* OR b^')).toBe('"a" "or" "b"');
  });
  it('returns empty for blank input', () => {
    expect(buildMatchExpression('   ')).toBe('');
  });
});

describe('search / tags / trends', () => {
  let db: DB;
  let users: UserRepository;
  let postService: PostService;
  let search: SearchService;
  let trends: TrendService;
  let tagRepo: TagRepository;
  let ken: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    const postRepo = new PostRepository(db);
    tagRepo = new TagRepository(db);
    postService = new PostService(postRepo, users, new MediaRepository(db), undefined, tagRepo);
    search = new SearchService(new SearchRepository(db), postRepo, users, tagRepo);
    trends = new TrendService(new TrendRepository(db), postRepo, tagRepo);
    ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  });
  afterEach(() => db.close());

  it('full-text search finds published posts by title/body', () => {
    postService.create(ken.id, {
      title: 'Gardening tips',
      markdownBody: 'how to grow tomatoes',
      status: 'published',
    });
    postService.create(ken.id, { title: 'Cooking', markdownBody: 'pasta recipe', status: 'published' });

    expect(search.query('tomatoes').posts.map((p) => p.title)).toEqual(['Gardening tips']);
    expect(search.query('pasta').posts.map((p) => p.title)).toEqual(['Cooking']);
    expect(search.query('zzznotfound').posts).toHaveLength(0);
  });

  it('search excludes drafts', () => {
    postService.create(ken.id, { title: 'Secret', markdownBody: 'hidden tomatoes', status: 'draft' });
    expect(search.query('hidden').posts).toHaveLength(0);
  });

  it('Latest tab orders matching posts newest-first', () => {
    const a = postService.create(ken.id, { title: 'First', markdownBody: 'shared keyword', status: 'published' });
    const b = postService.create(ken.id, { title: 'Second', markdownBody: 'shared keyword', status: 'published' });
    // Make b strictly newer.
    db.prepare('UPDATE posts SET published_at = ? WHERE id = ?').run('2999-01-01T00:00:00.000Z', b.id);
    db.prepare('UPDATE posts SET published_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', a.id);
    const titles = search.query('shared', 'latest').posts.map((p) => p.title);
    expect(titles).toEqual(['Second', 'First']);
  });

  it('Tags tab matches tags by name', () => {
    postService.create(ken.id, { title: 'P', markdownBody: 'x', status: 'published', tags: ['gardening'] });
    expect(search.query('garden', 'tags').tags.map((t) => t.slug)).toContain('gardening');
  });

  it('no-query suggestions return trending tags + people', () => {
    postService.create(ken.id, { title: 'P', markdownBody: 'x', status: 'published', tags: ['hot'] });
    const s = search.suggestions();
    expect(s.tags.some((t) => t.slug === 'hot')).toBe(true);
    expect(Array.isArray(s.people)).toBe(true);
  });

  it('search finds users by username/display name (People tab)', () => {
    users.create({ email: 'a@x.com', username: 'gardener', displayName: 'Green Thumb' });
    expect(search.query('garden', 'people').users.map((u) => u.username)).toContain('gardener');
    expect(search.query('thumb', 'people').users.map((u) => u.username)).toContain('gardener');
  });

  it('tags attach on create and list posts by tag', () => {
    const post = postService.create(ken.id, {
      title: 'Tagged',
      markdownBody: 'body',
      status: 'published',
      tags: ['Garden', 'DIY'],
    });
    expect(postService.toView(post).tags.map((t) => t.slug).sort()).toEqual(['diy', 'garden']);
    expect(search.postsByTag('garden').map((p) => p.title)).toEqual(['Tagged']);
  });

  it('popular posts rank by engagement score', () => {
    postService.create(ken.id, { title: 'A', markdownBody: 'x', status: 'published' });
    const b = postService.create(ken.id, { title: 'B', markdownBody: 'y', status: 'published' });
    const liker = users.create({ email: 'l@x.com', username: 'liker', displayName: 'L' });
    new LikeRepository(db).add(b.id, liker.id);
    expect(trends.popularPosts().map((p) => p.title)).toEqual(['B', 'A']);
  });

  it('popularPosts respects the time window', () => {
    const old = postService.create(ken.id, { title: 'Old', markdownBody: 'x', status: 'published' });
    const fresh = postService.create(ken.id, { title: 'Fresh', markdownBody: 'y', status: 'published' });
    // Make `old` 10 days old; `fresh` now.
    db.prepare('UPDATE posts SET published_at = ? WHERE id = ?').run(
      new Date(Date.now() - 10 * 86400000).toISOString(),
      old.id
    );
    db.prepare('UPDATE posts SET published_at = ? WHERE id = ?').run(new Date().toISOString(), fresh.id);

    const day = trends.popularPosts(12, '24h').map((p) => p.title);
    expect(day).toContain('Fresh');
    expect(day).not.toContain('Old');

    const month = trends.popularPosts(12, '30d').map((p) => p.title);
    expect(month).toContain('Fresh');
    expect(month).toContain('Old');
  });

  it('popular tags counts published usage', () => {
    postService.create(ken.id, { title: 'P1', markdownBody: 'x', status: 'published', tags: ['hot'] });
    postService.create(ken.id, { title: 'P2', markdownBody: 'y', status: 'published', tags: ['hot'] });
    const tags = trends.popularTags();
    expect(tags[0]).toMatchObject({ slug: 'hot', count: 2 });
  });
});
