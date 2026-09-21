import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppEnvironment } from '../config/environment.js';
import type { ObjectStoragePort } from './assets.types.js';

@Injectable()
export class ObjectStorageService implements ObjectStoragePort {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly signingClient: S3Client;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    const clientOptions = {
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
    };
    this.client = new S3Client({
      ...clientOptions,
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
    });
    this.signingClient = new S3Client({
      ...clientOptions,
      endpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }),
    });
  }

  createUploadUrl(input: {
    contentLength: number;
    contentType: string;
    expiresInSeconds: number;
    metadata: Record<string, string>;
    objectKey: string;
  }): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        ContentLength: input.contentLength,
        ContentType: input.contentType,
        Key: input.objectKey,
        Metadata: input.metadata,
      }),
      {
        expiresIn: input.expiresInSeconds,
        signableHeaders: new Set(['content-type']),
        unhoistableHeaders: new Set(
          Object.keys(input.metadata).map((name) => `x-amz-meta-${name}`),
        ),
      },
    );
  }

  createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  async headObject(objectKey: string) {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        metadata: result.Metadata ?? {},
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async getObject(objectKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    if (!result.Body) throw new Error('Object storage returned an empty body.');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async putObject(
    objectKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: this.bucket,
        ContentLength: body.byteLength,
        ContentType: contentType,
        Key: objectKey,
      }),
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }
}
