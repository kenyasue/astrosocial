/**
 * Authentication service: passwordless email-PIN login.
 *
 * Flow:
 *  - requestPin: rate-limit, generate + hash + store a PIN, deliver by email.
 *  - verifyPin:  validate the active PIN (expiry, attempts), find-or-create the
 *                user, open a session, and return the raw session token.
 *
 * PINs and session tokens are never stored in plaintext.
 */
import type { User } from '../types';
import { RateLimitError, ValidationError } from '../types';
import { config } from '../config/env';
import { hashSecret, verifySecret } from '../crypto/hash';
import { generatePin, isValidPinFormat, pinExpiryIso } from '../auth/pin';
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiryIso,
} from '../auth/session';
import type { EmailProvider } from '../auth/email';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { LoginPinRepository } from '../db/repositories/LoginPinRepository';
import type { SessionRepository } from '../db/repositories/SessionRepository';
import { isValidEmail, normalizeEmail } from '../email/address';

export interface VerifyResult {
  user: User;
  /** Raw session token to set in the client cookie (never persisted raw). */
  sessionToken: string;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly pins: LoginPinRepository,
    private readonly sessions: SessionRepository,
    private readonly email: EmailProvider
  ) {}

  /**
   * Issue a login PIN for an email address and deliver it.
   * @throws ValidationError on malformed email; RateLimitError when exceeded
   */
  async requestPin(emailRaw: string): Promise<void> {
    const email = normalizeEmail(emailRaw);
    if (!isValidEmail(email)) {
      throw new ValidationError('A valid email address is required', 'email');
    }

    const windowStart = new Date(Date.now() - config.pinWindowMinutes * 60_000).toISOString();
    const recent = this.pins.countCreatedSince(email, windowStart);
    if (recent >= config.pinMaxPerWindow) {
      throw new RateLimitError('Too many PIN requests. Please try again later.');
    }

    const pin = generatePin();
    this.pins.create({ email, pinHash: hashSecret(pin), expiresAt: pinExpiryIso() });
    await this.email.sendPin(email, pin);
  }

  /**
   * Verify a PIN and open a session, creating the user on first login.
   * @throws ValidationError when the PIN is missing/expired/locked/incorrect
   */
  async verifyPin(emailRaw: string, pin: string): Promise<VerifyResult> {
    const email = normalizeEmail(emailRaw);
    if (!isValidPinFormat(pin)) {
      throw new ValidationError('Enter the 6-digit PIN', 'pin');
    }

    const active = this.pins.findActiveByEmail(email);
    if (!active) {
      throw new ValidationError('No active PIN. Please request a new one.', 'pin');
    }

    if (new Date(active.expiresAt).getTime() < Date.now()) {
      throw new ValidationError('This PIN has expired. Please request a new one.', 'pin');
    }

    if (active.failedAttempts >= config.pinMaxFailedAttempts) {
      throw new ValidationError('Too many incorrect attempts. Please request a new PIN.', 'pin');
    }

    if (!verifySecret(pin, active.pinHash)) {
      this.pins.incrementFailedAttempts(active.id);
      throw new ValidationError('Incorrect PIN.', 'pin');
    }

    this.pins.consume(active.id);

    const user = this.users.findByEmail(email) ?? this.createUser(email);

    const token = generateSessionToken();
    this.sessions.create({
      userId: user.id,
      sessionTokenHash: hashSessionToken(token),
      expiresAt: sessionExpiryIso(),
    });

    return { user, sessionToken: token };
  }

  /** Resolve the current user from a raw session token, or null. */
  getCurrentUser(token: string | null): User | null {
    if (!token) return null;
    const session = this.sessions.findByTokenHash(hashSessionToken(token));
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.deleteByTokenHash(session.sessionTokenHash);
      return null;
    }
    this.sessions.touch(session.id);
    return this.users.findById(session.userId);
  }

  /** Invalidate a session by its raw token. */
  logout(token: string | null): void {
    if (!token) return;
    this.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  /** Create a user, deriving a unique username from the email local-part. */
  private createUser(email: string): User {
    const username = this.deriveUniqueUsername(email);
    return this.users.create({ email, username, displayName: username });
  }

  private deriveUniqueUsername(email: string): string {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 20) || 'user';

    if (!this.users.usernameExists(base)) return base;
    for (let n = 2; n < 10_000; n++) {
      const candidate = `${base}${n}`;
      if (!this.users.usernameExists(candidate)) return candidate;
    }
    // Extremely unlikely fallback.
    return `${base}${Date.now()}`;
  }
}
