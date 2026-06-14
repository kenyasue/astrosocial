/**
 * Social service: likes, emoji reactions, comments, follows, the following
 * timeline, and aggregated per-post social state. Ownership and uniqueness rules
 * live here; all persistence is via repositories (no ORM).
 */
import {
  REACTION_EMOJIS,
  type CommentView,
  type Post,
  type PostCard,
  type PostSocial,
  type ReactionEmoji,
  type TimelineItem,
} from '../types';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import type { PostRepository } from '../db/repositories/PostRepository';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { LikeRepository } from '../db/repositories/LikeRepository';
import type { ReactionRepository } from '../db/repositories/ReactionRepository';
import type { CommentRepository } from '../db/repositories/CommentRepository';
import type { FollowRepository } from '../db/repositories/FollowRepository';
import type { RepostRepository } from '../db/repositories/RepostRepository';
import type { BookmarkRepository } from '../db/repositories/BookmarkRepository';
import type { NotificationService } from './NotificationService';

const MAX_COMMENT = 2000;
const EMOJI_SET = new Set<string>(REACTION_EMOJIS);

export class SocialService {
  constructor(
    private readonly posts: PostRepository,
    private readonly users: UserRepository,
    private readonly likes: LikeRepository,
    private readonly reactions: ReactionRepository,
    private readonly comments: CommentRepository,
    private readonly follows: FollowRepository,
    private readonly reposts: RepostRepository,
    private readonly bookmarks: BookmarkRepository,
    private readonly notifier: NotificationService
  ) {}

  // --- Likes ---------------------------------------------------------------
  like(userId: string, postPublicId: string): void {
    const post = this.requirePost(postPublicId);
    this.likes.add(post.id, userId);
    this.notifier.notify(post.userId, userId, 'like', { postId: post.id });
  }
  unlike(userId: string, postPublicId: string): void {
    this.likes.remove(this.requirePost(postPublicId).id, userId);
  }

  // --- Reactions -----------------------------------------------------------
  react(userId: string, postPublicId: string, emoji: string): void {
    if (!EMOJI_SET.has(emoji)) throw new ValidationError('Unsupported reaction', 'emoji');
    const post = this.requirePost(postPublicId);
    this.reactions.add(post.id, userId, emoji);
    this.notifier.notify(post.userId, userId, 'reaction', { postId: post.id });
  }
  unreact(userId: string, postPublicId: string, emoji: string): void {
    if (!EMOJI_SET.has(emoji)) throw new ValidationError('Unsupported reaction', 'emoji');
    this.reactions.remove(this.requirePost(postPublicId).id, userId, emoji);
  }

  // --- Reposts -------------------------------------------------------------
  repost(userId: string, postPublicId: string): void {
    const post = this.requirePost(postPublicId);
    this.reposts.add(post.id, userId);
    this.notifier.notify(post.userId, userId, 'repost', { postId: post.id });
  }
  unrepost(userId: string, postPublicId: string): void {
    this.reposts.remove(this.requirePost(postPublicId).id, userId);
  }

  // --- Bookmarks -----------------------------------------------------------
  bookmark(userId: string, postPublicId: string): void {
    this.bookmarks.add(this.requirePost(postPublicId).id, userId);
  }
  unbookmark(userId: string, postPublicId: string): void {
    this.bookmarks.remove(this.requirePost(postPublicId).id, userId);
  }
  listBookmarks(userId: string): PostCard[] {
    return this.posts.cardsByIds(this.bookmarks.postIdsByUser(userId));
  }

  // --- Comments ------------------------------------------------------------
  comment(userId: string, postPublicId: string, body: string): CommentView {
    const text = (body ?? '').trim();
    if (!text) throw new ValidationError('Comment cannot be empty', 'body');
    if (text.length > MAX_COMMENT) throw new ValidationError('Comment is too long', 'body');
    const post = this.requirePost(postPublicId);
    const created = this.comments.create(post.id, userId, text);
    this.notifier.notify(post.userId, userId, 'comment', { postId: post.id, commentId: created.id });
    return created;
  }

  listComments(postPublicId: string): CommentView[] {
    return this.comments.listByPost(this.requirePost(postPublicId).id);
  }

