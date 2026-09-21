import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import type { Clock } from '../platform/clock/clock.js';
import { AssetsService } from './assets.service.js';
import type {
  AssetsRepositoryPort,
  MediaQueuePort,
  ObjectStoragePort,
  UploadIntentRecord,
} from './assets.types.js';

describe('AssetsService', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');
  const clock: Clock = { now: () => now };
  const intent: UploadIntentRecord = {
    assetId: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
    expectedMimeType: 'image/png',
    expectedSizeBytes: 1024,
    id: '01997a4e-a200-7000-8000-000000000001',
    objectKey: 'uploads/place-id/object-id',
    originalFileName: 'photo.png',
    placeId: 'place-id',
    status: 'pending',
    userId: 'user-id',
  };
  const config = new ConfigService<AppEnvironment, true>({
    ASSET_DOWNLOAD_URL_TTL_SECONDS: 300,
    UPLOAD_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    UPLOAD_LIMIT_BYTES: 2048,
    UPLOAD_PLACE_QUOTA_BYTES: 8192,
    UPLOAD_URL_TTL_SECONDS: 900,
    UPLOAD_USER_QUOTA_BYTES: 4096,
  } as unknown as AppEnvironment);
  const completeIntent = vi.fn<AssetsRepositoryPort['completeIntent']>();
  const findAsset = vi.fn<AssetsRepositoryPort['findAsset']>();
  const findIntent = vi
    .fn<AssetsRepositoryPort['findIntent']>()
    .mockResolvedValue(intent);
  const reserveIntent = vi
    .fn<AssetsRepositoryPort['reserveIntent']>()
    .mockResolvedValue({ intent });
  const assets: AssetsRepositoryPort = {
    completeIntent,
    findAsset,
    findIntent,
    reserveIntent,
    setPlaceImage: vi.fn(),
    setUserImage: vi.fn(),
  };
  const createDownloadUrl = vi.fn<ObjectStoragePort['createDownloadUrl']>();
  const createUploadUrl = vi
    .fn<ObjectStoragePort['createUploadUrl']>()
    .mockResolvedValue('https://storage.test/upload');
  const headObject = vi.fn<ObjectStoragePort['headObject']>();
  const storage: ObjectStoragePort = {
    createDownloadUrl,
    createUploadUrl,
    headObject,
  };
  const enqueue = vi.fn<MediaQueuePort['enqueue']>();
  const mediaQueue: MediaQueuePort = { enqueue };
  const completedAsset = {
    createdAt: now,
    declaredMimeType: 'image/png',
    detectedMimeType: null,
    id: '01997a4e-a200-7000-8000-000000000002',
    objectKey: intent.objectKey,
    originalFileName: intent.originalFileName,
    placeId: intent.placeId,
    sizeBytes: intent.expectedSizeBytes,
    status: 'quarantined' as const,
    uploadedByUserId: intent.userId,
  };

  beforeEach(() => vi.clearAllMocks());

  it('reserves quota and returns a presigned upload contract', async () => {
    const service = new AssetsService(
      assets,
      storage,
      mediaQueue,
      config,
      clock,
    );

    await expect(
      service.createUploadIntent('place-id', 'user-id', {
        fileName: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).resolves.toEqual({
      expiresAt: intent.expiresAt,
      id: intent.id,
      requiredHeaders: {
        'content-length': '1024',
        'content-type': 'image/png',
        'x-amz-meta-upload-intent-id': intent.id,
      },
      uploadUrl: 'https://storage.test/upload',
    });
    expect(reserveIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedMimeType: 'image/png',
        expectedSizeBytes: 1024,
        placeId: 'place-id',
        userId: 'user-id',
      }),
      { placeBytes: 8192, userBytes: 4096 },
      now,
    );
  });

  it('rejects unsupported types and quota overflow before reserving storage', async () => {
    const service = new AssetsService(
      assets,
      storage,
      mediaQueue,
      config,
      clock,
    );

    await expect(
      service.createUploadIntent('place-id', 'user-id', {
        fileName: 'payload.exe',
        mimeType: 'application/octet-stream',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow('This file type is not allowed.');

    reserveIntent.mockResolvedValueOnce({
      quotaExceeded: 'user',
    });
    await expect(
      service.createUploadIntent('place-id', 'user-id', {
        fileName: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow('The user upload quota would be exceeded.');
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects completion when stored metadata differs from the intent', async () => {
    headObject.mockResolvedValue({
      contentLength: 1023,
      contentType: 'image/png',
      metadata: { 'upload-intent-id': intent.id },
    });
    const service = new AssetsService(
      assets,
      storage,
      mediaQueue,
      config,
      clock,
    );

    await expect(
      service.completeUpload('place-id', 'user-id', intent.id),
    ).rejects.toThrow('The uploaded object does not match the upload intent.');
    expect(completeIntent).not.toHaveBeenCalled();
  });

  it('completes verified storage without exposing its private object key', async () => {
    headObject.mockResolvedValue({
      contentLength: 1024,
      contentType: 'image/png',
      metadata: { 'upload-intent-id': intent.id },
    });
    completeIntent.mockResolvedValue(completedAsset);
    const service = new AssetsService(
      assets,
      storage,
      mediaQueue,
      config,
      clock,
    );

    const result = await service.completeUpload(
      'place-id',
      'user-id',
      intent.id,
    );

    expect(result).not.toHaveProperty('objectKey');
    expect(result).toMatchObject({
      id: completedAsset.id,
      status: 'quarantined',
    });
    expect(enqueue).toHaveBeenCalledWith(completedAsset.id, 'place-id');
  });
});
