/**
 * Login PIN generation and validation helpers.
 *
 * In test mode (OPENMEOW_TEST_MODE=1) the generated PIN is always "000000" so
 * automated end-to-end tests can authenticate deterministically. The PIN is
 * still hashed and verified through the normal path; only its value is fixed.
 */
import { randomInt } from 'node:crypto';
import { config, TEST_MODE_PIN } from '../config/env';

const PIN_LENGTH = 6;

/**
 * Generate a 6-digit login PIN.
 *
 * @returns "000000" in test mode, otherwise a random zero-padded 6-digit code
 */
export function generatePin(): string {
  if (config.testMode) return TEST_MODE_PIN;
  return randomInt(0, 1_000_000).toString().padStart(PIN_LENGTH, '0');
}

/** True if the value is a well-formed 6-digit PIN. */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** Compute the absolute expiry timestamp (ISO) for a newly issued PIN. */
export function pinExpiryIso(now: Date = new Date()): string {
  return new Date(now.getTime() + config.pinTtlMinutes * 60_000).toISOString();
}
