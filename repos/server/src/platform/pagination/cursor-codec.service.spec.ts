import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../../config/environment.js';
import { CursorCodecService } from './cursor-codec.service.js';

describe('CursorCodecService', () => {
  const config = {
    get: () => 'test-cursor-signing-secret-at-least-32-bytes',
  } as unknown as ConfigService<AppEnvironment, true>;
  const codec = new CursorCodecService(config);

  it('round-trips an opaque cursor', () => {
    const value = { createdAt: '2026-09-20T00:00:00.000Z', id: 'example' };

    expect(codec.decode(codec.encode(value))).toEqual(value);
  });

  it('rejects a modified cursor', () => {
    const cursor = codec.encode({ id: 'example' });

    expect(() => codec.decode(`${cursor}x`)).toThrow(BadRequestException);
  });
});
