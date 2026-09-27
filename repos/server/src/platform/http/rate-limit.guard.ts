import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import type { AppEnvironment } from '../../config/environment.js';
import type { AuthorizedRequest } from '../authorization/authorized-request.js';

const EXPENSIVE_OPERATION = Symbol('EXPENSIVE_OPERATION');
const SKIP_RATE_LIMIT = Symbol('SKIP_RATE_LIMIT');
const WINDOW_SECONDS = 60;
const TOKEN_BUCKET_SCRIPT = `
local current = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local tokens = tonumber(current[1]) or tonumber(ARGV[1])
local updated = tonumber(current[2]) or tonumber(ARGV[3])
local elapsed = math.max(0, tonumber(ARGV[3]) - updated)
tokens = math.min(tonumber(ARGV[1]), tokens + elapsed * tonumber(ARGV[2]))
local allowed = tokens >= 1
if allowed then tokens = tokens - 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return {
  allowed and 1 or 0,
  math.floor(tokens),
  math.ceil((tonumber(ARGV[1]) - tokens) / tonumber(ARGV[2])),
  math.max(0, math.ceil((1 - tokens) / tonumber(ARGV[2])))
}
`;

export const ExpensiveOperation = () => SetMetadata(EXPENSIVE_OPERATION, true);
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);

interface Bucket {
  key: string;
  limit: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnApplicationShutdown {
  private connection?: Promise<void>;
  private readonly redis: Redis;
  private readonly limits: Record<'expensive' | 'ip' | 'place' | 'token' | 'user', number>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.limits = {
      expensive: config.get('RATE_LIMIT_EXPENSIVE_PER_MINUTE', { infer: true }),
      ip: config.get('RATE_LIMIT_IP_PER_MINUTE', { infer: true }),
      place: config.get('RATE_LIMIT_PLACE_PER_MINUTE', { infer: true }),
      token: config.get('RATE_LIMIT_TOKEN_PER_MINUTE', { infer: true }),
      user: config.get('RATE_LIMIT_USER_PER_MINUTE', { infer: true }),
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ])) return true;
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const buckets = this.bucketsFor(request, context);

    try {
      await this.ensureConnected();
      const nowSeconds = Date.now() / 1_000;
      let effectiveLimit = Number.POSITIVE_INFINITY;
      let remaining = Number.POSITIVE_INFINITY;
      let remainingRatio = Number.POSITIVE_INFINITY;
      let resetAfter = 1;
      let retryAfter = 0;
      let allowed = true;
      for (const bucket of buckets) {
        const result = await this.redis.eval(
          TOKEN_BUCKET_SCRIPT,
          1,
          `displace:rate:${bucket.key}`,
          bucket.limit,
          bucket.limit / WINDOW_SECONDS,
          nowSeconds,
          WINDOW_SECONDS * 2,
        ) as [number, number, number, number];
        const bucketRemainingRatio = result[1] / bucket.limit;
        if (bucketRemainingRatio < remainingRatio) {
          effectiveLimit = bucket.limit;
          remaining = result[1];
          remainingRatio = bucketRemainingRatio;
          resetAfter = result[2];
        }
        allowed = allowed && result[0] === 1;
        retryAfter = Math.max(retryAfter, result[3]);
      }
      reply.header('RateLimit-Limit', effectiveLimit);
      reply.header('RateLimit-Remaining', Math.max(0, remaining));
      reply.header('RateLimit-Reset', Math.max(1, resetAfter));
      if (!allowed) {
        reply.header('Retry-After', Math.max(1, retryAfter));
        throw new HttpException('The request rate limit was exceeded.', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Rate limiting is temporarily unavailable.',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') this.redis.disconnect();
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (!this.connection) {
      const pending = this.redis.status === 'wait' || this.redis.status === 'end'
        ? this.redis.connect()
        : new Promise<void>((resolve, reject) => {
            const ready = () => {
              this.redis.off('error', failed);
              resolve();
            };
            const failed = (error: Error) => {
              this.redis.off('ready', ready);
              reject(error);
            };
            this.redis.once('ready', ready);
            this.redis.once('error', failed);
          });
      this.connection = pending.finally(() => {
        this.connection = undefined;
      });
    }
    await this.connection;
  }

  private bucketsFor(request: AuthorizedRequest, context: ExecutionContext): Bucket[] {
    const user = request.authorization?.user;
    const params = request.params as Record<string, unknown> | undefined;
    const placeId = request.authorization?.place?.id ?? this.stringParam(params, 'placeId');
    const route = request.routeOptions?.url ?? request.url.split('?')[0];
    const buckets: Bucket[] = [{ key: `ip:${request.ip}`, limit: this.limits.ip }];
    if (user) buckets.push({ key: `user:${user.id}`, limit: this.limits.user });
    if (user?.apiTokenId) buckets.push({ key: `token:${user.apiTokenId}`, limit: this.limits.token });
    if (placeId) buckets.push({ key: `place:${placeId}`, limit: this.limits.place });
    if (this.reflector.getAllAndOverride<boolean>(EXPENSIVE_OPERATION, [context.getHandler(), context.getClass()])) {
      buckets.push({ key: `expensive:${user?.id ?? request.ip}:${route}`, limit: this.limits.expensive });
    }
    return buckets;
  }

  private stringParam(params: Record<string, unknown> | undefined, name: string): string | undefined {
    const value = params?.[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
