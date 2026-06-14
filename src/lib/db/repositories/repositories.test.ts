import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb } from '../../testing/testDb';
import type { DB } from '../connection';
import { UserRepository } from './UserRepository';
import { LoginPinRepository } from './LoginPinRepository';
import { SessionRepository } from './SessionRepository';

describe('UserRepository', () => {
  let db: DB;
  let repo: UserRepository;

  beforeEach(() => {
    db = makeTestDb();
    repo = new UserRepository(db);
  });
  afterEach(() => db.close());

  it('create_thenFindById_returnsUser', () => {
    const user = repo.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    expect(user.id).toBeTruthy();
    expect(user.dmPolicy).toBe('everyone');
    expect(repo.findById(user.id)?.email).toBe('ken@example.com');
  });

  it('findByEmail_and_findByUsername_work', () => {
    repo.create({ email: 'a@example.com', username: 'alice', displayName: 'Alice' });
    expect(repo.findByEmail('a@example.com')?.username).toBe('alice');
    expect(repo.findByUsername('alice')?.email).toBe('a@example.com');
  });

  it('findByEmail_missing_returnsNull', () => {
    expect(repo.findByEmail('nobody@example.com')).toBeNull();
  });

  it('usernameExists_reflectsState', () => {
    expect(repo.usernameExists('ken')).toBe(false);
    repo.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    expect(repo.usernameExists('ken')).toBe(true);
  });

  it('create_duplicateEmail_throws', () => {
    repo.create({ email: 'dup@example.com', username: 'one', displayName: 'One' });
    expect(() => repo.create({ email: 'dup@example.com', username: 'two', displayName: 'Two' })).toThrow();
  });

  it('updateProfile_setsOnlyProvidedFields', () => {
    const user = repo.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    const updated = repo.updateProfile(user.id, { bio: 'hello', location: 'Tokyo' });
    expect(updated?.bio).toBe('hello');
    expect(updated?.location).toBe('Tokyo');
    expect(updated?.displayName).toBe('Ken');
    expect(updated?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('updateProfile_canClearNullableField', () => {
    const user = repo.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
    repo.updateProfile(user.id, { bio: 'x' });
    const cleared = repo.updateProfile(user.id, { bio: null });
    expect(cleared?.bio).toBeNull();
  });
});

describe('LoginPinRepository', () => {
  let db: DB;
  let repo: LoginPinRepository;

  beforeEach(() => {
    db = makeTestDb();
    repo = new LoginPinRepository(db);
  });
  afterEach(() => db.close());

  it('create_thenFindActiveByEmail_returnsLatestUnconsumed', () => {
    repo.create({ email: 'k@example.com', pinHash: 'h1', expiresAt: '2999-01-01T00:00:00.000Z' });
    const active = repo.findActiveByEmail('k@example.com');
    expect(active?.pinHash).toBe('h1');
    expect(active?.failedAttempts).toBe(0);
  });

  it('consume_makesPinInactive', () => {
    const pin = repo.create({ email: 'k@example.com', pinHash: 'h1', expiresAt: '2999-01-01T00:00:00.000Z' });
    repo.consume(pin.id);
    expect(repo.findActiveByEmail('k@example.com')).toBeNull();
  });

  it('incrementFailedAttempts_increases', () => {
    const pin = repo.create({ email: 'k@example.com', pinHash: 'h1', expiresAt: '2999-01-01T00:00:00.000Z' });
    repo.incrementFailedAttempts(pin.id);
    repo.incrementFailedAttempts(pin.id);
    expect(repo.findById(pin.id)?.failedAttempts).toBe(2);
  });

  it('countCreatedSince_countsWithinWindow', () => {
    repo.create({ email: 'k@example.com', pinHash: 'h1', expiresAt: '2999-01-01T00:00:00.000Z' });
    repo.create({ email: 'k@example.com', pinHash: 'h2', expiresAt: '2999-01-01T00:00:00.000Z' });
    expect(repo.countCreatedSince('k@example.com', '2000-01-01T00:00:00.000Z')).toBe(2);
    expect(repo.countCreatedSince('k@example.com', '2999-01-01T00:00:00.000Z')).toBe(0);
  });
});

describe('SessionRepository', () => {
  let db: DB;
  let users: UserRepository;
  let repo: SessionRepository;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    repo = new SessionRepository(db);
  });
  afterEach(() => db.close());

  function makeUser() {
    return users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  }

  it('create_thenFindByTokenHash_returnsSession', () => {
    const user = makeUser();
    repo.create({ userId: user.id, sessionTokenHash: 'th', expiresAt: '2999-01-01T00:00:00.000Z' });
    expect(repo.findByTokenHash('th')?.userId).toBe(user.id);
  });

  it('deleteByTokenHash_removesSession', () => {
    const user = makeUser();
    repo.create({ userId: user.id, sessionTokenHash: 'th', expiresAt: '2999-01-01T00:00:00.000Z' });
    repo.deleteByTokenHash('th');
    expect(repo.findByTokenHash('th')).toBeNull();
  });

  it('deleteExpired_removesOnlyExpired', () => {
    const user = makeUser();
    repo.create({ userId: user.id, sessionTokenHash: 'old', expiresAt: '2000-01-01T00:00:00.000Z' });
    repo.create({ userId: user.id, sessionTokenHash: 'new', expiresAt: '2999-01-01T00:00:00.000Z' });
    const removed = repo.deleteExpired();
    expect(removed).toBe(1);
    expect(repo.findByTokenHash('old')).toBeNull();
    expect(repo.findByTokenHash('new')).not.toBeNull();
  });
});
