import { describe, it, expect } from 'vitest';
import { TEST_MODE_PIN } from '../config/env';
import { generatePin, isValidPinFormat, pinExpiryIso } from './pin';
import {
  generateSessionToken,
  hashSessionToken,
  buildSessionCookie,
  buildClearSessionCookie,
  readSessionCookie,
} from './session';

describe('pin', () => {
  it('generatePin_returnsSixDigits', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidPinFormat(generatePin())).toBe(true);
    }
  });

  it('TEST_MODE_PIN_isAllZeroes', () => {
    expect(TEST_MODE_PIN).toBe('000000');
    expect(isValidPinFormat(TEST_MODE_PIN)).toBe(true);
  });

  it('isValidPinFormat_rejectsNonSixDigit', () => {
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('1234567')).toBe(false);
    expect(isValidPinFormat('abcdef')).toBe(false);
  });

  it('pinExpiryIso_isInTheFuture', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = new Date(pinExpiryIso(now));
    expect(expiry.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('session', () => {
  it('generateSessionToken_isUnique', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    expect(tokens.size).toBe(100);
  });

  it('hashSessionToken_isDeterministicAndNotPlaintext', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it('buildSessionCookie_setsSecurityAttributes', () => {
    const cookie = buildSessionCookie('abc');
    expect(cookie).toContain('om_session=abc');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('buildClearSessionCookie_expiresImmediately', () => {
    expect(buildClearSessionCookie()).toContain('Max-Age=0');
  });

  it('readSessionCookie_parsesNamedCookie', () => {
    expect(readSessionCookie('other=1; om_session=tok123; foo=bar')).toBe('tok123');
  });

  it('readSessionCookie_missing_returnsNull', () => {
    expect(readSessionCookie('other=1')).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });
});
