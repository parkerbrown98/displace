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
import { SEARCH_QUEUE_NAME, type SearchIndexJob } from '../jobs/jobs.types.js';
import { SearchService } from './search.service.js';

@Injectable()
export class SearchIndexWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SearchIndexWorker.name);
  private readonly connection;
  private worker?: Worker<SearchIndexJob>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly search: SearchService,
  ) {
    this.connection = getRedisConnection(config.get('REDIS_URL', { infer: true }));
  }

  onApplicationBootstrap(): void {
    this.worker = new Worker<SearchIndexJob>(
      SEARCH_QUEUE_NAME,
      (job) => this.process(job),
      { concurrency: 4, connection: this.connection, prefix: 'displace' },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { error: error.message, eventId: job?.data.eventId, jobId: job?.id },
        'Search indexing failed',
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<SearchIndexJob>): Promise<void> {
    await this.search.processOutboxEvent(job.data.eventId);
  }
}