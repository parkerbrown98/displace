import { createHash } from 'node:crypto';
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
import type { FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import type { AppEnvironment } from '../config/environment.js';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';

interface RateLimitPolicy {
  action: string;
  identifierField?: string;
}

const AUTH_RATE_LIMIT = Symbol('AUTH_RATE_LIMIT');
const WINDOW_SECONDS = 60;

export const AuthRateLimit = (action: string, identifierField?: string) =>
  SetMetadata(AUTH_RATE_LIMIT, {
    action,
    identifierField,
  } satisfies RateLimitPolicy);

@Injectable()
export class AuthRateLimitGuard implements CanActivate, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RateLimitPolicy>(
      AUTH_RATE_LIMIT,
      context.getHandler(),
    );
    if (!policy) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & AuthorizedRequest>();
    const body =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : {};
    const identifier = policy.identifierField
      ? body[policy.identifierField]
      : undefined;
    const keys = [`auth-rate:${policy.action}:ip:${request.ip}`];
    if (request.authorization?.user.id) {
      keys.push(
        `auth-rate:${policy.action}:user:${request.authorization.user.id}`,
      );
    }
    if (typeof identifier === 'string') {
      keys.push(
        `auth-rate:${policy.action}:subject:${createHash('sha256')
          .update(identifier.trim().toLowerCase())
          .digest('base64url')}`,
      );
    }

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      const transaction = this.redis.multi();
      for (const key of keys) {
        transaction.incr(key).expire(key, WINDOW_SECONDS);
      }
      const results = await transaction.exec();
      const counts: number[] = [];
      for (let index = 0; index < (results?.length ?? 0); index += 2) {
        counts.push(Number(results?.[index]?.[1]));
      }
      if (counts.some((count, index) => count > (index === 0 ? 20 : 10))) {
        throw new HttpException(
          'Too many authentication attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Authentication rate limiting is temporarily unavailable.',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }
}
