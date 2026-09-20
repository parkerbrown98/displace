import { createHash, randomUUID } from 'node:crypto';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type ConnectionOptions } from 'bullmq';
import type { AppEnvironment } from '../config/environment.js';
import { AUTH_MAIL_QUEUE, type AuthMailJob } from './auth-mail.types.js';

export function getRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    host: url.hostname,
    password: url.password || undefined,
    port: url.port ? Number(url.port) : 6379,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    username: url.username || undefined,
  };
}

@Injectable()
export class AuthMailQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<AuthMailJob>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.queue = new Queue<AuthMailJob>(AUTH_MAIL_QUEUE, {
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

  async enqueue(job: AuthMailJob): Promise<void> {
    const identity =
      'token' in job
        ? createHash('sha256').update(job.token).digest('base64url')
        : randomUUID();
    await this.queue.add(job.kind, job, {
      jobId: `${job.kind}-${identity}`,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
