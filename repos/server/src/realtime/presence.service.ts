import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppEnvironment } from '../config/environment.js';

const PRESENCE_TTL_MS = 60_000;

@Injectable()
export class PresenceService {
  private readonly redis: Redis;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }));
  }

  async heartbeat(placeId: string, userId: string): Promise<void> {
    await this.redis.set(`displace:presence:${placeId}:${userId}`, '1', 'PX', PRESENCE_TTL_MS);
  }

  async setTyping(channelId: string, userId: string, active: boolean): Promise<void> {
    const key = `displace:typing:${channelId}:${userId}`;
    if (active) {
      await this.redis.set(key, '1', 'PX', 8_000);
      return;
    }
    await this.redis.del(key);
  }
}