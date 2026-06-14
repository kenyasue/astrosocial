import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { LoginPinRepository } from '../db/repositories/LoginPinRepository';
import { SessionRepository } from '../db/repositories/SessionRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { FollowRepository } from '../db/repositories/FollowRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { AuthService } from './AuthService';
import { ProfileService } from './ProfileService';
import type { EmailProvider } from '../auth/email';
import { ValidationError, NotFoundError, RateLimitError, PermissionError } from '../types';
import { hashSecret } from '../crypto/hash';
import { config } from '../config/env';

/** Captures the PIN that was "emailed" so tests can verify with it. */
class CapturingEmailProvider implements EmailProvider {
  lastPin: string | null = null;
  lastEmail: string | null = null;
  sendPin = vi.fn(async (email: string, pin: string) => {
    this.lastEmail = email;
    this.lastPin = pin;
  });
}

describe('AuthService', () => {
  let db: DB;
  let users: UserRepository;
  let pins: LoginPinRepository;
  let sessions: SessionRepository;
  let email: CapturingEmailProvider;
  let auth: AuthService;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    pins = new LoginPinRepository(db);
    sessions = new SessionRepository(db);
    email = new CapturingEmailProvider();
    auth = new AuthService(users, pins, sessions, email);
  });
  afterEach(() => db.close());

  it('requestPin_invalidEmail_throwsValidationError', async () => {
    await expect(auth.requestPin('not-an-email')).rejects.toBeInstanceOf(ValidationError);
  });

  it('requestPin_validEmail_sendsPin', async () => {
    await auth.requestPin('Ken@Example.com');
    expect(email.sendPin).toHaveBeenCalledOnce();
    expect(email.lastEmail).toBe('ken@example.com'); // normalized
    expect(email.lastPin).toMatch(/^\d{6}$/);
  });

  it('requestPin_exceedingRateLimit_throwsRateLimitError', async () => {
    for (let i = 0; i < config.pinMaxPerWindow; i++) {
      await auth.requestPin('ken@example.com');
    }
    await expect(auth.requestPin('ken@example.com')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('verifyPin_correctPin_createsUserAndSession', async () => {
    await auth.requestPin('ken@example.com');
    const result = await auth.verifyPin('ken@example.com', email.lastPin!);
    expect(result.user.email).toBe('ken@example.com');
    expect(result.user.username).toBe('ken');
    expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(auth.getCurrentUser(result.sessionToken)?.id).toBe(result.user.id);
  });

  it('verifyPin_existingUser_doesNotCreateDuplicate', async () => {
    await auth.requestPin('ken@example.com');
    const first = await auth.verifyPin('ken@example.com', email.lastPin!);
    await auth.requestPin('ken@example.com');
    const second = await auth.verifyPin('ken@example.com', email.lastPin!);
    expect(second.user.id).toBe(first.user.id);
  });

  it('verifyPin_wrongPin_throwsAndIncrementsAttempts', async () => {
    await auth.requestPin('ken@example.com');
    await expect(auth.verifyPin('ken@example.com', '111111')).rejects.toBeInstanceOf(ValidationError);
    const active = pins.findActiveByEmail('ken@example.com');
    expect(active?.failedAttempts).toBe(1);
  });

  it('verifyPin_noActivePin_throws', async () => {
    await expect(auth.verifyPin('ghost@example.com', '000000')).rejects.toBeInstanceOf(ValidationError);
  });

  it('verifyPin_expiredPin_throws', async () => {
    // Insert an already-expired PIN directly.
    pins.create({
      email: 'ken@example.com',
      pinHash: hashSecret('123456'),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(auth.verifyPin('ken@example.com', '123456')).rejects.toThrow(/expired/i);
  });

  it('verifyPin_lockedAfterTooManyAttempts_throws', async () => {
    await auth.requestPin('ken@example.com');
    for (let i = 0; i < config.pinMaxFailedAttempts; i++) {
      await auth.verifyPin('ken@example.com', '111111').catch(() => {});
    }
    // Even the correct PIN is now rejected due to lockout.
    await expect(auth.verifyPin('ken@example.com', email.lastPin!)).rejects.toThrow(/attempts/i);
  });

  it('verifyPin_derivesUniqueUsernameOnCollision', async () => {
    users.create({ email: 'other@x.com', username: 'ken', displayName: 'Ken' });
    await auth.requestPin('ken@example.com');
    const result = await auth.verifyPin('ken@example.com', email.lastPin!);
    expect(result.user.username).toBe('ken2');
  });

  it('logout_invalidatesSession', async () => {
    await auth.requestPin('ken@example.com');
    const { sessionToken } = await auth.verifyPin('ken@example.com', email.lastPin!);
    auth.logout(sessionToken);
    expect(auth.getCurrentUser(sessionToken)).toBeNull();
  });

  it('getCurrentUser_nullToken_returnsNull', () => {
    expect(auth.getCurrentUser(null)).toBeNull();
    expect(auth.getCurrentUser('garbage')).toBeNull();
  });
});

describe('ProfileService', () => {
  let db: DB;
  let users: UserRepository;
  let media: MediaRepository;
  let profiles: ProfileService;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    media = new MediaRepository(db);
    profiles = new ProfileService(users, new PostRepository(db), new FollowRepository(db), media);
  });
  afterEach(() => db.close());

  function makeUser() {
    return users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  }

  function makeMedia(ownerId: string, publicId: string) {
    return media.create({
      publicId,
      userId: ownerId,
      canonicalPath: `/@x/media/${publicId}`,
      fileName: `${publicId}.png`,
      originalFileName: 'pic.png',
      mimeType: 'image/png',
      fileSize: 10,
      width: 1,
      height: 1,
      durationSeconds: null,
      storagePath: `/s/${publicId}`,
      thumbnailPath: `/t/${publicId}`,
      visibility: 'public',
    });
  }

  it('getPublicProfile_existing_returnsViewWithZeroCounts', () => {
    makeUser();
    const view = profiles.getPublicProfile('ken');
    expect(view.username).toBe('ken');
    expect(view.postCount).toBe(0);
    expect(view.followerCount).toBe(0);
  });

  it('getPublicProfile_missing_throwsNotFound', () => {
    expect(() => profiles.getPublicProfile('ghost')).toThrow(NotFoundError);
  });

  it('updateProfile_validInput_persists', () => {
    const user = makeUser();
    const updated = profiles.updateProfile(user.id, {
      displayName: 'Ken Y',
      bio: 'Indie dev',
      websiteUrl: 'https://ken.example',
      location: 'Tokyo',
    });
    expect(updated.displayName).toBe('Ken Y');
    expect(updated.bio).toBe('Indie dev');
    expect(updated.websiteUrl).toBe('https://ken.example');
  });

  it('updateProfile_emptyDisplayName_throws', () => {
    const user = makeUser();
    expect(() => profiles.updateProfile(user.id, { displayName: '   ' })).toThrow(ValidationError);
  });

  it('updateProfile_invalidWebsiteUrl_throws', () => {
    const user = makeUser();
    expect(() => profiles.updateProfile(user.id, { websiteUrl: 'javascript:alert(1)' })).toThrow(
      ValidationError
    );
  });

  it('updateProfile_unknownUser_throwsNotFound', () => {
    expect(() => profiles.updateProfile('missing-id', { displayName: 'X' })).toThrow(NotFoundError);
  });

  it('updateProfile_avatarAndCover_resolvePublicIdsToMediaUrls', () => {
    const user = makeUser();
    makeMedia(user.id, 'm_avatar01');
    makeMedia(user.id, 'm_cover01');
    profiles.updateProfile(user.id, { avatarMediaId: 'm_avatar01', coverMediaId: 'm_cover01' });

    const view = profiles.getPublicProfile('ken');
    expect(view.avatarUrl).toBe('/media/m_avatar01/thumbnail');
    expect(view.coverUrl).toBe('/media/m_cover01/original');
  });

  it('updateProfile_unknownMedia_throwsValidation', () => {
    const user = makeUser();
    expect(() => profiles.updateProfile(user.id, { avatarMediaId: 'm_missing' })).toThrow(
      ValidationError
    );
  });

  it('updateProfile_mediaOwnedByAnotherUser_throwsPermission', () => {
    const user = makeUser();
    const other = users.create({ email: 'eve@example.com', username: 'eve', displayName: 'Eve' });
    makeMedia(other.id, 'm_eve01');
    expect(() => profiles.updateProfile(user.id, { avatarMediaId: 'm_eve01' })).toThrow(
      PermissionError
    );
  });

  it('getPublicProfile_noAvatarOrCover_returnsNullUrls', () => {
    makeUser();
    const view = profiles.getPublicProfile('ken');
    expect(view.avatarUrl).toBeNull();
    expect(view.coverUrl).toBeNull();
  });
});
