import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';
import type { AppEnvironment } from '../config/environment.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const ACCESS_TOKEN_AUDIENCE = 'displace-api';
const ACCESS_TOKEN_ISSUER = 'displace';

export interface AccessTokenClaims {
  sessionId: string;
  userId: string;
}

@Injectable()
export class AccessTokenService {
  private readonly signingKey: Uint8Array;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.signingKey = new TextEncoder().encode(
      config.get('ACCESS_TOKEN_SECRET', { infer: true }),
    );
  }

  async issue(userId: string, sessionId: string): Promise<string> {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1_000);
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
      .setIssuedAt(issuedAt)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setSubject(userId)
      .sign(this.signingKey);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.signingKey, {
        algorithms: ['HS256'],
        audience: ACCESS_TOKEN_AUDIENCE,
        currentDate: this.clock.now(),
        issuer: ACCESS_TOKEN_ISSUER,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Required claims are missing.');
      }

      return { sessionId: payload.sid, userId: payload.sub };
    } catch {
      throw new UnauthorizedException(
        'The access token is invalid or expired.',
      );
    }
  }
}
