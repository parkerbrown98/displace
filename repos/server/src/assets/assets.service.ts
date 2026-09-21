import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import {
  ASSETS_REPOSITORY,
  MEDIA_QUEUE,
  OBJECT_STORAGE,
} from './assets.constants.js';
import { UploadIntentExpiredError } from './assets.types.js';
import type {
  AssetRecord,
  AssetsRepositoryPort,
  MediaQueuePort,
  ObjectStoragePort,
} from './assets.types.js';

export interface CreateUploadIntentInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class AssetsService {
  constructor(
    @Inject(ASSETS_REPOSITORY)
    private readonly assets: AssetsRepositoryPort,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStoragePort,
    @Inject(MEDIA_QUEUE)
    private readonly mediaQueue: MediaQueuePort,
    private readonly config: ConfigService<AppEnvironment, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async createUploadIntent(
    placeId: string,
    userId: string,
    input: CreateUploadIntentInput,
  ) {
    const fileName = input.fileName.trim();
    if (!fileName) throw new BadRequestException('A file name is required.');
    const mimeType = input.mimeType.trim().toLowerCase();
    if (
      !this.config
        .get('UPLOAD_ALLOWED_MIME_TYPES', { infer: true })
        .includes(mimeType)
    ) {
      throw new BadRequestException('This file type is not allowed.');
    }

    if (
      input.sizeBytes > this.config.get('UPLOAD_LIMIT_BYTES', { infer: true })
    ) {
      throw new PayloadTooLargeException(
        'The upload exceeds the file size limit.',
      );
    }

    const now = this.clock.now();
    const expiresInSeconds = this.config.get('UPLOAD_URL_TTL_SECONDS', {
      infer: true,
    });
    const reservation = await this.assets.reserveIntent(
      {
        expiresAt: new Date(now.getTime() + expiresInSeconds * 1_000),
        expectedMimeType: mimeType,
        expectedSizeBytes: input.sizeBytes,
        objectKey: `uploads/${placeId}/${randomUUID()}`,
        originalFileName: fileName,
        placeId,
        userId,
      },
      {
        placeBytes: this.config.get('UPLOAD_PLACE_QUOTA_BYTES', {
          infer: true,
        }),
        userBytes: this.config.get('UPLOAD_USER_QUOTA_BYTES', { infer: true }),
      },
      now,
    );
    if (reservation.quotaExceeded === 'user') {
      throw new PayloadTooLargeException(
        'The user upload quota would be exceeded.',
      );
    }
    if (reservation.quotaExceeded === 'place') {
      throw new PayloadTooLargeException(
        'The place upload quota would be exceeded.',
      );
    }
    const intent = reservation.intent;
    if (!intent)
      throw new Error('Upload quota reservation did not return an intent.');
    const requiredHeaders = {
      'content-length': String(intent.expectedSizeBytes),
      'content-type': intent.expectedMimeType,
      'x-amz-meta-upload-intent-id': intent.id,
    };
    const uploadUrl = await this.storage.createUploadUrl({
      contentLength: intent.expectedSizeBytes,
      contentType: intent.expectedMimeType,
      expiresInSeconds,
      metadata: { 'upload-intent-id': intent.id },
      objectKey: intent.objectKey,
    });

    return {
      expiresAt: intent.expiresAt,
      id: intent.id,
      requiredHeaders,
      uploadUrl,
    };
  }

  async completeUpload(placeId: string, userId: string, intentId: string) {
    const intent = await this.assets.findIntent(intentId, placeId);
    if (!intent || intent.userId !== userId) {
      throw new NotFoundException('Upload intent not found.');
    }
    if (intent.status === 'completed' && intent.assetId) {
      const asset = await this.assets.findAsset(intent.assetId, placeId);
      if (asset) {
        await this.mediaQueue.enqueue(asset.id, placeId);
        return this.toAsset(asset);
      }
    }
    if (intent.status !== 'pending') {
      throw new ConflictException('The upload intent cannot be completed.');
    }
    if (intent.expiresAt <= this.clock.now()) {
      throw new GoneException('The upload intent has expired.');
    }

    const object = await this.storage.headObject(intent.objectKey);
    if (
      !object ||
      object.contentLength !== intent.expectedSizeBytes ||
      object.contentType?.toLowerCase() !== intent.expectedMimeType ||
      object.metadata['upload-intent-id'] !== intent.id
    ) {
      throw new UnprocessableEntityException(
        'The uploaded object does not match the upload intent.',
      );
    }

    let asset: AssetRecord;
    try {
      asset = await this.assets.completeIntent(
        intent.id,
        placeId,
        this.clock.now(),
      );
    } catch (error) {
      if (error instanceof UploadIntentExpiredError) {
        throw new GoneException('The upload intent has expired.');
      }
      throw error;
    }
    await this.mediaQueue.enqueue(asset.id, placeId);
    return this.toAsset(asset);
  }

  async createDownloadUrl(placeId: string, assetId: string) {
    const asset = await this.assets.findAsset(assetId, placeId);
    if (!asset) throw new NotFoundException('Asset not found.');
    if (asset.status !== 'ready') {
      throw new ConflictException('The asset is not available for download.');
    }
    return {
      expiresInSeconds: this.config.get('ASSET_DOWNLOAD_URL_TTL_SECONDS', {
        infer: true,
      }),
      url: await this.storage.createDownloadUrl(
        asset.objectKey,
        this.config.get('ASSET_DOWNLOAD_URL_TTL_SECONDS', { infer: true }),
      ),
    };
  }

  async getAsset(placeId: string, assetId: string) {
    const asset = await this.assets.findAsset(assetId, placeId);
    if (!asset) throw new NotFoundException('Asset not found.');
    return this.toAsset(asset);
  }

  async setUserImage(
    placeId: string,
    userId: string,
    kind: 'avatar' | 'banner',
    assetId: string,
  ) {
    const reference = await this.assets.setUserImage(
      placeId,
      userId,
      kind,
      assetId,
      this.clock.now(),
    );
    if (!reference) {
      throw new UnprocessableEntityException(
        'The profile image must be a ready image uploaded by the current user.',
      );
    }
    return { assetId: reference.assetId, kind: reference.kind };
  }

  async setPlaceImage(
    placeId: string,
    kind: 'icon' | 'banner',
    assetId: string,
  ) {
    const reference = await this.assets.setPlaceImage(
      placeId,
      kind,
      assetId,
      this.clock.now(),
    );
    if (!reference) {
      throw new UnprocessableEntityException(
        'The place image must be a ready image from this place.',
      );
    }
    return { assetId: reference.assetId, kind: reference.kind };
  }

  private toAsset(asset: AssetRecord) {
    return {
      createdAt: asset.createdAt,
      declaredMimeType: asset.declaredMimeType,
      detectedMimeType: asset.detectedMimeType,
      id: asset.id,
      originalFileName: asset.originalFileName,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
    };
  }
}
