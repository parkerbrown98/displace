import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { getRedisConnection } from '../auth/auth-mail-queue.service.js';
import type { AppEnvironment } from '../config/environment.js';
import type { MediaQueuePort } from './assets.types.js';
import { MEDIA_QUEUE_NAME, type ProcessAssetJob } from './media.types.js';

@Injectable()
export class MediaQueueService
  implements MediaQueuePort, OnApplicationShutdown
{
  private readonly queue: Queue<ProcessAssetJob>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.queue = new Queue<ProcessAssetJob>(MEDIA_QUEUE_NAME, {
      connection: getRedisConnection(config.get('REDIS_URL', { infer: true })),
      defaultJobOptions: {
        attempts: 5,
        backoff: { delay: 2_000, type: 'exponential' },
        removeOnComplete: true,
        removeOnFail: false,
      },
      prefix: 'displace',
    });
  }

  async enqueue(assetId: string, placeId: string): Promise<void> {
    await this.queue.add(
      'asset.process',
      { assetId, kind: 'asset.process', placeId },
      { jobId: `asset-process-${assetId}` },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
