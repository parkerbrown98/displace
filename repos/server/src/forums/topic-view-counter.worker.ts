import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppEnvironment } from '../config/environment.js';
import { ForumsRepository } from './forums.repository.js';
import {
  VIEW_BATCH_KEY_PREFIX,
  VIEW_KEY_PREFIX,
} from './topic-view-counter.service.js';

const STAGE_SCRIPT = `
local count = redis.call('GET', KEYS[1])
if not count then return nil end
redis.call('SET', KEYS[2], ARGV[1] .. ':' .. count, 'EX', ARGV[2])
redis.call('DEL', KEYS[1])
return count
`;
const BATCH_RETRY_SECONDS = 30 * 24 * 60 * 60;
const LEDGER_RETENTION_MS = 31 * 24 * 60 * 60 * 1_000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const SHUTDOWN_FLUSH_TIMEOUT_MS = 10_000;

@Injectable()
export class TopicViewCounterWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TopicViewCounterWorker.name);
  private readonly redis: Redis;
  private lastPrunedAt = 0;
  private scheduledFlush?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly forums: ForumsRepository,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.redis.connect();
    this.timer = setInterval(() => this.runScheduledFlush(), 60_000);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    try {
      await this.withTimeout(this.scheduledFlush ?? this.flush(), SHUTDOWN_FLUSH_TIMEOUT_MS);
    } catch (error) {
      this.logFlushError(error, 'Could not flush topic views during shutdown');
    } finally {
      this.redis.disconnect();
    }
  }

  async flush(): Promise<void> {
    for (const key of await this.scanKeys(`${VIEW_BATCH_KEY_PREFIX}*`)) {
      await this.flushBatch(key);
    }
    for (const key of await this.scanKeys(`${VIEW_KEY_PREFIX}*`)) {
      await this.stage(key);
    }
    await this.pruneLedger();
  }

  private runScheduledFlush(): void {
    if (this.scheduledFlush) return;
    this.scheduledFlush = this.flush()
      .catch((error: unknown) => this.logFlushError(error, 'Could not flush topic views'))
      .finally(() => {
        this.scheduledFlush = undefined;
      });
  }

  private async withTimeout(operation: Promise<void>, timeoutMs: number): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Topic view flush exceeded ${timeoutMs}ms.`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private logFlushError(error: unknown, message: string): void {
    this.logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      message,
    );
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    let cursor = '0';
    const allKeys: string[] = [];
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      allKeys.push(...keys);
    } while (cursor !== '0');
    return allKeys;
  }

  private async stage(key: string): Promise<void> {
    const topicId = key.slice(VIEW_KEY_PREFIX.length);
    const batchKey = `${VIEW_BATCH_KEY_PREFIX}${randomUUID()}`;
    const rawCount = await this.redis.eval(
      STAGE_SCRIPT,
      2,
      key,
      batchKey,
      topicId,
      BATCH_RETRY_SECONDS,
    );
    if (rawCount !== null) await this.flushBatch(batchKey);
  }

  private async flushBatch(key: string): Promise<void> {
    const payload = await this.redis.get(key);
    if (!payload) return;
    const separator = payload.lastIndexOf(':');
    const topicId = payload.slice(0, separator);
    const count = Number(payload.slice(separator + 1));
    const batchId = key.slice(VIEW_BATCH_KEY_PREFIX.length);
    if (!topicId || !Number.isSafeInteger(count) || count <= 0) {
      this.logger.error({ batchId }, 'Discarding invalid topic view batch');
      await this.redis.del(key);
      return;
    }
    try {
      await this.forums.flushViews(batchId, topicId, count);
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(
        {
          batchId,
          error: error instanceof Error ? error.message : String(error),
          topicId,
        },
        'Could not flush topic views',
      );
    }
  }

  private async pruneLedger(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPrunedAt < PRUNE_INTERVAL_MS) return;
    try {
      await this.forums.pruneViewFlushes(new Date(now - LEDGER_RETENTION_MS));
      this.lastPrunedAt = now;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Could not prune topic view batches',
      );
    }
  }
}