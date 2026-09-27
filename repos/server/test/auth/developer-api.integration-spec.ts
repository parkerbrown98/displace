import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AccessTokenService } from '../../src/auth/access-token.service.js';
import type { AuthMailQueueService } from '../../src/auth/auth-mail-queue.service.js';
import type { AuthMailJob } from '../../src/auth/auth-mail.types.js';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { TokenHashService } from '../../src/auth/token-hash.service.js';
import {
  validateEnvironment,
  type AppEnvironment,
} from '../../src/config/environment.js';
import { SystemClock } from '../../src/platform/clock/system-clock.js';
import { SecureTokenGenerator } from '../../src/platform/tokens/secure-token-generator.js';
import {
  startDatabaseTestContext,
  type DatabaseTestContext,
} from '../factories/database-test-context.js';
import { createTestApplication } from '../factories/test-application.js';

describe('developer API token lifecycle', () => {
  let app: NestFastifyApplication;
  let context: DatabaseTestContext;
  let accessToken: string;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    const overrides = {
      ACCESS_TOKEN_SECRET: 'developer-api-access-token-secret-32-bytes',
      DATABASE_URL: context.environment.DATABASE_URL,
      RATE_LIMIT_TOKEN_PER_MINUTE: 10,
      REDIS_URL: redisUrl,
      REFRESH_TOKEN_PEPPER: 'developer-api-token-pepper-at-least-32-bytes',
    };
    const environment = validateEnvironment({
      ...process.env,
      ...overrides,
      NODE_ENV: 'test',
    });
    const config = new ConfigService<AppEnvironment, true>(environment);
    const jobs: AuthMailJob[] = [];
    const clock = new SystemClock();
    const auth = new AuthService(
      new AccessTokenService(config, clock),
      { enqueue: (job: AuthMailJob) => { jobs.push(job); return Promise.resolve(); } } as AuthMailQueueService,
      new AuthRepository(context.database),
      new TokenHashService(config),
      clock,
      new SecureTokenGenerator(),
    );
    await auth.register({
      displayName: 'Developer API Test',
      email: 'developer-api@example.test',
      handle: 'developer_api_test',
      password: 'a-secure-password-123',
    });
    await auth.verifyEmail(jobs[0]!.token);
    app = await createTestApplication({ environment: overrides });
    const login = await app.inject({
      method: 'POST',
      payload: {
        identifier: 'developer-api@example.test',
        password: 'a-secure-password-123',
        refreshTokenDelivery: 'response_body',
      },
      url: '/api/v1/auth/login',
    });
    accessToken = login.json<{ accessToken: string }>().accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await context?.stop();
  });

  it('creates, scopes, rotates, and revokes a hash-only token', async () => {
    const created = await app.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'POST',
      payload: {
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
        name: 'Integration token',
        scopes: ['read'],
      },
      url: '/api/v1/developer/tokens',
    });
    expect(created.statusCode).toBe(201);
    const issued = created.json<{ id: string; prefix: string; token: string }>();
    expect(issued.token).toMatch(/^dsp_/);
    expect(issued.prefix).toBe(issued.token.slice(0, 12));

    const profile = await app.inject({
      headers: { authorization: `Bearer ${issued.token}` },
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ email: 'developer-api@example.test' });

    const deniedWrite = await app.inject({
      headers: { authorization: `Bearer ${issued.token}` },
      method: 'POST',
      payload: {},
      url: '/api/v1/auth/logout',
    });
    expect(deniedWrite.statusCode).toBe(403);

    const deniedManagement = await app.inject({
      headers: { authorization: `Bearer ${issued.token}` },
      method: 'GET',
      url: '/api/v1/developer/tokens',
    });
    expect(deniedManagement.statusCode).toBe(403);

    const rotated = await app.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'POST',
      payload: {},
      url: `/api/v1/developer/tokens/${issued.id}/rotate`,
    });
    expect(rotated.statusCode).toBe(201);
    const replacement = rotated.json<{ id: string; token: string }>();
    expect(replacement.id).not.toBe(issued.id);

    const oldTokenResponse = await app.inject({
      headers: { authorization: `Bearer ${issued.token}` },
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(oldTokenResponse.statusCode).toBe(401);

    let limitedResponse;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      limitedResponse = await app.inject({
        headers: { authorization: `Bearer ${replacement.token}` },
        method: 'GET',
        url: '/api/v1/auth/me',
      });
    }
    expect(limitedResponse?.statusCode).toBe(429);
    expect(limitedResponse?.headers['ratelimit-limit']).toBe('10');
    expect(limitedResponse?.headers['ratelimit-remaining']).toBe('0');
    expect(limitedResponse?.headers['retry-after']).toBeTruthy();

    const revoke = await app.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'DELETE',
      url: `/api/v1/developer/tokens/${replacement.id}`,
    });
    expect(revoke.statusCode).toBe(204);

    const revokedTokenResponse = await app.inject({
      headers: { authorization: `Bearer ${replacement.token}` },
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(revokedTokenResponse.statusCode).toBe(401);

    const listed = await app.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'GET',
      url: '/api/v1/developer/tokens',
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json<Array<Record<string, unknown>>>()).toHaveLength(2);
    expect(listed.body).not.toContain(issued.token);
    expect(listed.body).not.toContain(replacement.token);
  });
});