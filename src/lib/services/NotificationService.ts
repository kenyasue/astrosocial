/**
 * Notification service: create notifications for social interactions and read
 * them back for a user. Self-notifications (actor === recipient) are skipped.
 */
import type { NotificationType, NotificationView } from '../types';
import type { NotificationRepository } from '../db/repositories/NotificationRepository';

/** Notification types shown under the "Mentions" tab. */
const MENTION_TYPES = ['comment'];

export interface NotificationPage {
  items: NotificationView[];
  nextCursor: string | null;
}

export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}

  /** Notify `recipientUserId` of an action by `actorUserId`. No-op if they match. */
  notify(
    recipientUserId: string,
    actorUserId: string,
    type: NotificationType,
    refs: { postId?: string | null; commentId?: string | null } = {}
  ): void {
    if (!recipientUserId || recipientUserId === actorUserId) return;
    this.notifications.create({
      userId: recipientUserId,
      actorUserId,
      type,
      postId: refs.postId ?? null,
      commentId: refs.commentId ?? null,
    });
  }

  /** Tabbed, paginated list. `tab` is 'all' or 'mentions'. */
  list(userId: string, tab: 'all' | 'mentions' = 'all', cursor?: string): NotificationPage {
    const limit = 30;
    const items = this.notifications.listByUser(userId, {
      types: tab === 'mentions' ? MENTION_TYPES : undefined,
      limit,
      cursor,
    });
    const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;
    return { items, nextCursor };
  }

  /**
   * Mark a single notification read and return where its link should go.
   * Returns null if the notification doesn't belong to the user.
   */
  openAndResolveTarget(userId: string, id: string): string | null {
    const n = this.notifications.findOwned(userId, id);
    if (!n) return null;
    this.notifications.markRead(userId, id);
    if (n.postCanonicalPath) return n.postCanonicalPath;
    if (n.actorUsername) return `/@${n.actorUsername}`;
    return '/notifications';
  }

  unreadCount(userId: string): number {
    return this.notifications.unreadCount(userId);
  }

  markRead(userId: string, id: string): void {
    this.notifications.markRead(userId, id);
  }

  markAllRead(userId: string): void {
    this.notifications.markAllRead(userId);
  }
}
