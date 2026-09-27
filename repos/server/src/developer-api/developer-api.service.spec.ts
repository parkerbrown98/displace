import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import type { TokenHashService } from '../auth/token-hash.service.js';
import type { Clock } from '../platform/clock/clock.js';
import type { TokenGenerator } from '../platform/tokens/token-generator.js';
import { ApiTokenScope } from './developer-api.dto.js';
import type {
  ApiTokenRecord,
  DeveloperApiRepository,
} from './developer-api.repository.js';
import { DeveloperApiService } from './developer-api.service.js';

describe('DeveloperApiService', () => {
  const now = new Date('2026-09-26T12:00:00.000Z');
  const expiresAt = new Date('2026-10-26T12:00:00.000Z');
  const generatedSecret = 'generated-secret-value-with-enough-entropy';
  const record: ApiTokenRecord = {
    createdAt: now,
    expiresAt,
    id: '01997a4e-a200-7000-8000-000000000001',
    lastUsedAt: null,
    name: 'Automation',
    prefix: `dsp_${generatedSecret}`.slice(0, 12),
    revokedAt: null,
    scopes: [ApiTokenScope.Read, ApiTokenScope.Write],
    userId: '01997a4e-a200-7000-8000-000000000002',
  };

  const repository = {
    create: vi.fn(),
    findActiveByHash: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
    rotate: vi.fn(),
    touch: vi.fn(),
  };
  const hashes = { hash: vi.fn((value: string) => `hash:${value}`) };
  const service = new DeveloperApiService(
    { now: () => now } satisfies Clock,
    { generate: () => generatedSecret } satisfies TokenGenerator,
    hashes as unknown as TokenHashService,
    repository as unknown as DeveloperApiRepository,
  );

  beforeEach(() => vi.clearAllMocks());

  it('returns a newly issued secret once while storing only its hash', async () => {
    repository.create.mockResolvedValue(record);

    await expect(service.create(record.userId, {
      expiresAt: expiresAt.toISOString(),
      name: ' Automation ',
      scopes: [ApiTokenScope.Read, ApiTokenScope.Read, ApiTokenScope.Write],
    })).resolves.toMatchObject({
      id: record.id,
      scopes: [ApiTokenScope.Read, ApiTokenScope.Write],
      token: `dsp_${generatedSecret}`,
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Automation',
      scopes: [ApiTokenScope.Read, ApiTokenScope.Write],
      tokenHash: `hash:dsp_${generatedSecret}`,
    }));
  });

  it('rejects expirations outside the bounded lifetime before persistence', async () => {
    await expect(service.create(record.userId, {
      expiresAt: new Date(now.getTime() + 367 * 24 * 60 * 60 * 1_000).toISOString(),
      name: 'Too long',
      scopes: [ApiTokenScope.Read],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('authenticates a hash-only token and updates last-used metadata', async () => {
    repository.findActiveByHash.mockResolvedValue(record);

    await expect(service.authenticate(`dsp_${generatedSecret}`)).resolves.toEqual({
      id: record.id,
      scopes: new Set(record.scopes),
      userId: record.userId,
    });
    expect(repository.touch).toHaveBeenCalledWith(record.id, now);
  });

  it('delegates rotation atomically and returns only the replacement secret', async () => {
    repository.rotate.mockResolvedValue(record);

    await expect(service.rotate(record.userId, record.id)).resolves.toMatchObject({
      id: record.id,
      token: `dsp_${generatedSecret}`,
    });
    expect(repository.rotate).toHaveBeenCalledWith(
      record.userId,
      record.id,
      expect.objectContaining({ tokenHash: `hash:dsp_${generatedSecret}` }),
      now,
    );
  });

  it('does not expose whether a missing or inactive token ever existed', async () => {
    repository.rotate.mockResolvedValue(undefined);

    await expect(service.rotate(record.userId, record.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});