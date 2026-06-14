/**
 * Direct message service: 1-to-1 conversations with privacy-policy enforcement.
 *
 * Policy (recipient's `dm_policy`) decides who may send to them:
 *  - everyone:  anyone
 *  - following: only users the recipient follows
 *  - mutual:    only mutual follows
 *  - nobody:    no one
 */
import type { ConversationSummary, ConversationView, DmMessageView, User } from '../types';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import type { DMRepository } from '../db/repositories/DMRepository';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { FollowRepository } from '../db/repositories/FollowRepository';
import type { NotificationService } from './NotificationService';

const MAX_MESSAGE = 4000;

export class DMService {
  constructor(
    private readonly dms: DMRepository,
    private readonly users: UserRepository,
    private readonly follows: FollowRepository,
    private readonly notifier: NotificationService
  ) {}

  /** Whether `senderId` is allowed to message `recipient` given their policy. */
  canMessage(senderId: string, recipient: User): boolean {
    switch (recipient.dmPolicy) {
      case 'everyone':
        return true;
      case 'following':
        return this.follows.isFollowing(recipient.id, senderId);
      case 'mutual':
        return (
          this.follows.isFollowing(recipient.id, senderId) &&
          this.follows.isFollowing(senderId, recipient.id)
        );
      case 'nobody':
        return false;
      default:
        return false;
    }
  }

  /** Start (or open) a conversation with another user by username. */
  startConversation(senderId: string, recipientUsername: string): string {
    const recipient = this.users.findByUsername(recipientUsername);
    if (!recipient) throw new NotFoundError('User not found');
    if (recipient.id === senderId) throw new ValidationError('You cannot message yourself', 'recipient');
    if (!this.canMessage(senderId, recipient)) {
      throw new PermissionError('This user does not accept messages from you');
    }
    return this.dms.findOrCreateConversation(senderId, recipient.id);
  }

  sendMessage(senderId: string, conversationId: string, body: string): DmMessageView {
    if (!this.dms.isMember(conversationId, senderId)) throw new NotFoundError('Conversation not found');
    const text = (body ?? '').trim();
    if (!text) throw new ValidationError('Message cannot be empty', 'body');
    if (text.length > MAX_MESSAGE) throw new ValidationError('Message is too long', 'body');

    const otherId = this.dms.otherMember(conversationId, senderId);
    if (!otherId) throw new NotFoundError('Conversation not found');
    const recipient = this.users.findById(otherId);
    if (!recipient || !this.canMessage(senderId, recipient)) {
      throw new PermissionError('This user does not accept messages from you');
    }

    const id = this.dms.addMessage(conversationId, senderId, text);
    this.notifier.notify(otherId, senderId, 'dm_message', {});
    const sender = this.users.findById(senderId);
    return { id, body: text, createdAt: new Date().toISOString(), senderUsername: sender?.username ?? '', mine: true };
  }

  listInbox(userId: string): ConversationSummary[] {
    return this.dms.listConversations(userId);
  }

  /** Get a conversation thread and mark it read for the viewer. */
  getConversation(userId: string, conversationId: string): ConversationView {
    if (!this.dms.isMember(conversationId, userId)) throw new NotFoundError('Conversation not found');
    const otherId = this.dms.otherMember(conversationId, userId);
    const other = otherId ? this.users.findById(otherId) : null;
    const messages = this.dms.listMessages(conversationId, userId);
    this.dms.markRead(conversationId, userId);
    return {
      id: conversationId,
      otherUsername: other?.username ?? 'unknown',
      otherDisplayName: other?.displayName ?? 'Unknown',
      messages,
    };
  }

  markRead(userId: string, conversationId: string): void {
    if (!this.dms.isMember(conversationId, userId)) throw new NotFoundError('Conversation not found');
    this.dms.markRead(conversationId, userId);
  }

  /** Delete one of the user's own messages (soft delete). */
  deleteMessage(userId: string, messageId: string): void {
    const msg = this.dms.findMessage(messageId);
    if (!msg || msg.deletedAt) throw new NotFoundError('Message not found');
    if (msg.senderUserId !== userId) throw new PermissionError('You can only delete your own messages');
    this.dms.deleteMessage(messageId);
  }

  unreadCount(userId: string): number {
    return this.dms.unreadCount(userId);
  }
}
