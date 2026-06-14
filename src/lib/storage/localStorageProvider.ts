/**
 * Local-filesystem storage provider.
 *
 * Stores originals under <root>/originals and thumbnails under <root>/thumbnails
 * using crypto-random file names. `read`/`remove` resolve the path inside the root
 * and reject anything that escapes it (path-traversal guard).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { StorageProvider, StoredFile } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private readonly originalsDir: string;
  private readonly thumbnailsDir: string;

  constructor(private readonly root: string) {
    this.originalsDir = path.join(root, 'originals');
    this.thumbnailsDir = path.join(root, 'thumbnails');
    fs.mkdirSync(this.originalsDir, { recursive: true });
    fs.mkdirSync(this.thumbnailsDir, { recursive: true });
  }

  saveOriginal(buffer: Buffer, ext: string): StoredFile {
    fs.mkdirSync(this.originalsDir, { recursive: true });
    const fileName = `${randomBytes(16).toString('hex')}.${sanitizeExt(ext)}`;
    const abs = path.join(this.originalsDir, fileName);
    fs.writeFileSync(abs, buffer);
    return { storagePath: path.join('originals', fileName), fileName };
  }

  saveThumbnail(buffer: Buffer): StoredFile {
    fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    const fileName = `${randomBytes(16).toString('hex')}.webp`;
    const abs = path.join(this.thumbnailsDir, fileName);
    fs.writeFileSync(abs, buffer);
    return { storagePath: path.join('thumbnails', fileName), fileName };
  }

  read(storagePath: string): Buffer {
    return fs.readFileSync(this.resolveInsideRoot(storagePath));
  }

  remove(storagePath: string): void {
    const abs = this.resolveInsideRoot(storagePath);
    if (fs.existsSync(abs)) fs.rmSync(abs);
  }

  /** Resolve a storage path within the root, rejecting traversal escapes. */
  private resolveInsideRoot(storagePath: string): string {
    const abs = path.resolve(this.root, storagePath);
    const rootWithSep = path.resolve(this.root) + path.sep;
    if (abs !== path.resolve(this.root) && !abs.startsWith(rootWithSep)) {
      throw new Error('Invalid storage path');
    }
    return abs;
  }
}

function sanitizeExt(ext: string): string {
  return ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
}
