import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../../config/environment.js';

@Injectable()
export class CursorCodecService {
  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  encode(value: Record<string, unknown>): string {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  decode<T extends Record<string, unknown>>(cursor: string): T {
    const [payload, signature, extra] = cursor.split('.');
    if (
      !payload ||
      !signature ||
      extra ||
      !this.isValidSignature(payload, signature)
    ) {
      throw new BadRequestException('Cursor is invalid or has been modified.');
    }

    try {
      const value: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Cursor payload must be an object.');
      }

      return value as T;
    } catch {
      throw new BadRequestException('Cursor is invalid or has been modified.');
    }
  }

  private sign(payload: string): string {
    return createHmac(
      'sha256',
      this.config.get('CURSOR_SECRET', { infer: true }),
    )
      .update(payload)
      .digest('base64url');
  }

  private isValidSignature(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payload));
    const received = Buffer.from(signature);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}
