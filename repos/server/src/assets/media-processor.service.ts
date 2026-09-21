import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import sharp, { type Sharp } from 'sharp';
import type { AppEnvironment } from '../config/environment.js';
import { AssetsRepository } from './assets.repository.js';
import { MalwareScannerService } from './malware-scanner.service.js';
import { ObjectStorageService } from './object-storage.service.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

class UnsafeAssetError extends Error {}

@Injectable()
export class MediaProcessorService {
  private readonly imageMaxPixels: number;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly assets: AssetsRepository,
    private readonly scanner: MalwareScannerService,
    private readonly storage: ObjectStorageService,
  ) {
    this.imageMaxPixels = config.get('IMAGE_MAX_PIXELS', { infer: true });
  }

  async process(assetId: string, placeId: string): Promise<void> {
    const asset = await this.assets.beginProcessing(assetId, placeId);
    if (!asset) return;

    try {
      const content = await this.storage.getObject(asset.objectKey);
      if (content.byteLength !== asset.sizeBytes) {
        throw new UnsafeAssetError(
          'Stored object size changed after completion.',
        );
      }
      const detectedMimeType = await this.detectMimeType(
        content,
        asset.declaredMimeType,
      );
      if (detectedMimeType !== asset.declaredMimeType) {
        throw new UnsafeAssetError(
          'Stored object type does not match its declaration.',
        );
      }

      const scanStatus = await this.scanner.scan(content);
      if (scanStatus === 'infected') {
        await this.reject(asset.id, asset.objectKey, 'infected');
        return;
      }

      if (IMAGE_MIME_TYPES.has(detectedMimeType)) {
        const processed = await this.processImage(
          asset.id,
          placeId,
          content,
          detectedMimeType,
        );
        await this.storage.putObject(
          asset.objectKey,
          processed.original,
          detectedMimeType,
        );
        for (const variant of processed.variants) {
          await this.storage.putObject(
            variant.objectKey,
            variant.content,
            variant.mimeType,
          );
        }
        await this.assets.markReady(
          asset.id,
          detectedMimeType,
          scanStatus,
          processed.metadata,
          processed.variants.map(
            ({ content: _content, ...variant }) => variant,
          ),
        );
        return;
      }

      await this.assets.markReady(
        asset.id,
        detectedMimeType,
        scanStatus,
        {},
        [],
      );
    } catch (error) {
      if (error instanceof UnsafeAssetError) {
        await this.reject(asset.id, asset.objectKey, 'failed');
        return;
      }
      throw error;
    }
  }

  async fail(assetId: string, placeId: string): Promise<void> {
    const asset = await this.assets.findAsset(assetId, placeId);
    if (asset) await this.storage.deleteObject(asset.objectKey);
    await this.assets.markRejected(assetId, 'failed');
  }

  private async detectMimeType(
    content: Buffer,
    declaredMimeType: string,
  ): Promise<string> {
    const detected = await fileTypeFromBuffer(content);
    if (detected) return detected.mime;
    if (declaredMimeType === 'text/plain') {
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
          content,
        );
        if (!decoded.includes('\0')) return 'text/plain';
      } catch {
        // Invalid UTF-8 is not accepted as plain text.
      }
    }
    throw new UnsafeAssetError(
      'The stored object type could not be identified.',
    );
  }

  private async processImage(
    assetId: string,
    placeId: string,
    content: Buffer,
    mimeType: string,
  ) {
    const baseOptions = {
      animated: false,
      limitInputPixels: this.imageMaxPixels,
    };
    const metadata = await sharp(content, baseOptions).metadata();
    if (!metadata.width || !metadata.height) {
      throw new UnsafeAssetError('Image dimensions could not be read.');
    }
    const original = await this.encodeOriginal(
      sharp(content, baseOptions).rotate(),
      mimeType,
    );
    const variants = await Promise.all(
      [
        { kind: 'thumbnail', width: 320 },
        { kind: 'content', width: 1280 },
      ].map(async ({ kind, width }) => {
        const result = await sharp(content, baseOptions)
          .rotate()
          .resize({
            fit: 'inside',
            height: width,
            withoutEnlargement: true,
            width,
          })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        return {
          content: result.data,
          height: result.info.height,
          kind,
          mimeType: 'image/webp',
          objectKey: `variants/${placeId}/${assetId}/${kind}.webp`,
          sizeBytes: result.info.size,
          width: result.info.width,
        };
      }),
    );
    return {
      metadata: { height: metadata.height, width: metadata.width },
      original,
      variants,
    };
  }

  private encodeOriginal(image: Sharp, mimeType: string): Promise<Buffer> {
    if (mimeType === 'image/jpeg')
      return image.jpeg({ mozjpeg: true, quality: 90 }).toBuffer();
    if (mimeType === 'image/png')
      return image.png({ compressionLevel: 9 }).toBuffer();
    return image.webp({ quality: 90 }).toBuffer();
  }

  private async reject(
    assetId: string,
    objectKey: string,
    scanStatus: 'failed' | 'infected',
  ): Promise<void> {
    await this.storage.deleteObject(objectKey);
    await this.assets.markRejected(assetId, scanStatus);
  }
}
