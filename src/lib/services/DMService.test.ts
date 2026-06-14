import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { FollowRepository } from '../db/repositories/FollowRepository';
import { DMRepository } from '../db/repositories/DMRepository';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { DMService } from './DMService';
import { NotificationService } from './NotificationService';
import { NotFoundError, PermissionError, ValidationError, type DmPolicy, type User } from '../types';

describe('DMService', () => {
  let db: DB;
  let users: UserRepository;
  let follows: FollowRepository;
  let dms: DMService;
  let notifications: NotificationService;
  let ken: User;
  let alice: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    follows = new FollowRepository(db);
    notifications = new NotificationService(new NotificationRepository(db));
    dms = new DMService(new DMRepository(db), users, follows, notifications);
    ken = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    alice = users.create({ email: 'alice@example.com', username: 'alice', displayName: 'Alice' });
  });
  afterEach(() => db.close());

  function setPolicy(user: User, policy: DmPolicy) {
    db.prepare('UPDATE users SET dm_policy = ? WHERE id = ?').run(policy, user.id);
  }

  it('start + send creates a thread visible to both with mine/theirs flags', () => {
    const conv = dms.startConversation(ken.id, 'alice');
    dms.sendMessage(ken.id, conv, 'hello alice');
    dms.sendMessage(alice.id, conv, 'hi ken');

    const kenView = dms.getConversation(ken.id, conv);
    expect(kenView.otherUsername).toBe('alice');
    expect(kenView.messages.map((m) => m.body)).toEqual(['hello alice', 'hi ken']);
    expect(kenView.messages[0].mine).toBe(true);
    expect(kenView.messages[1].mine).toBe(false);

    const aliceView = dms.getConversation(alice.id, conv);
    expect(aliceView.messages[0].mine).toBe(false);
  });

  it('reuses the same conversation for the same pair', () => {
    const a = dms.startConversation(ken.id, 'alice');
    const b = dms.startConversation(alice.id, 'ken');
    expect(a).toBe(b);
  });

  it('cannot message yourself', () => {
    expect(() => dms.startConversation(ken.id, 'ken')).toThrow(ValidationError);
  });

  it('empty message is rejected', () => {
    const conv = dms.startConversation(ken.id, 'alice');
    expect(() => dms.sendMessage(ken.id, conv, '  ')).toThrow(ValidationError);
  });

  it('unread count reflects messages from others and clears on open', () => {
    const conv = dms.startConversation(ken.id, 'alice');
    dms.sendMessage(ken.id, conv, 'm1');
    dms.sendMessage(ken.id, conv, 'm2');
    expect(dms.unreadCount(alice.id)).toBe(2);
    expect(dms.unreadCount(ken.id)).toBe(0); // own messages don't count
    dms.getConversation(alice.id, conv); // opening marks read
    expect(dms.unreadCount(alice.id)).toBe(0);
  });

  it('sender can delete own message; others cannot', () => {
    const conv = dms.startConversation(ken.id, 'alice');
    const msg = dms.sendMessage(ken.id, conv, 'oops');
    expect(() => dms.deleteMessage(alice.id, msg.id)).toThrow(PermissionError);
    dms.deleteMessage(ken.id, msg.id);
    expect(dms.getConversation(ken.id, conv).messages).toHaveLength(0);
  });

  it('sending a message notifies the recipient', () => {
    const conv = dms.startConversation(ken.id, 'alice');
    dms.sendMessage(ken.id, conv, 'ping');
    expect(notifications.list(alice.id).items.some((n) => n.type === 'dm_message')).toBe(true);
  });

  it('non-members cannot read or send', () => {
    const bob = users.create({ email: 'b@x.com', username: 'bob', displayName: 'Bob' });
    const conv = dms.startConversation(ken.id, 'alice');
    expect(() => dms.getConversation(bob.id, conv)).toThrow(NotFoundError);
    expect(() => dms.sendMessage(bob.id, conv, 'sneaky')).toThrow(NotFoundError);
  });

  describe('DM policy', () => {
    it('everyone allows anyone', () => {
      setPolicy(alice, 'everyone');
      expect(() => dms.startConversation(ken.id, 'alice')).not.toThrow();
    });

    it('nobody blocks everyone', () => {
      setPolicy(alice, 'nobody');
      expect(() => dms.startConversation(ken.id, 'alice')).toThrow(PermissionError);
    });

    it('following allows only users the recipient follows', () => {
      setPolicy(alice, 'following');
      expect(() => dms.startConversation(ken.id, 'alice')).toThrow(PermissionError);
      follows.follow(alice.id, ken.id); // alice follows ken
      expect(() => dms.startConversation(ken.id, 'alice')).not.toThrow();
    });

    it('mutual requires both to follow each other', () => {
      setPolicy(alice, 'mutual');
      follows.follow(alice.id, ken.id);
      expect(() => dms.startConversation(ken.id, 'alice')).toThrow(PermissionError);
      follows.follow(ken.id, alice.id);
      expect(() => dms.startConversation(ken.id, 'alice')).not.toThrow();
    });
  });
});
