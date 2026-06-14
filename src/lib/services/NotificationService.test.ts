import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { NotificationService } from './NotificationService';
import { PostService } from './PostService';
import type { User } from '../types';

describe('NotificationService', () => {
  let db: DB;
  let users: UserRepository;
  let posts: PostService;
  let notifications: NotificationService;
  let ken: User;
  let alice: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    posts = new PostService(new PostRepository(db), users, new MediaRepository(db));
    notifications = new NotificationService(new NotificationRepository(db));
    ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    alice = users.create({ email: 'alice@example.com', username: 'alice', displayName: 'Alice' });
  });
  afterEach(() => db.close());

  it('Mentions tab filters to comment-type notifications', () => {
    notifications.notify(ken.id, alice.id, 'like', {});
    notifications.notify(ken.id, alice.id, 'comment', {});
    notifications.notify(ken.id, alice.id, 'follow', {});
    expect(notifications.list(ken.id, 'all').items).toHaveLength(3);
    const mentions = notifications.list(ken.id, 'mentions').items;
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe('comment');
  });

  it('openAndResolveTarget marks read and returns the target URL', () => {
    const post = posts.create(ken.id, { title: 'P', markdownBody: 'x', status: 'published' });
    notifications.notify(ken.id, alice.id, 'like', { postId: post.id });
    expect(notifications.unreadCount(ken.id)).toBe(1);

    const item = notifications.list(ken.id, 'all').items[0];
    const target = notifications.openAndResolveTarget(ken.id, item.id);
    expect(target).toBe(post.canonicalPath);
    expect(notifications.unreadCount(ken.id)).toBe(0);
  });

  it('follow notifications resolve to the actor profile', () => {
    notifications.notify(ken.id, alice.id, 'follow', {});
    const item = notifications.list(ken.id, 'all').items[0];
    expect(notifications.openAndResolveTarget(ken.id, item.id)).toBe('/@alice');
  });

  it('openAndResolveTarget returns null for a notification not owned by the user', () => {
    notifications.notify(ken.id, alice.id, 'like', {});
    const item = notifications.list(ken.id, 'all').items[0];
    expect(notifications.openAndResolveTarget(alice.id, item.id)).toBeNull();
  });

  it('paginates with a cursor', () => {
    for (let i = 0; i < 35; i++) notifications.notify(ken.id, alice.id, 'like', {});
    // Give distinct timestamps (the loop creates them within the same millisecond).
    db.exec(
      `UPDATE notifications SET created_at = printf('2026-01-01T00:%02d:00.000Z', rowid)
       WHERE user_id = '${ken.id}'`
    );
    const first = notifications.list(ken.id, 'all');
    expect(first.items).toHaveLength(30);
    expect(first.nextCursor).not.toBeNull();
    const second = notifications.list(ken.id, 'all', first.nextCursor!);
    expect(second.items.length).toBe(5);
  });
});
