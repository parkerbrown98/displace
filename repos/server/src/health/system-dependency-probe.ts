import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RoomServiceClient } from 'livekit-server-sdk';
import { Meilisearch } from 'meilisearch';
import type { Pool } from 'pg';
import type { AppEnvironment } from '../config/environment.js';
import { PG_POOL } from '../database/database.constants.js';
import type { DependencyProbe } from './dependency-probe.js';

const timeoutMilliseconds = 2_000;

@Injectable()
export class SystemDependencyProbe implements DependencyProbe {
  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async checkPostgres(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async checkRedis(): Promise<void> {
    const redisUrl = new URL(this.config.get('REDIS_URL', { infer: true }));
    const redis = new Redis(redisUrl.toString(), {
      commandTimeout: timeoutMilliseconds,
      connectTimeout: timeoutMilliseconds,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: null,
    });

    try {
      await redis.connect();
      if (redisUrl.password) {
        const password = decodeURIComponent(redisUrl.password);
        if (redisUrl.username) {
          await redis.auth(decodeURIComponent(redisUrl.username), password);
        } else {
          await redis.auth(password);
        }
      }
      if (redisUrl.pathname.length > 1) {
        await redis.select(Number(redisUrl.pathname.slice(1)));
      }
      await redis.ping();
    } finally {
      redis.disconnect();
    }
  }

  async checkObjectStorage(): Promise<void> {
    const client = new S3Client({
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: this.config.get('S3_SECRET_KEY', { infer: true }),
      },
      endpoint: this.config.get('S3_ENDPOINT', { infer: true }),
      forcePathStyle: true,
      region: 'us-east-1',
    });

    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: this.config.get('S3_BUCKET', { infer: true }),
        }),
        { abortSignal: AbortSignal.timeout(timeoutMilliseconds) },
      );
    } finally {
      client.destroy();
    }
  }

  async checkSearch(): Promise<void> {
    const client = new Meilisearch({
      apiKey: this.config.get('MEILISEARCH_MASTER_KEY', { infer: true }),
      host: this.config.get('MEILISEARCH_HOST', { infer: true }),
      timeout: timeoutMilliseconds,
    });
    await client.getKeys({ limit: 1 });
  }

  async checkVoice(): Promise<void> {
    const client = new RoomServiceClient(
      this.config.get('LIVEKIT_URL', { infer: true }),
      this.config.get('LIVEKIT_API_KEY', { infer: true }),
      this.config.get('LIVEKIT_API_SECRET', { infer: true }),
      { failover: false, requestTimeout: timeoutMilliseconds / 1_000 },
    );
    await client.listRooms();
  }
}
