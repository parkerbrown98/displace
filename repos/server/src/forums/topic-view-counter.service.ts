import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppEnvironment } from '../config/environment.js';

const VIEW_KEY_PREFIX = 'displace:topic-views:';
const VIEW_BATCH_KEY_PREFIX = 'displace:topic-view-batches:';

@Injectable()
export class TopicViewCounterService implements OnApplicationShutdown {
  private readonly logger = new Logger(TopicViewCounterService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', (error) => {
      this.logger.warn({ error: error.message }, 'Topic view counter is unavailable');
    });
  }

  async record(topicId: string): Promise<void> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.incr(`${VIEW_KEY_PREFIX}${topicId}`);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), topicId },
        'Could not buffer topic view',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') this.redis.disconnect();
  }
}

export { VIEW_BATCH_KEY_PREFIX, VIEW_KEY_PREFIX };