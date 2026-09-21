import { NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import type { AccessTokenService } from './access-token.service.js';
import type { AuthMailQueueService } from './auth-mail-queue.service.js';
import type { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import type { TokenHashService } from './token-hash.service.js';
import type { Clock } from '../platform/clock/clock.js';
import type { TokenGenerator } from '../platform/tokens/token-generator.js';

describe('AuthService public profiles', () => {
  it('normalizes handles and returns only public profile fields', async () => {
    const joinedAt = new Date('2024-02-12T00:00:00.000Z');
    const findPublicProfileByHandle = vi.fn().mockResolvedValue({
      createdAt: joinedAt,
      displayName: 'Mara V.',
      handle: 'mara_v',
    });
    const service = createService({ findPublicProfileByHandle });

    await expect(service.getPublicProfile(' Mara_V ')).resolves.toEqual({
      displayName: 'Mara V.',
      handle: 'mara_v',
      joinedAt,
    });
    expect(findPublicProfileByHandle).toHaveBeenCalledWith('mara_v');
  });

  it('returns not found when no active profile is visible', async () => {
    const service = createService({
      findPublicProfileByHandle: vi.fn().mockResolvedValue(undefined),
    });

    await expect(service.getPublicProfile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function createService(repository: Pick<AuthRepository, 'findPublicProfileByHandle'>): AuthService {
  return new AuthService(
    {} as AccessTokenService,
    {} as AuthMailQueueService,
    repository as AuthRepository,
    {} as TokenHashService,
    {} as Clock,
    {} as TokenGenerator,
  );
}