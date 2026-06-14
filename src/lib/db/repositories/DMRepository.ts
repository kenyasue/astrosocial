/** Data access for direct messages (1-to-1). Parameterized SQL only (no ORM). */
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { ConversationSummary, DmMessageView } from '../../types';

export interface RawMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  deletedAt: string | null;
}

export class DMRepository {
  constructor(private readonly db: DB) {}

  /** Find the existing 1-to-1 conversation between two users, or create one. */
  findOrCreateConversation(userA: string, userB: string): string {
    const existing = this.db
      .prepare(
        `SELECT m1.conversation_id AS id
         FROM dm_conversation_members m1
         JOIN dm_conversation_members m2 ON m1.conversation_id = m2.conversation_id
         WHERE m1.user_id = ? AND m2.user_id = ?
         LIMIT 1`
      )
      .get(userA, userB) as { id: string } | undefined;
    if (existing) return existing.id;

    const now = new Date().toISOString();
    const convId = randomUUID();
    const tx = this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO dm_conversations (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run(convId, now, now);
      for (const uid of [userA, userB]) {
        this.db
          .prepare(
            'INSERT INTO dm_conversation_members (id, conversation_id, user_id, created_at) VALUES (?, ?, ?, ?)'
          )
          .run(randomUUID(), convId, uid, now);
      }
    });
    tx();
    return convId;
  }

  isMember(conversationId: string, userId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ?')
        .get(conversationId, userId) !== undefined
    );
  }

  /** The other member's user id in a 1-to-1 conversation. */
  otherMember(conversationId: string, userId: string): string | null {
    const row = this.db
      .prepare(
        'SELECT user_id FROM dm_conversation_members WHERE conversation_id = ? AND user_id != ? LIMIT 1'
      )
      .get(conversationId, userId) as { user_id: string } | undefined;
    return row?.user_id ?? null;
  }

  addMessage(conversationId: string, senderUserId: string, body: string): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO dm_messages (id, conversation_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(id, conversationId, senderUserId, body, now);
      this.db
        .prepare('UPDATE dm_conversations SET updated_at = ? WHERE id = ?')
        .run(now, conversationId);
    });
    tx();
    return id;
  }

  listMessages(conversationId: string, viewerId: string): DmMessageView[] {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.body, m.created_at, m.sender_user_id, u.username AS sender_username
         FROM dm_messages m JOIN users u ON u.id = m.sender_user_id
         WHERE m.conversation_id = ? AND m.deleted_at IS NULL
         ORDER BY m.created_at ASC`
      )
      .all(conversationId) as {
      id: string;
      body: string;
      created_at: string;
      sender_user_id: string;
      sender_username: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      senderUsername: r.sender_username,
      mine: r.sender_user_id === viewerId,
    }));
  }

  findMessage(id: string): RawMessage | null {
    const row = this.db
      .prepare('SELECT id, conversation_id, sender_user_id, deleted_at FROM dm_messages WHERE id = ?')
      .get(id) as
      | { id: string; conversation_id: string; sender_user_id: string; deleted_at: string | null }
      | undefined;
    return row
      ? {
          id: row.id,
          conversationId: row.conversation_id,
          senderUserId: row.sender_user_id,
          deletedAt: row.deleted_at,
        }
      : null;
  }

  deleteMessage(id: string): void {
    this.db
      .prepare('UPDATE dm_messages SET deleted_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  markRead(conversationId: string, userId: string): void {
    this.db
      .prepare(
        'UPDATE dm_conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?'
      )
      .run(new Date().toISOString(), conversationId, userId);
  }

  /** Inbox: conversations the user belongs to, with the other member + last message + unread. */
  listConversations(userId: string): ConversationSummary[] {
    const rows = this.db
      .prepare(
        `SELECT c.id AS id, c.updated_at AS updated_at,
                other.user_id AS other_id, u.username AS other_username, u.display_name AS other_display_name,
                me.last_read_at AS last_read_at
         FROM dm_conversation_members me
         JOIN dm_conversations c ON c.id = me.conversation_id
         JOIN dm_conversation_members other ON other.conversation_id = c.id AND other.user_id != me.user_id
         JOIN users u ON u.id = other.user_id
         WHERE me.user_id = ?
         ORDER BY c.updated_at DESC`
      )
      .all(userId) as {
      id: string;
      updated_at: string;
      other_id: string;
      other_username: string;
      other_display_name: string;
      last_read_at: string | null;
    }[];

    return rows.map((r) => {
      const last = this.db
        .prepare(
          `SELECT body, created_at FROM dm_messages
           WHERE conversation_id = ? AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(r.id) as { body: string; created_at: string } | undefined;
      const unread = this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM dm_messages
           WHERE conversation_id = ? AND deleted_at IS NULL AND sender_user_id != ?
             AND (? IS NULL OR created_at > ?)`
        )
        .get(r.id, userId, r.last_read_at, r.last_read_at) as { c: number };
      return {
        id: r.id,
        otherUsername: r.other_username,
        otherDisplayName: r.other_display_name,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.created_at ?? null,
        unread: unread.c,
      };
    });
  }

  /** Total unread messages across all of a user's conversations. */
  unreadCount(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM dm_messages m
         JOIN dm_conversation_members me ON me.conversation_id = m.conversation_id AND me.user_id = ?
         WHERE m.deleted_at IS NULL AND m.sender_user_id != ?
           AND (me.last_read_at IS NULL OR m.created_at > me.last_read_at)`
      )
      .get(userId, userId) as { c: number };
    return row.c;
  }
}
