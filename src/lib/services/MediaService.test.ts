import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import { makeTestDb } from '../testing/testDb';
import type { DB } from '../db/connection';
import { UserRepository } from '../db/repositories/UserRepository';
import { MediaRepository } from '../db/repositories/MediaRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { MediaService } from './MediaService';
import { NotFoundError, PermissionError, ValidationError, type User } from '../types';
import type { StorageProvider, StoredFile } from '../storage/StorageProvider';

/** In-memory storage fake for fast, isolated service tests. */
class FakeStorage implements StorageProvider {
  files = new Map<string, Buffer>();
  private n = 0;
  saveOriginal(buffer: Buffer, ext: string): StoredFile {
    const storagePath = `originals/${this.n++}.${ext}`;
    this.files.set(storagePath, buffer);
    return { storagePath, fileName: storagePath.split('/')[1] };
  }
  saveThumbnail(buffer: Buffer): StoredFile {
    const storagePath = `thumbnails/${this.n++}.webp`;
    this.files.set(storagePath, buffer);
    return { storagePath, fileName: storagePath.split('/')[1] };
  }
  read(storagePath: string): Buffer {
    const b = this.files.get(storagePath);
    if (!b) throw new Error('not found');
    return b;
  }
  remove(storagePath: string): void {
    this.files.delete(storagePath);
  }
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 12, channels: 3, background: '#3366ff' } })
    .png()
    .toBuffer();
}

describe('MediaService', () => {
  let db: DB;
  let users: UserRepository;
  let mediaRepo: MediaRepository;
  let storage: FakeStorage;
  let service: MediaService;
  let user: User;

  beforeEach(() => {
    db = makeTestDb();
    users = new UserRepository(db);
    mediaRepo = new MediaRepository(db);
    storage = new FakeStorage();
    service = new MediaService(mediaRepo, users, storage, new PostRepository(db));
    user = users.create({ email: 'ken@example.com', username: 'ken', displayName: 'Ken' });
  });
  afterEach(() => db.close());

  it('upload_image_storesOriginalAndThumbnail_withDimensions', async () => {
    const media = await service.upload(user.id, {
      fileName: 'pic.png',
      mimeType: 'image/png',
      buffer: await pngBuffer(),
    });
    expect(media.publicId).toMatch(/^m_/);
    expect(media.width).toBe(20);
    expect(media.height).toBe(12);
    expect(media.thumbnailPath).not.toBeNull();
    expect(media.canonicalPath).toBe(`/@ken/media/${media.publicId}`);
    expect(storage.files.size).toBe(2); // original + thumbnail
  });

  it('upload_rejectsUnsupportedType', async () => {
    await expect(
      service.upload(user.id, { fileName: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('upload_rejectsEmptyFile', async () => {
    await expect(
      service.upload(user.id, { fileName: 'x.png', mimeType: 'image/png', buffer: Buffer.alloc(0) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('upload_rejectsNonImageBytesClaimingImageMime', async () => {
    await expect(
      service.upload(user.id, {
        fileName: 'fake.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not really an image'),
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('getForServing_returnsThumbnailWebp_andOriginal', async () => {
    const media = await service.upload(user.id, {
      fileName: 'p.png',
      mimeType: 'image/png',
      buffer: await pngBuffer(),
    });
    expect(service.getForServing(media.publicId, 'thumbnail', null).mimeType).toBe('image/webp');
    expect(service.getForServing(media.publicId, 'original', null).mimeType).toBe('image/png');
  });

  it('getForServing_privateMedia_hiddenFromOthers_visibleToOwner', async () => {
    const media = await service.upload(user.id, {
      fileName: 'p.png',
      mimeType: 'image/png',
      buffer: await pngBuffer(),
    });
    // Flip to private directly via the repository.
    db.prepare('UPDATE media SET visibility = ? WHERE id = ?').run('private', media.id);
    expect(() => service.getForServing(media.publicId, 'original', null)).toThrow(NotFoundError);
    expect(service.getForServing(media.publicId, 'original', user.id).mimeType).toBe('image/png');
  });

  it('upload_video_storesWithoutThumbnail_andServesOriginalForThumbnailVariant', async () => {
    const media = await service.upload(user.id, {
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-mp4-bytes'),
    });
    expect(media.mimeType).toBe('video/mp4');
    expect(media.thumbnailPath).toBeNull();
    expect(media.width).toBeNull();
    // No thumbnail → thumbnail variant falls back to the original bytes.
    expect(service.getForServing(media.publicId, 'thumbnail', null).mimeType).toBe('video/mp4');
  });

  it('list_returnsOwnMediaViews', async () => {
    await service.upload(user.id, { fileName: 'p.png', mimeType: 'image/png', buffer: await pngBuffer() });
    const list = service.list(user.id);
    expect(list).toHaveLength(1);
    expect(list[0].originalUrl).toMatch(/^\/media\/m_/);
    expect(list[0].ownerUsername).toBe('ken');
  });

  it('delete_removesRecordAndFiles_ownerOnly', async () => {
    const media = await service.upload(user.id, {
      fileName: 'p.png',
      mimeType: 'image/png',
      buffer: await pngBuffer(),
    });
    const other = users.create({ email: 'o@x.com', username: 'other', displayName: 'O' });
    expect(() => service.delete(other.id, media.publicId)).toThrow(PermissionError);

    service.delete(user.id, media.publicId);
    expect(mediaRepo.findByPublicId(media.publicId)).toBeNull();
    expect(storage.files.size).toBe(0);
  });
});
