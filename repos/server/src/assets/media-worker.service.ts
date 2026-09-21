import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../auth/auth-mail-queue.service.js';
import type { AppEnvironment } from '../config/environment.js';
import { MediaProcessorService } from './media-processor.service.js';
import { MEDIA_QUEUE_NAME, type ProcessAssetJob } from './media.types.js';

@Injectable()
export class MediaWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly connection;
  private readonly logger = new Logger(MediaWorkerService.name);
  private worker?: Worker<ProcessAssetJob>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly processor: MediaProcessorService,
  ) {
    this.connection = getRedisConnection(
      config.get('REDIS_URL', { infer: true }),
    );
  }

  onApplicationBootstrap(): void {
    this.worker = new Worker<ProcessAssetJob>(
      MEDIA_QUEUE_NAME,
      (job) => this.process(job),
      { concurrency: 2, connection: this.connection, prefix: 'displace' },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { assetId: job?.data.assetId, error: error.message, jobId: job?.id },
        'Media processing failed',
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ProcessAssetJob>): Promise<void> {
    try {
      await this.processor.process(job.data.assetId, job.data.placeId);
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.processor.fail(job.data.assetId, job.data.placeId);
      }
      throw error;
    }
  }
}
