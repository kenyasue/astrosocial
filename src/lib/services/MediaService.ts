/**
 * Media service: validate and store uploads, generate thumbnails, serve bytes
 * (visibility-aware), list, and delete. Upload hardening lives here: MIME +
 * extension + size validation, randomized storage names (via the provider),
 * and image re-processing through sharp.
 */
import sharp from 'sharp';
import type { Media, MediaView, MediaVisibility } from '../types';
import { NotFoundError, PermissionError, ValidationError } from '../types';
import { ALLOWED_MEDIA_TYPES, config } from '../config/env';
import { generatePublicId } from '../urls/publicId';
import { mediaCanonicalPath } from '../urls/canonicalPath';
import type { StorageProvider } from '../storage/StorageProvider';
import type { MediaRepository } from '../db/repositories/MediaRepository';
import type { UserRepository } from '../db/repositories/UserRepository';
import type { PostRepository } from '../db/repositories/PostRepository';

const THUMBNAIL_SIZE = 600;

export interface UploadInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ServedFile {
  buffer: Buffer;
  mimeType: string;
  visibility: MediaVisibility;
}

export class MediaService {
  constructor(
    private readonly media: MediaRepository,
    private readonly users: UserRepository,
    private readonly storage: StorageProvider,
    private readonly posts: PostRepository
  ) {}

  async upload(userId: string, input: UploadInput): Promise<Media> {
    const type = ALLOWED_MEDIA_TYPES[input.mimeType];
    if (!type) throw new ValidationError('Unsupported file type', 'file');

    const limit = type.kind === 'image' ? config.maxImageBytes : config.maxVideoBytes;
    if (input.buffer.length === 0) throw new ValidationError('Empty file', 'file');
    if (input.buffer.length > limit) throw new ValidationError('File is too large', 'file');

    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const publicId = generatePublicId('m');
    let width: number | null = null;
    let height: number | null = null;
    let thumbnailPath: string | null = null;

    if (type.kind === 'image') {
      let meta;
      try {
        meta = await sharp(input.buffer).metadata();
      } catch {
        throw new ValidationError('File is not a valid image', 'file');
      }
      width = meta.width ?? null;
      height = meta.height ?? null;

      const thumb = await sharp(input.buffer)
        .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      thumbnailPath = this.storage.saveThumbnail(thumb).storagePath;
    }

    const original = this.storage.saveOriginal(input.buffer, type.ext);

    return this.media.create({
      publicId,
      userId,
      canonicalPath: mediaCanonicalPath(user.username, publicId),
      fileName: original.fileName,
      originalFileName: input.fileName || null,
      mimeType: input.mimeType,
      fileSize: input.buffer.length,
      width,
      height,
      durationSeconds: null,
      storagePath: original.storagePath,
      thumbnailPath,
      visibility: 'public',
    });
  }

  /** Read bytes for serving, enforcing visibility. */
  getForServing(publicId: string, variant: 'original' | 'thumbnail', viewerId: string | null): ServedFile {
    const media = this.requireVisible(publicId, viewerId);
    const usingThumb = variant === 'thumbnail' && media.thumbnailPath;
    const storagePath = usingThumb ? media.thumbnailPath! : media.storagePath;
    let buffer: Buffer;
    try {
      buffer = this.storage.read(storagePath);
    } catch {
      // The DB record exists but its bytes are missing — treat as not found.
      throw new NotFoundError('Media not found');
    }
    return {
      buffer,
      mimeType: usingThumb ? 'image/webp' : media.mimeType,
      visibility: media.visibility,
    };
  }

  getDetail(publicId: string, viewerId: string | null): MediaView {
    return this.toView(this.requireVisible(publicId, viewerId));
  }

  list(userId: string): MediaView[] {
    return this.media.listByUser(userId).map((m) => this.toView(m));
  }

  /** View for an internal media id (used to prefill a post's existing cover). */
  getViewByInternalId(id: string): MediaView | null {
    const media = this.media.findById(id);
    return media ? this.toView(media) : null;
  }

  delete(userId: string, publicId: string): void {
    const media = this.media.findByPublicId(publicId);
    if (!media) throw new NotFoundError('Media not found');
    if (media.userId !== userId) throw new PermissionError('You do not own this media');
    // Detach from any posts using it as a cover (avoids FK constraint failures).
    this.posts.clearCoverMedia(media.id);
    this.storage.remove(media.storagePath);
    if (media.thumbnailPath) this.storage.remove(media.thumbnailPath);
    this.media.delete(media.id);
  }

  /** Resolve a media item that belongs to the given owner (used for cover validation). */
  requireOwned(publicId: string, userId: string): Media {
    const media = this.media.findByPublicId(publicId);
    if (!media) throw new NotFoundError('Media not found');
    if (media.userId !== userId) throw new PermissionError('You do not own this media');
    return media;
  }

  toView(media: Media): MediaView {
    const owner = this.users.findById(media.userId);
    return {
      ...media,
      ownerUsername: owner?.username ?? 'unknown',
      originalUrl: `/media/${media.publicId}/original`,
      thumbnailUrl: media.thumbnailPath
        ? `/media/${media.publicId}/thumbnail`
        : `/media/${media.publicId}/original`,
    };
  }

  private requireVisible(publicId: string, viewerId: string | null): Media {
    const media = this.media.findByPublicId(publicId);
    if (!media) throw new NotFoundError('Media not found');
    if (media.visibility === 'private' && media.userId !== viewerId) {
      throw new NotFoundError('Media not found');
    }
    return media;
  }
}
