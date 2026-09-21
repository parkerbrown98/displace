import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { AppEnvironment } from '../config/environment.js';
import type { AssetsRepository } from './assets.repository.js';
import type { MalwareScannerService } from './malware-scanner.service.js';
import { MediaProcessorService } from './media-processor.service.js';
import type { ObjectStorageService } from './object-storage.service.js';

describe('MediaProcessorService', () => {
  const config = new ConfigService<AppEnvironment, true>({
    IMAGE_MAX_PIXELS: 40_000_000,
  } as unknown as AppEnvironment);
  const asset = {
    createdAt: new Date('2026-09-21T12:00:00.000Z'),
    declaredMimeType: 'image/png',
    detectedMimeType: null,
    id: '01997a4e-a200-7000-8000-000000000002',
    objectKey: 'uploads/place-id/object-id',
    originalFileName: 'photo.png',
    placeId: 'place-id',
    sizeBytes: 0,
    status: 'quarantined' as const,
    uploadedByUserId: 'user-id',
  };
  const assets = {
    beginProcessing: vi.fn(),
    findAsset: vi.fn(),
    markReady: vi.fn(),
    markRejected: vi.fn(),
  };
  const scanner = { scan: vi.fn().mockResolvedValue('skipped') };
  const storage = {
    deleteObject: vi.fn(),
    getObject: vi.fn(),
    putObject: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('re-encodes images without metadata and creates bounded variants', async () => {
    const content = await sharp({
      create: { background: '#cc3300', channels: 3, height: 480, width: 640 },
    })
      .png()
      .withMetadata({ comment: 'remove me' })
      .toBuffer();
    vi.mocked(assets.beginProcessing).mockResolvedValue({
      ...asset,
      sizeBytes: content.byteLength,
    });
    vi.mocked(storage.getObject).mockResolvedValue(content);
    const service = createService();

    await service.process(asset.id, asset.placeId);

    expect(storage.putObject).toHaveBeenCalledTimes(3);
    expect(assets.markReady).toHaveBeenCalledWith(
      asset.id,
      'image/png',
      'skipped',
      { height: 480, width: 640 },
      [
        expect.objectContaining({ kind: 'thumbnail', mimeType: 'image/webp' }),
        expect.objectContaining({ kind: 'content', mimeType: 'image/webp' }),
      ],
    );
    const original = vi.mocked(storage.putObject).mock.calls[0]?.[1];
    expect((await sharp(original).metadata()).comments).toBeUndefined();
  });

  it('deletes and rejects an object whose sniffed type differs from its declaration', async () => {
    const content = await sharp({
      create: { background: '#ffffff', channels: 3, height: 10, width: 10 },
    })
      .png()
      .toBuffer();
    vi.mocked(assets.beginProcessing).mockResolvedValue({
      ...asset,
      declaredMimeType: 'image/jpeg',
      sizeBytes: content.byteLength,
    });
    vi.mocked(storage.getObject).mockResolvedValue(content);
    const service = createService();

    await service.process(asset.id, asset.placeId);

    expect(scanner.scan).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(asset.objectKey);
    expect(assets.markRejected).toHaveBeenCalledWith(asset.id, 'failed');
    expect(assets.markReady).not.toHaveBeenCalled();
  });

  function createService() {
    return new MediaProcessorService(
      config,
      assets as unknown as AssetsRepository,
      scanner as unknown as MalwareScannerService,
      storage as unknown as ObjectStorageService,
    );
  }
});
