import { describe, it, expect } from 'vitest';
import { hashSecret, verifySecret } from './hash';

describe('hashSecret / verifySecret', () => {
  it('hashSecret_anySecret_doesNotStorePlaintext', () => {
    const hashed = hashSecret('000000');
    expect(hashed).not.toContain('000000');
    expect(hashed).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('hashSecret_sameInput_producesDifferentHashes', () => {
    expect(hashSecret('secret')).not.toBe(hashSecret('secret'));
  });

  it('verifySecret_correctSecret_returnsTrue', () => {
    const hashed = hashSecret('a-strong-token');
    expect(verifySecret('a-strong-token', hashed)).toBe(true);
  });

  it('verifySecret_wrongSecret_returnsFalse', () => {
    const hashed = hashSecret('a-strong-token');
    expect(verifySecret('wrong', hashed)).toBe(false);
  });

  it('verifySecret_malformedStored_returnsFalse', () => {
    expect(verifySecret('x', 'not-a-valid-hash')).toBe(false);
    expect(verifySecret('x', '')).toBe(false);
  });
});
