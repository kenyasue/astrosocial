import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { LikeRepository } from '../db/repositories/LikeRepository';
import { ReactionRepository } from '../db/repositories/ReactionRepository';
import { CommentRepository } from '../db/repositories/CommentRepository';
import { FollowRepository } from '../db/repositories/FollowRepository';
import { RepostRepository } from '../db/repositories/RepostRepository';
import { BookmarkRepository } from '../db/repositories/BookmarkRepository';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { PostService } from './PostService';
import { SocialService } from './SocialService';
import { NotificationService } from './NotificationService';
import { NotFoundError, PermissionError, ValidationError, type Post, type User } from '../types';

describe('SocialService', () => {
  let db: DB;
  let users: UserRepository;
  let postService: PostService;
  let social: SocialService;
  let notifications: NotificationService;
  let ken: User;
  let alice: User;
  let post: Post;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    const postRepo = new PostRepository(db);
    notifications = new NotificationService(new NotificationRepository(db));
    postService = new PostService(postRepo, users, new MediaRepository(db), notifications);
    social = new SocialService(
      postRepo,
      users,
      new LikeRepository(db),
      new ReactionRepository(db),
      new CommentRepository(db),
      new FollowRepository(db),
      new RepostRepository(db),
      new BookmarkRepository(db),
      notifications
    );
    ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    alice = users.create({ email: 'alice@example.com', username: 'alice', displayName: 'Alice' });
    post = postService.create(ken.id, { title: 'P', markdownBody: 'body', status: 'published' });
  });
  afterEach(() => db.close());

  it('like is idempotent and reflected in social state', () => {
    social.like(alice.id, post.publicId);
    social.like(alice.id, post.publicId); // again — no double count
    const s = social.getPostSocial(post.publicId, alice.id);
    expect(s.likeCount).toBe(1);
    expect(s.liked).toBe(true);
    social.unlike(alice.id, post.publicId);
    expect(social.getPostSocial(post.publicId, null).likeCount).toBe(0);
  });

  it('reactions count per emoji and reject unsupported emoji', () => {
    social.react(alice.id, post.publicId, '❤️');
    social.react(ken.id, post.publicId, '❤️');
    social.react(alice.id, post.publicId, '🔥');
    const s = social.getPostSocial(post.publicId, alice.id);
    expect(s.reactions.find((r) => r.emoji === '❤️')?.count).toBe(2);
    expect(s.reactions.find((r) => r.emoji === '❤️')?.reacted).toBe(true);
    expect(s.reactions.find((r) => r.emoji === '🔥')?.count).toBe(1);
    expect(() => social.react(alice.id, post.publicId, '💩')).toThrow(ValidationError);
  });

  it('comments can be created, listed, and counted', () => {
    social.comment(alice.id, post.publicId, 'nice post');
    social.comment(ken.id, post.publicId, 'thanks');
    const comments = social.listComments(post.publicId);
    expect(comments).toHaveLength(2);
    expect(comments[0].authorUsername).toBe('alice');
    expect(social.getPostSocial(post.publicId, null).commentCount).toBe(2);
  });

  it('empty comment is rejected', () => {
    expect(() => social.comment(alice.id, post.publicId, '   ')).toThrow(ValidationError);
  });

  it('listed comments include the author avatar url when the author has an avatar', () => {
    const m = new MediaRepository(db).create({
      publicId: 'm_alice_av',
      userId: alice.id,
      canonicalPath: '/@alice/media/m_alice_av',
      fileName: 'a.png',
      originalFileName: 'a.png',
      mimeType: 'image/png',
      fileSize: 10,
      width: 1,
      height: 1,
      durationSeconds: null,
      storagePath: '/s/a',
      thumbnailPath: '/t/a',
      visibility: 'public',
    });
    users.updateProfile(alice.id, { avatarMediaId: m.id });

    social.comment(alice.id, post.publicId, 'with avatar');
    social.comment(ken.id, post.publicId, 'no avatar');
    const comments = social.listComments(post.publicId);
    const aliceComment = comments.find((c) => c.authorUsername === 'alice');
    const kenComment = comments.find((c) => c.authorUsername === 'ken');
    expect(aliceComment?.authorAvatarUrl).toBe('/media/m_alice_av/thumbnail');
    expect(kenComment?.authorAvatarUrl).toBeNull();
  });

  it('comment author and post owner can delete; others cannot', () => {
    const c = social.comment(alice.id, post.publicId, 'mine');
    const bob = users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    expect(() => social.deleteComment(bob.id, c.id)).toThrow(PermissionError);
    // post owner (ken) can delete alice's comment
    social.deleteComment(ken.id, c.id);
    expect(social.listComments(post.publicId)).toHaveLength(0);
  });

  it('follow/unfollow updates counts and rejects self-follow', () => {
    social.follow(alice.id, 'ken');
    expect(social.isFollowing(alice.id, 'ken')).toBe(true);
    expect(social.profileCounts(ken.id).followers).toBe(1);
    expect(social.profileCounts(alice.id).following).toBe(1);
    expect(() => social.follow(ken.id, 'ken')).toThrow(ValidationError);
    social.unfollow(alice.id, 'ken');
    expect(social.profileCounts(ken.id).followers).toBe(0);
  });

  it('following timeline shows posts from followed users only', () => {
    // alice follows ken → sees ken's published post
    social.follow(alice.id, 'ken');
    const tl = social.timeline(alice.id);
    expect(tl.map((i) => i.card.publicId)).toContain(post.publicId);
    // bob follows nobody → empty timeline
    const bob = users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    expect(social.timeline(bob.id)).toHaveLength(0);
  });

  it('like on a missing post throws NotFound', () => {
    expect(() => social.like(alice.id, 'p_missing')).toThrow(NotFoundError);
  });

  it('repost is idempotent and appears in followers timeline as a repost', () => {
    social.repost(alice.id, post.publicId);
    social.repost(alice.id, post.publicId); // again — no double
    expect(social.getPostSocial(post.publicId, alice.id).repostCount).toBe(1);
    expect(social.getPostSocial(post.publicId, alice.id).reposted).toBe(true);

    const bob = users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    social.follow(bob.id, 'alice');
    const tl = social.timeline(bob.id);
    const repostItem = tl.find((i) => i.type === 'repost');
    expect(repostItem?.actorUsername).toBe('alice');
    expect(repostItem?.card.publicId).toBe(post.publicId);

    social.unrepost(alice.id, post.publicId);
    expect(social.getPostSocial(post.publicId, null).repostCount).toBe(0);
  });

  it('bookmark toggles and lists', () => {
    social.bookmark(alice.id, post.publicId);
    expect(social.getPostSocial(post.publicId, alice.id).bookmarked).toBe(true);
    expect(social.listBookmarks(alice.id).map((c) => c.publicId)).toEqual([post.publicId]);
    social.unbookmark(alice.id, post.publicId);
    expect(social.listBookmarks(alice.id)).toHaveLength(0);
  });

  it('interactions create notifications for the post owner (not self)', () => {
    social.like(alice.id, post.publicId); // alice likes ken's post → notify ken
    social.comment(alice.id, post.publicId, 'hi'); // → notify ken
    social.like(ken.id, post.publicId); // ken likes own post → no self-notify
    const notifs = notifications.list(ken.id).items;
    expect(notifs.length).toBe(2);
    expect(notifs.some((n) => n.type === 'like' && n.actorUsername === 'alice')).toBe(true);
    expect(notifications.unreadCount(ken.id)).toBe(2);

    notifications.markAllRead(ken.id);
    expect(notifications.unreadCount(ken.id)).toBe(0);
  });

  it('quote post embeds the original and notifies its author; deleted shows placeholder', () => {
    const quote = postService.create(alice.id, {
      title: 'Quote',
      markdownBody: 'my take',
      status: 'published',
      quotePostId: post.publicId,
    });
    const view = postService.toView(quote);
    expect(view.quoted?.deleted).toBe(false);
    expect(view.quoted?.title).toBe(post.title);
    expect(notifications.list(ken.id).items.some((n) => n.type === 'quote_post')).toBe(true);

    // Delete the original → the quote post survives; its embed is cleared (FK-safe).
    postService.delete(ken.id, post.publicId);
    expect(postService.getByPublicId(quote.publicId, alice.id).quoted).toBeNull();
  });
});
