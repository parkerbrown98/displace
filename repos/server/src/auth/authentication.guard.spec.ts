import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { vi } from 'vitest';
import type { DeveloperApiService } from '../developer-api/developer-api.service.js';
import { ApiTokenScope } from '../developer-api/developer-api.dto.js';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';
import { REQUIRED_PERMISSIONS } from '../platform/authorization/require-permissions.decorator.js';
import type { AccessTokenService } from './access-token.service.js';
import type { AuthService } from './auth.service.js';
import { AccessAuthenticationGuard } from './authentication.guard.js';
import { REQUIRED_API_TOKEN_SCOPES } from './require-api-token-scopes.decorator.js';

describe('AccessAuthenticationGuard API token scopes', () => {
  const authentication = {
    id: '01997a4e-a200-7000-8000-000000000001',
    scopes: new Set<ApiTokenScope>(),
    userId: '01997a4e-a200-7000-8000-000000000002',
  };
  const developerApi = { authenticate: vi.fn().mockResolvedValue(authentication) };

  beforeEach(() => {
    authentication.scopes.clear();
    vi.clearAllMocks();
  });

  it('requires read for safe methods and attaches the authenticated user', async () => {
    authentication.scopes.add(ApiTokenScope.Read);
    const request = apiTokenRequest('GET');
    const guard = createGuard();

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.authorization?.user).toMatchObject({
      apiTokenId: authentication.id,
      id: authentication.userId,
    });
  });

  it('requires write for mutating methods', async () => {
    authentication.scopes.add(ApiTokenScope.Read);

    await expect(
      createGuard().canActivate(contextFor(apiTokenRequest('POST'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('derives moderation scope from authorization permission metadata', async () => {
    authentication.scopes.add(ApiTokenScope.Read);
    const guard = createGuard(['moderation.manage']);

    await expect(
      guard.canActivate(contextFor(apiTokenRequest('GET'))),
    ).rejects.toThrow('The API token requires the moderation scope.');
  });

  it('honors explicitly declared administration scope metadata', async () => {
    authentication.scopes.add(ApiTokenScope.Read);
    const guard = createGuard(undefined, [ApiTokenScope.Administration]);

    await expect(
      guard.canActivate(contextFor(apiTokenRequest('GET'))),
    ).rejects.toThrow('The API token requires the administration scope.');
  });

  function createGuard(
    permissions?: string[],
    requiredScopes?: ApiTokenScope[],
  ): AccessAuthenticationGuard {
    const reflector = {
      getAllAndOverride: vi.fn((key: symbol) => {
        if (key === REQUIRED_PERMISSIONS) return permissions;
        if (key === REQUIRED_API_TOKEN_SCOPES) return requiredScopes;
        return undefined;
      }),
    };
    return new AccessAuthenticationGuard(
      {} as AccessTokenService,
      {} as AuthService,
      developerApi as unknown as DeveloperApiService,
      reflector as unknown as Reflector,
    );
  }
});

function apiTokenRequest(method: string): AuthorizedRequest {
  return {
    headers: { authorization: 'Bearer dsp_test-token' },
    method,
  } as AuthorizedRequest;
}

function contextFor(request: AuthorizedRequest): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}