import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import type { Clock } from '../platform/clock/clock.js';
import { AccessTokenService } from './access-token.service.js';

describe('AccessTokenService', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');
  const clock: Clock = { now: () => now };
  const config = new ConfigService<AppEnvironment, true>({
    ACCESS_TOKEN_SECRET: 'test-access-token-secret-at-least-32-bytes',
  } as AppEnvironment);
  const service = new AccessTokenService(config, clock);

  it('issues a user and session bound token valid for 15 minutes', async () => {
    const token = await service.issue('user-id', 'session-id');

    await expect(service.verify(token)).resolves.toEqual({
      sessionId: 'session-id',
      userId: 'user-id',
    });

    const expiredService = new AccessTokenService(config, {
      now: () => new Date(now.getTime() + 15 * 60 * 1_000 + 1),
    });
    await expect(expiredService.verify(token)).rejects.toThrow(
      'The access token is invalid or expired.',
    );
  });
});
