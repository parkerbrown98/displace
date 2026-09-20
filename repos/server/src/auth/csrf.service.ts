import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from '../platform/tokens/token-generator.js';

@Injectable()
export class CsrfService {
  constructor(
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  generate(): string {
    return this.tokenGenerator.generate();
  }

  verify(
    cookieToken: string | undefined,
    headerToken: string | undefined,
  ): void {
    if (!cookieToken || !headerToken) {
      throw new UnauthorizedException('A valid CSRF token is required.');
    }

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new UnauthorizedException('A valid CSRF token is required.');
    }
  }
}
