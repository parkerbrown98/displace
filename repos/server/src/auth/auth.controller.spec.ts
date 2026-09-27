import type { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { vi } from 'vitest';
import type { AppEnvironment } from '../config/environment.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';
import type { OidcService } from './oidc.service.js';

describe('AuthController OIDC callback', () => {
  it('sets browser authentication cookies and redirects to the web callback', async () => {
    const user = {
      displayName: 'OIDC User',
      email: 'oidc@example.test',
      emailVerified: true,
      handle: 'oidc_user',
      id: '01990000-7000-8000-8000-000000000501',
    };
    const authService = {
      loginWithOidc: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        expiresInSeconds: 900,
        refreshToken: 'refresh-token',
        user,
      }),
    } as unknown as AuthService;
    const oidc = {
      complete: vi.fn().mockResolvedValue({
        identity: {
          claims: {},
          emailVerified: true,
          issuer: 'https://identity.example',
          subject: 'oidc-user',
        },
      }),
    } as unknown as OidcService;
    const config = {
      get: vi.fn((key: keyof AppEnvironment) => {
        if (key === 'CORS_ORIGINS') return ['http://localhost:3000'];
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    } as unknown as ConfigService<AppEnvironment, true>;
    const controller = new AuthController(
      authService,
      new CsrfService({ generate: () => 'csrf-token' }),
      oidc,
      config,
    );
    const reply = {
      clearCookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockResolvedValue(undefined),
      setCookie: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;
    const request = {
      cookies: { displace_oidc: 'encrypted-state' },
      headers: { 'user-agent': 'vitest' },
      hostname: 'localhost',
      ip: '127.0.0.1',
      protocol: 'http',
      url: '/api/v1/auth/oidc/callback?code=authorization-code&state=state',
    } as unknown as FastifyRequest;

    await controller.completeOidc(request, reply);

    expect(reply.setCookie).toHaveBeenCalledWith(
      'displace_session',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      'displace_csrf',
      'csrf-token',
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
    expect(reply.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/auth/callback',
    );
  });

  it('returns native authentication in the response body without setting cookies', async () => {
    const authentication = {
      accessToken: 'access-token',
      expiresInSeconds: 900,
      refreshToken: 'refresh-token',
      user: {
        displayName: 'Native User',
        email: 'native@example.test',
        emailVerified: true,
        handle: 'native_user',
        id: '01990000-7000-8000-8000-000000000502',
      },
    };
    const authService = {
      loginWithOidc: vi.fn().mockResolvedValue(authentication),
    } as unknown as AuthService;
    const oidc = {
      completeNative: vi.fn().mockResolvedValue({
        claims: {},
        emailVerified: true,
        issuer: 'https://identity.example',
        subject: 'native-user',
      }),
    } as unknown as OidcService;
    const config = {
      get: vi.fn((key: keyof AppEnvironment) => {
        if (key === 'CORS_ORIGINS') return ['http://localhost:3000'];
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    } as unknown as ConfigService<AppEnvironment, true>;
    const controller = new AuthController(
      authService,
      new CsrfService({ generate: () => 'csrf-token' }),
      oidc,
      config,
    );
    const reply = { setCookie: vi.fn() } as unknown as FastifyReply;
    const request = {
      headers: { 'user-agent': 'Displace desktop' },
      ip: '127.0.0.1',
    } as unknown as FastifyRequest;
    const input = {
      callbackUrl: 'displace-test://auth/callback?code=provider-code&state=native-state',
      codeVerifier: 'v'.repeat(43),
      nonce: 'n'.repeat(32),
      state: 'native-state'.padEnd(32, 's'),
    };

    await expect(controller.exchangeNativeOidc(input, request, reply)).resolves.toEqual(authentication);
    expect(oidc.completeNative).toHaveBeenCalledWith(
      input.callbackUrl,
      input.state,
      input.nonce,
      input.codeVerifier,
    );
    expect(reply.setCookie).not.toHaveBeenCalled();
  });
});