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

describe('authentication lifecycle', () => {
  let context: DatabaseTestContext;
  let auth: AuthService;
  let app: NestFastifyApplication;
  const jobs: AuthMailJob[] = [];

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    const environment = validateEnvironment({
      ...process.env,
      ACCESS_TOKEN_SECRET: 'integration-access-token-secret-at-least-32-bytes',
      DATABASE_URL: context.environment.DATABASE_URL,
      NODE_ENV: 'test',
      REDIS_URL: redisUrl,
      REFRESH_TOKEN_PEPPER:
        'integration-refresh-token-pepper-at-least-32-bytes',
    });
    const config = new ConfigService<AppEnvironment, true>(environment);
    const clock = new SystemClock();
    const tokenGenerator = new SecureTokenGenerator();
    const mailQueue = {
      enqueue(job: AuthMailJob) {
        jobs.push(job);
        return Promise.resolve();
      },
    } as AuthMailQueueService;
    auth = new AuthService(
      new AccessTokenService(config, clock),
      mailQueue,
      new AuthRepository(context.database),
      new TokenHashService(config),
      clock,
      tokenGenerator,
    );
    app = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET:
          'integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: redisUrl,
        REFRESH_TOKEN_PEPPER:
          'integration-refresh-token-pepper-at-least-32-bytes',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await context?.stop();
  });

  it('verifies an account, rotates refresh tokens, and revokes a replayed family', async () => {
    await auth.register({
      displayName: 'Auth Test',
      email: 'auth@example.test',
      handle: 'auth_test',
      password: 'a-secure-password-123',
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: 'verify-email',
      recipient: 'auth@example.test',
    });

    await auth.register({
      displayName: 'Auth Test',
      email: 'auth@example.test',
      handle: 'auth_test',
      password: 'a-secure-password-123',
    });
    expect(jobs).toHaveLength(2);
    await expect(auth.verifyEmail(jobs[0]!.token)).rejects.toThrow(
      'The verification token is invalid or expired.',
    );

    await expect(
      auth.login('auth@example.test', 'a-secure-password-123', {}),
    ).rejects.toThrow('Email verification is required.');
    await auth.verifyEmail(jobs[1]!.token);

    const login = await auth.login(
      'auth@example.test',
      'a-secure-password-123',
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );
    await expect(
      auth.isSessionActive(
        (
          await new AccessTokenService(
            new ConfigService<AppEnvironment, true>(
              validateEnvironment({
                ...process.env,
                ACCESS_TOKEN_SECRET:
                  'integration-access-token-secret-at-least-32-bytes',
                NODE_ENV: 'test',
              }),
            ),
            new SystemClock(),
          ).verify(login.accessToken)
        ).sessionId,
        login.user.id,
      ),
    ).resolves.toBe(true);

    const rotated = await auth.refresh(login.refreshToken, {});
    await expect(auth.refresh(login.refreshToken, {})).rejects.toThrow(
      'The refresh token is invalid or expired.',
    );
    await expect(auth.refresh(rotated.refreshToken, {})).rejects.toThrow(
      'The refresh token is invalid or expired.',
    );
  });

  it('supports bearer auth and CSRF-protected signed refresh cookies over HTTP', async () => {
    const nativeLogin = await app.inject({
      method: 'POST',
      payload: {
        identifier: 'auth@example.test',
        password: 'a-secure-password-123',
        refreshTokenDelivery: 'response_body',
      },
      url: '/api/v1/auth/login',
    });
    expect(nativeLogin.statusCode).toBe(200);
    const nativeAuthentication = nativeLogin.json<{
      accessToken: string;
      refreshToken: string;
    }>();
    expect(nativeAuthentication.refreshToken).toBeTruthy();

    const profile = await app.inject({
      headers: { authorization: `Bearer ${nativeAuthentication.accessToken}` },
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ email: 'auth@example.test' });

    const browserLogin = await app.inject({
      method: 'POST',
      payload: {
        identifier: 'auth@example.test',
        password: 'a-secure-password-123',
      },
      url: '/api/v1/auth/login',
    });
    expect(browserLogin.statusCode).toBe(200);
    const browserAuthentication = browserLogin.json<{ csrfToken: string }>();
    const setCookies = Array.isArray(browserLogin.headers['set-cookie'])
      ? browserLogin.headers['set-cookie']
      : [browserLogin.headers['set-cookie']!];
    const cookies = setCookies.map((value) => value.split(';')[0]).join('; ');

    const rejectedRefresh = await app.inject({
      headers: { cookie: cookies },
      method: 'POST',
      payload: {},
      url: '/api/v1/auth/refresh',
    });
    expect(rejectedRefresh.statusCode).toBe(401);

    const refreshed = await app.inject({
      headers: {
        cookie: cookies,
        'x-csrf-token': browserAuthentication.csrfToken,
      },
      method: 'POST',
      payload: {},
      url: '/api/v1/auth/refresh',
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json()).toMatchObject({ expiresInSeconds: 900 });
  });
});
