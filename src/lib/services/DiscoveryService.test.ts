import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { FollowRepository } from '../db/repositories/FollowRepository';
import { TagRepository } from '../db/repositories/TagRepository';
import { DiscoveryService } from './DiscoveryService';
import type { User } from '../types';

/** Insert a media row with a controlled created_at for ordering assertions. */
function insertMedia(
  db: DB,
  userId: string,
  publicId: string,
  createdAt: string,
  mimeType = 'image/jpeg'
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO media
       (id, public_id, user_id, canonical_path, file_name, mime_type, file_size,
        storage_path, visibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 100, ?, 'public', ?)`
  ).run(id, publicId, userId, `/@x/media/${publicId}`, `${publicId}.bin`, mimeType,
    `originals/${publicId}.bin`, createdAt);
  return id;
}

describe('UserRepository.whoToFollow', () => {
  let db: DB;
  let users: UserRepository;
  let follows: FollowRepository;
  let ken: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    follows = new FollowRepository(db);
    ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  });
  afterEach(() => db.close());

  it('excludes the viewer and already-followed users', () => {
    const alice = users.create({ email: 'a@x.com', username: 'alice', displayName: 'Alice' });
    users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    follows.follow(ken.id, alice.id); // ken follows alice → alice excluded

    const names = users.whoToFollow(ken.id, 10).map((u) => u.username);
    expect(names).toContain('bob');
    expect(names).not.toContain('ken'); // not self
    expect(names).not.toContain('alice'); // already followed
  });

  it('ranks by follower count', () => {
    const a = users.create({ email: 'a@x.com', username: 'popular', displayName: 'Pop' });
    users.create({ email: 'b@x.com', username: 'quiet', displayName: 'Quiet' });
    follows.follow(ken.id, a.id); // popular has 1 follower
    // viewer = a fresh user so nobody is pre-followed
    const viewer = users.create({ email: 'v@x.com', username: 'viewer', displayName: 'V' });
    const names = users.whoToFollow(viewer.id, 10).map((u) => u.username);
    expect(names.indexOf('popular')).toBeLessThan(names.indexOf('quiet'));
  });

  it('anonymous viewer returns top users without exclusions', () => {
    users.create({ email: 'a@x.com', username: 'alice', displayName: 'Alice' });
    expect(users.whoToFollow(null, 10).length).toBeGreaterThanOrEqual(2);
  });
});

describe('DiscoveryService.suggestions', () => {
  let db: DB;

  beforeEach(() => {
    db = makeTestDb();
  });
  afterEach(() => db.close());

  it('returns trending tags and who-to-follow', () => {
    const users = new UserRepository(db);
    const tags = new TagRepository(db);
    const ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    users.create({ email: 'a@x.com', username: 'alice', displayName: 'Alice' });
    const t = tags.findOrCreate('news');
    // attach to a post-less tag won't count in popularTags (needs a published post),
    // so just assert the shape is right and who-to-follow is populated.
    void t;

    const svc = new DiscoveryService(tags, users);
    const s = svc.suggestions(ken.id);
    expect(Array.isArray(s.trendingTags)).toBe(true);
    expect(s.whoToFollow.map((u) => u.username)).toContain('alice');
  });
});

describe('DiscoveryService.userDirectory', () => {
  let db: DB;

  beforeEach(() => {
    db = makeTestDb();
  });
  afterEach(() => db.close());

  it('returns each user with avatar and most-recent image URLs', () => {
    const users = new UserRepository(db);
    const tags = new TagRepository(db);
    const ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });

    const avatarMedia = insertMedia(db, ken.id, 'm_ava', '2020-01-01T00:00:00.000Z');
    insertMedia(db, ken.id, 'm_old', '2020-02-01T00:00:00.000Z');
    insertMedia(db, ken.id, 'm_new', '2021-06-01T00:00:00.000Z'); // newest image
    users.updateProfile(ken.id, { avatarMediaId: avatarMedia });

    // A user with neither avatar nor images.
    users.create({ email: 'a@x.com', username: 'alice', displayName: 'Alice' });

    const dir = new DiscoveryService(tags, users).userDirectory();
    const k = dir.find((u) => u.username === 'ken')!;
    expect(k.displayName).toBe('Ken');
    expect(k.avatarUrl).toBe('/media/m_ava/thumbnail');
    expect(k.lastImageUrl).toBe('/media/m_new/thumbnail');

    const a = dir.find((u) => u.username === 'alice')!;
    expect(a.avatarUrl).toBeNull();
    expect(a.lastImageUrl).toBeNull();
  });

  it('ignores non-image media when choosing the last image', () => {
    const users = new UserRepository(db);
    const tags = new TagRepository(db);
    const bob = users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    insertMedia(db, bob.id, 'm_img', '2020-01-01T00:00:00.000Z', 'image/png');
    insertMedia(db, bob.id, 'm_vid', '2022-01-01T00:00:00.000Z', 'video/mp4'); // newer, non-image

    const dir = new DiscoveryService(tags, users).userDirectory();
    const b = dir.find((u) => u.username === 'bob')!;
    expect(b.lastImageUrl).toBe('/media/m_img/thumbnail'); // the image, not the newer video
  });

  it('honours the limit', () => {
    const users = new UserRepository(db);
    const tags = new TagRepository(db);
    for (let i = 0; i < 5; i++) {
      users.create({ email: `u${i}@x.com`, username: `u${i}`, displayName: `U${i}` });
    }
    expect(new DiscoveryService(tags, users).userDirectory(3)).toHaveLength(3);
  });
});
