import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import { ObjectStorageService } from './object-storage.service.js';

describe('ObjectStorageService', () => {
  it('uses the public endpoint in client-facing signed URLs', async () => {
    const config = new ConfigService<AppEnvironment, true>({
      S3_ACCESS_KEY: 'access',
      S3_BUCKET: 'uploads',
      S3_ENDPOINT: 'http://minio:9000',
      S3_FORCE_PATH_STYLE: true,
      S3_PUBLIC_ENDPOINT: 'https://objects.example.test',
      S3_REGION: 'us-east-1',
      S3_SECRET_KEY: 'secret',
    } as unknown as AppEnvironment);
    const storage = new ObjectStorageService(config);

    const url = await storage.createUploadUrl({
      contentLength: 100,
      contentType: 'image/png',
      expiresInSeconds: 300,
      metadata: { 'upload-intent-id': 'intent-id' },
      objectKey: 'uploads/place/object',
    });

    expect(new URL(url).origin).toBe('https://objects.example.test');
  });
});
