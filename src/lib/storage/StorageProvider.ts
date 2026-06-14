/**
 * Storage provider interface.
 *
 * Abstracts where uploaded media bytes live so the local-filesystem implementation
 * can later be swapped for S3-compatible storage without touching services.
 */
export interface StoredFile {
  /** Provider-relative path used to read/remove the file later. */
  storagePath: string;
  /** The randomized stored file name. */
  fileName: string;
}

export interface StorageProvider {
  /** Persist original bytes; returns the storage path + generated name. */
  saveOriginal(buffer: Buffer, ext: string): StoredFile;
  /** Persist a thumbnail (webp); returns the storage path + generated name. */
  saveThumbnail(buffer: Buffer): StoredFile;
  /** Read previously stored bytes by storage path. */
  read(storagePath: string): Buffer;
  /** Remove a stored file (no error if missing). */
  remove(storagePath: string): void;
}
