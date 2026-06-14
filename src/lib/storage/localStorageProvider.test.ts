import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageProvider } from './localStorageProvider';

describe('LocalStorageProvider', () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'om-storage-'));
    storage = new LocalStorageProvider(root);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('saveOriginal_thenRead_returnsSameBytes', () => {
    const data = Buffer.from('hello');
    const { storagePath, fileName } = storage.saveOriginal(data, 'png');
    expect(fileName).toMatch(/^[0-9a-f]{32}\.png$/);
    expect(storage.read(storagePath).equals(data)).toBe(true);
  });

  it('saveThumbnail_usesWebpExtension', () => {
    const { fileName } = storage.saveThumbnail(Buffer.from('x'));
    expect(fileName).toMatch(/\.webp$/);
  });

  it('remove_deletesFile', () => {
    const { storagePath } = storage.saveOriginal(Buffer.from('x'), 'png');
    storage.remove(storagePath);
    expect(() => storage.read(storagePath)).toThrow();
  });

  it('remove_missingFile_doesNotThrow', () => {
    expect(() => storage.remove('originals/does-not-exist.png')).not.toThrow();
  });

  it('read_pathTraversal_isRejected', () => {
    expect(() => storage.read('../../etc/passwd')).toThrow(/Invalid storage path/);
    expect(() => storage.read('originals/../../escape')).toThrow(/Invalid storage path/);
  });
});
