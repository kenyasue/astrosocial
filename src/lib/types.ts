/**
 * Shared entity interfaces and error classes for AstroSocial.
 *
 * Timestamps are stored as ISO-8601 TEXT in SQLite and surfaced as strings.
 */

export type DmPolicy = 'everyone' | 'following' | 'mutual' | 'nobody';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  websiteUrl: string | null;
  location: string | null;
  dmPolicy: DmPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPin {
  id: string;
  email: string;
  pinHash: string;
  expiresAt: string;
  consumedAt: string | null;
  failedAttempts: number;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** The fixed set of emoji reactions a post supports. */
export const REACTION_EMOJIS = ['👍', '❤️', '😺', '😂', '👏', '🔥', '👀', '😮'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface CommentView {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  guestName: string | null;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  reacted: boolean;
}

/** Aggregated social state for a post, relative to a viewer. */
export interface PostSocial {
  likeCount: number;
  liked: boolean;
  commentCount: number;
  reactions: ReactionCount[];
  repostCount: number;
  reposted: boolean;
  bookmarked: boolean;
}

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reaction'
  | 'follow'
  | 'repost'
  | 'quote_post'
  | 'dm_message';

export interface NotificationView {
  id: string;
  type: NotificationType;
  actorUsername: string | null;
  actorDisplayName: string | null;
  postCanonicalPath: string | null;
  postTitle: string | null;
  read: boolean;
  createdAt: string;
}

/** An entry in the following timeline: a normal post or a repost of one. */
export interface TimelineItem {
  type: 'post' | 'repost';
  /** For reposts: who reposted it. */
  actorUsername: string | null;
  actorDisplayName: string | null;
  /** Sort key (post published time, or repost time). */
  activityAt: string;
  card: PostCard;
}

/** A compact embedded card for a quoted post (or a deleted placeholder). */
export interface QuotedPost {
  deleted: boolean;
  publicId: string | null;
  canonicalPath: string | null;
  title: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  excerpt: string | null;
}

/** One row in the DM inbox list. */
export interface ConversationSummary {
  id: string;
  otherUsername: string;
  otherDisplayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

export interface DmMessageView {
  id: string;
  body: string;
  createdAt: string;
  senderUsername: string;
  mine: boolean;
}

/** A conversation thread prepared for display. */
export interface ConversationView {
  id: string;
  otherUsername: string;
  otherDisplayName: string;
  messages: DmMessageView[];
}

export type MediaVisibility = 'public' | 'unlisted' | 'private';

export interface Media {
  id: string;
  publicId: string;
  userId: string;
  canonicalPath: string;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  storagePath: string;
  thumbnailPath: string | null;
  altText: string | null;
  caption: string | null;
  visibility: MediaVisibility;
  createdAt: string;
}

/** Media prepared for display: owner identity + serving URLs. */
export interface MediaView extends Media {
  ownerUsername: string;
  originalUrl: string;
  thumbnailUrl: string;
}

export type PostStatus = 'draft' | 'published' | 'archived';

export interface Post {
  id: string;
  publicId: string;
  userId: string;
  title: string | null;
  slug: string | null;
  canonicalPath: string;
  markdownBody: string;
  excerpt: string | null;
  coverMediaId: string | null;
  quotePostId: string | null;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A post prepared for display: rendered HTML + author identity. */
export interface PostView extends Post {
  html: string;
  authorUsername: string;
  authorDisplayName: string;
  coverUrl: string | null;
  quoted: QuotedPost | null;
  tags: { name: string; slug: string }[];
}

/** A compact post entry for lists/feeds (no full body). */
export interface PostCard {
  publicId: string;
  title: string | null;
  slug: string | null;
  canonicalPath: string;
  excerpt: string | null;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  authorUsername: string;
  authorDisplayName: string;
  coverUrl: string | null;
  readingMinutes: number;
  likeCount: number;
  commentCount: number;
}

export interface CreatePostInput {
  title?: string | null;
  markdownBody: string;
  excerpt?: string | null;
  status?: PostStatus;
  coverMediaId?: string | null;
  quotePostId?: string | null;
  tags?: string[];
}

export interface UpdatePostInput {
  title?: string | null;
  markdownBody?: string;
  excerpt?: string | null;
  coverMediaId?: string | null;
}

/** Public, shareable view of a profile (counts are zeroed until later milestones). */
export interface ProfileView {
  username: string;
  displayName: string;
  bio: string | null;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  websiteUrl: string | null;
  location: string | null;
  dmPolicy: DmPolicy;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  avatarUrl: string | null;
  coverUrl: string | null;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
  avatarMediaId?: string | null;
  coverMediaId?: string | null;
  dmPolicy?: DmPolicy;
}

/** Base class for all expected (handled) application errors. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'validation_error');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'not_found');
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 'permission_denied');
  }
}

export class AuthError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 'unauthenticated');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'rate_limited');
  }
}