  /** Delete a comment (allowed for the comment author or the post owner). */
  deleteComment(userId: string, commentId: string): void {
    const comment = this.comments.findRaw(commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    const post = this.posts.findById(comment.postId);
    const isCommentAuthor = comment.userId === userId;
    const isPostOwner = post?.userId === userId;
    if (!isCommentAuthor && !isPostOwner) {
      throw new PermissionError('You cannot delete this comment');
    }
    this.comments.delete(commentId);
  }

  // --- Follows -------------------------------------------------------------
  follow(userId: string, targetUsername: string): void {
    const target = this.requireUserByUsername(targetUsername);
    if (target.id === userId) throw new ValidationError('You cannot follow yourself', 'target');
    this.follows.follow(userId, target.id);
    this.notifier.notify(target.id, userId, 'follow', {});
  }
  unfollow(userId: string, targetUsername: string): void {
    const target = this.requireUserByUsername(targetUsername);
    this.follows.unfollow(userId, target.id);
  }
  isFollowing(userId: string, targetUsername: string): boolean {
    const target = this.users.findByUsername(targetUsername);
    return target ? this.follows.isFollowing(userId, target.id) : false;
  }

  // --- Aggregates ----------------------------------------------------------
  getPostSocial(postPublicId: string, viewerId: string | null): PostSocial {
    const postId = this.requirePost(postPublicId).id;
    const counts = new Map(this.reactions.countsByPost(postId).map((r) => [r.emoji, r.count]));
    const mine = new Set(viewerId ? this.reactions.userReactions(postId, viewerId) : []);
    const reactions = REACTION_EMOJIS.map((emoji) => ({
      emoji,
      count: counts.get(emoji) ?? 0,
      reacted: mine.has(emoji),
    }));
    return {
      likeCount: this.likes.countByPost(postId),
      liked: viewerId ? this.likes.exists(postId, viewerId) : false,
      commentCount: this.comments.countByPost(postId),
      reactions,
      repostCount: this.reposts.countByPost(postId),
      reposted: viewerId ? this.reposts.exists(postId, viewerId) : false,
      bookmarked: viewerId ? this.bookmarks.exists(postId, viewerId) : false,
    };
  }

  /** Counts for a user's profile (posts, followers, following). */
  profileCounts(userId: string): { posts: number; followers: number; following: number } {
    return {
      posts: this.posts.countPublishedByUser(userId),
      followers: this.follows.countFollowers(userId),
      following: this.follows.countFollowing(userId),
    };
  }

  /** Following timeline as items: posts plus reposts by followed users, newest-first. */
  timeline(userId: string, limit = 20): TimelineItem[] {
    const followingIds = this.follows.followingIds(userId);
    if (followingIds.length === 0) return [];

    const postItems: TimelineItem[] = this.posts.listTimeline(followingIds, limit).map((card) => ({
      type: 'post',
      actorUsername: null,
      actorDisplayName: null,
      activityAt: card.publishedAt ?? card.createdAt,
      card,
    }));

    const repostItems: TimelineItem[] = this.reposts
      .byUsers(followingIds, limit)
      .map((rp): TimelineItem | null => {
        const card = this.posts.cardById(rp.postId);
        if (!card) return null;
        const actor = this.users.findById(rp.userId);
        return {
          type: 'repost',
          actorUsername: actor?.username ?? null,
          actorDisplayName: actor?.displayName ?? null,
          activityAt: rp.createdAt,
          card,
        };
      })
      .filter((i): i is TimelineItem => i !== null);

    return [...postItems, ...repostItems]
      .sort((a, b) => (a.activityAt < b.activityAt ? 1 : -1))
      .slice(0, limit);
  }

  // --- helpers -------------------------------------------------------------
  private requirePost(postPublicId: string): Post {
    const post = this.posts.findByPublicId(postPublicId);
    if (!post) throw new NotFoundError('Post not found');
    return post;
  }
  private requireUserByUsername(username: string) {
    const user = this.users.findByUsername(username);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}

/** Exported for reuse/validation. */
export function isReactionEmoji(value: string): value is ReactionEmoji {
  return EMOJI_SET.has(value);
}
