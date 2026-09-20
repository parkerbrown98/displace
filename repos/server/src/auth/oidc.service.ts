import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptJWT, jwtDecrypt } from 'jose';
import * as oidc from 'openid-client';
import type { AppEnvironment } from '../config/environment.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from '../platform/tokens/token-generator.js';
import type { OidcIdentity } from './auth.service.js';

interface OidcState {
  cookie: string;
  url: URL;
}

@Injectable()
export class OidcService {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly issuerUrl?: URL;
  private readonly redirectUrl?: string;
  private readonly stateKey: Uint8Array;
  private configuration?: Promise<oidc.Configuration>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {
    this.clientId = config.get('OIDC_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('OIDC_CLIENT_SECRET', { infer: true });
    const issuer = config.get('OIDC_ISSUER_URL', { infer: true });
    this.issuerUrl = issuer ? new URL(issuer) : undefined;
    this.redirectUrl = config
      .get('OIDC_REDIRECT_URL', { infer: true })
      ?.toString();
    this.stateKey = createHash('sha256')
      .update(config.get('ACCESS_TOKEN_SECRET', { infer: true }))
      .digest();
  }

  async begin(link?: {
    sessionId: string;
    userId: string;
  }): Promise<OidcState> {
    const configuration = await this.getConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const nonce = this.tokenGenerator.generate();
    const state = this.tokenGenerator.generate();
    const issuedAt = Math.floor(this.clock.now().getTime() / 1_000);
    const cookie = await new EncryptJWT({
      codeVerifier,
      linkSessionId: link?.sessionId,
      linkUserId: link?.userId,
      nonce,
      state,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 10 * 60)
      .encrypt(this.stateKey);
    const url = oidc.buildAuthorizationUrl(configuration, {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
      redirect_uri: this.redirectUrl!,
      scope: 'openid email profile',
      state,
    });
    return { cookie, url };
  }

  async complete(
    currentUrl: URL,
    cookie: string | undefined,
  ): Promise<{
    identity: OidcIdentity;
    linkSessionId?: string;
    linkUserId?: string;
  }> {
    if (!cookie) {
      throw new UnauthorizedException('The OIDC login state is missing.');
    }
    try {
      const { payload } = await jwtDecrypt(cookie, this.stateKey, {
        currentDate: this.clock.now(),
      });
      if (
        typeof payload.codeVerifier !== 'string' ||
        typeof payload.nonce !== 'string' ||
        typeof payload.state !== 'string'
      ) {
        throw new Error('OIDC state claims are incomplete.');
      }
      const configuration = await this.getConfiguration();
      const callbackUrl = new URL(this.redirectUrl!);
      callbackUrl.search = currentUrl.search;
      const tokens = await oidc.authorizationCodeGrant(
        configuration,
        callbackUrl,
        {
          expectedNonce: payload.nonce,
          expectedState: payload.state,
          pkceCodeVerifier: payload.codeVerifier,
        },
      );
      const claims = tokens.claims();
      if (!claims?.sub || !claims.iss) {
        throw new Error('OIDC identity claims are incomplete.');
      }
      return {
        identity: {
          claims: { ...claims },
          email: typeof claims.email === 'string' ? claims.email : undefined,
          emailVerified: claims.email_verified === true,
          issuer: claims.iss,
          name: typeof claims.name === 'string' ? claims.name : undefined,
          subject: claims.sub,
        },
        linkSessionId:
          typeof payload.linkSessionId === 'string'
            ? payload.linkSessionId
            : undefined,
        linkUserId:
          typeof payload.linkUserId === 'string'
            ? payload.linkUserId
            : undefined,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException(
        'The OIDC response is invalid or expired.',
      );
    }
  }

  private getConfiguration(): Promise<oidc.Configuration> {
    if (
      !this.issuerUrl ||
      !this.clientId ||
      !this.clientSecret ||
      !this.redirectUrl
    ) {
      throw new ServiceUnavailableException('OIDC is not configured.');
    }
    this.configuration ??= oidc.discovery(
      this.issuerUrl,
      this.clientId,
      this.clientSecret,
    );
    return this.configuration;
  }
}
