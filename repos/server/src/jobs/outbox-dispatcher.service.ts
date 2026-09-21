import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { getRedisConnection } from '../auth/auth-mail-queue.service.js';
import type { AppEnvironment } from '../config/environment.js';
import { DATABASE } from '../database/database.constants.js';
import { outboxEvents } from '../database/schema/index.js';
import type { Database } from '../database/database.types.js';
import { SEARCH_QUEUE_NAME, type SearchIndexJob } from './jobs.types.js';

const DISPATCH_INTERVAL_MS = 5_000;
const DISPATCH_LIMIT = 100;

@Injectable()
export class OutboxDispatcherService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly queue: Queue<SearchIndexJob>;
  private timer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    config: ConfigService<AppEnvironment, true>,
  ) {
    this.queue = new Queue<SearchIndexJob>(SEARCH_QUEUE_NAME, {
      connection: getRedisConnection(config.get('REDIS_URL', { infer: true })),
      defaultJobOptions: {
        attempts: 5,
        backoff: { delay: 1_000, type: 'exponential' },
        removeOnComplete: true,
        removeOnFail: true,
      },
      prefix: 'displace',
    });
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.dispatch(), DISPATCH_INTERVAL_MS);
    void this.dispatch();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
  }

  private async dispatch(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const events = await this.database
        .select({ eventType: outboxEvents.eventType, id: outboxEvents.id })
        .from(outboxEvents)
        .where(
          and(
            or(
              eq(outboxEvents.status, 'pending'),
              eq(outboxEvents.status, 'failed'),
              and(
                eq(outboxEvents.status, 'processing'),
                lte(outboxEvents.availableAt, new Date()),
              ),
            ),
            lte(outboxEvents.availableAt, new Date()),
            inArray(outboxEvents.eventType, [
              'post.created',
              'post.deleted',
              'post.updated',
              'place.archived',
              'place.created',
              'place.updated',
              'forum.archived',
              'forum.updated',
              'topic.created',
              'topic.deleted',
              'topic.updated',
            ]),
          ),
        )
        .orderBy(asc(outboxEvents.createdAt), asc(outboxEvents.id))
        .limit(DISPATCH_LIMIT);

      for (const event of events) {
        await this.queue.add('index', { eventId: event.id }, {
          jobId: `outbox-${event.id}`,
        });
        await this.database
          .update(outboxEvents)
          .set({
            attempts: sql`${outboxEvents.attempts} + 1`,
            availableAt: new Date(Date.now() + 60_000),
            lastError: null,
            status: 'processing',
          })
          .where(eq(outboxEvents.id, event.id));
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Outbox dispatch failed',
      );
    } finally {
      this.dispatching = false;
    }
  }
}